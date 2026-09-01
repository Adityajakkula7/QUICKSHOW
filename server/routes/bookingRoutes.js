/**
 * Booking Routes
 *
 * CONCURRENCY SAFETY:
 * The seat-booking flow uses an atomic MongoDB findOneAndUpdate to claim seats.
 * This prevents two simultaneous requests from booking the same seat:
 *
 *   1. Client calls POST /create-checkout-session
 *   2. We build a query: find the Show where NONE of the requested seats
 *      are already in occupiedSeats (using $exists: false checks)
 *   3. findOneAndUpdate atomically sets the seat keys → bookingId
 *   4. If no document is returned → another request claimed a seat first → 409
 *
 * This is safe without multi-document transactions, which aren't available on
 * Atlas M0 free tier. MongoDB document-level atomicity handles this correctly.
 *
 * MESSAGE QUEUE:
 * After payment is verified (booking.isPaid = true), we publish a
 * 'booking.confirmed' event to RabbitMQ. This triggers async notifications
 * (email, analytics) without blocking the HTTP response.
 *
 * NOTE: Seat availability (seats-status endpoint) is intentionally NOT cached
 * in Redis. Stale seat data could lead to users selecting already-booked seats
 * and then failing at checkout. The DB read here is the source of truth.
 */

import express from 'express';
import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Show from '../models/Show.js';
import { publishEvent } from '../services/queueService.js';

const router = express.Router();

// ─── GET /seats-status ─────────────────────────────────────────────────────────
// Returns occupied (paid) and locked (pending ≤10min) seats for a show.
// INTENTIONALLY NOT CACHED — stale seat data causes bad UX and potential
// double-booking attempts. Always reads from the primary DB.
router.get('/seats-status', async (req, res) => {
    try {
        const { movieId, showTime } = req.query;
        if (!movieId || !showTime) {
            return res.status(400).json({ success: false, message: 'Missing movieId or showTime' });
        }

        // Validate inputs
        if (!/^\d+$/.test(movieId)) {
            return res.status(400).json({ success: false, message: 'Invalid movieId' });
        }

        const showDate = new Date(showTime);
        if (isNaN(showDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid showTime' });
        }

        const bookings = await Booking.find({
            movie: Number(movieId),
            showDateTime: showDate
        });

        const occupiedSeats = [];
        const lockedSeats = [];
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        bookings.forEach(booking => {
            if (booking.isPaid) {
                occupiedSeats.push(...booking.bookedSeats);
            } else if (booking.createdAt > tenMinutesAgo) {
                lockedSeats.push(...booking.bookedSeats);
            }
        });

        res.json({ success: true, occupiedSeats, lockedSeats });
    } catch (error) {
        console.error('[Booking] seats-status error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch seat status' });
    }
});

// ─── POST /create-checkout-session ────────────────────────────────────────────
// Atomic seat claim: uses MongoDB findOneAndUpdate with conditional query to
// prevent concurrent bookings of the same seat.
router.post('/create-checkout-session', async (req, res) => {
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const { seats, movieId, movieTitle, moviePoster, showTime, amount, userId } = req.body;

        // ── Input validation ──────────────────────────────────────────────────
        if (!seats || !Array.isArray(seats) || seats.length === 0) {
            return res.status(400).json({ success: false, message: 'No seats provided' });
        }
        if (seats.length > 10) {
            return res.status(400).json({ success: false, message: 'Cannot book more than 10 seats at once' });
        }
        // Validate seat ID format: letter A-J followed by 1-9
        const validSeatPattern = /^[A-J][1-9]$/;
        if (!seats.every(s => typeof s === 'string' && validSeatPattern.test(s))) {
            return res.status(400).json({ success: false, message: 'Invalid seat ID format' });
        }
        if (!movieId || !movieTitle || !showTime || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required booking fields' });
        }

        const showDate = new Date(showTime);
        if (isNaN(showDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid showTime' });
        }

        // ── Step 1: Find-or-create the Show document ──────────────────────────
        // The existing design stores occupiedSeats on the Show document.
        // We upsert the Show if it doesn't exist yet (backward-compatible with
        // the frontend-generated showIds that don't have DB records).
        let show = await Show.findOne({
            movie: Number(movieId),
            showDateTime: showDate
        });

        if (!show) {
            // Create show on-demand (matches existing frontend behaviour of generating
            // show slots client-side without pre-seeding them in DB)
            show = await Show.create({
                movie: Number(movieId),
                showDateTime: showDate,
                showPrice: amount / seats.length,
                occupiedSeats: {}
            });
        }

        // ── Step 2: Check for seat conflicts (Booking-level lock check) ───────
        // Also check the Booking collection for the 10-min pending lock pattern
        // that the existing frontend relies on (backward compat).
        const existingBookings = await Booking.find({
            movie: Number(movieId),
            showDateTime: showDate
        });

        const confirmedOccupied = new Set();
        const recentLocked = new Set();
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        existingBookings.forEach(booking => {
            if (booking.isPaid) {
                booking.bookedSeats.forEach(seat => confirmedOccupied.add(seat));
            } else if (booking.createdAt > tenMinutesAgo) {
                booking.bookedSeats.forEach(seat => recentLocked.add(seat));
            }
        });

        const conflictingSeats = seats.filter(seat =>
            confirmedOccupied.has(seat) || recentLocked.has(seat)
        );

        if (conflictingSeats.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Seats ${conflictingSeats.join(', ')} are already booked or locked. Please select other seats.`,
                conflictingSeats
            });
        }

        // ── Step 3: Atomic seat claim on Show document ─────────────────────────
        // Build a conditional update: only proceed if none of the requested
        // seats are already in occupiedSeats. This is the concurrency guard.
        const seatConflictCondition = {};
        seats.forEach(seat => {
            // $exists: false means the seat key must not be present
            seatConflictCondition[`occupiedSeats.${seat}`] = { $exists: false };
        });

        // We use a placeholder value during checkout; replaced with bookingId on payment
        const pendingMarker = {};
        seats.forEach(seat => {
            pendingMarker[`occupiedSeats.${seat}`] = 'pending';
        });

        const claimedShow = await Show.findOneAndUpdate(
            {
                _id: show._id,
                ...seatConflictCondition  // <-- atomic concurrency guard
            },
            { $set: pendingMarker },
            { new: true }
        );

        if (!claimedShow) {
            // Another concurrent request beat us to at least one of these seats
            return res.status(409).json({
                success: false,
                message: 'One or more seats were just taken by another user. Please select other seats.'
            });
        }

        // ── Step 4: Create pending Booking record ─────────────────────────────
        const booking = await Booking.create({
            user: userId || 'guest',
            movie: movieId,
            movieTitle,
            moviePoster,
            showDateTime: showTime,
            bookedSeats: seats,
            amount,
            isPaid: false,
        });

        // Update the Show's occupiedSeats with the actual bookingId
        const bookingIdMarker = {};
        seats.forEach(seat => {
            bookingIdMarker[`occupiedSeats.${seat}`] = booking._id.toString();
        });
        await Show.findByIdAndUpdate(show._id, { $set: bookingIdMarker });

        // ── Step 5: Create Stripe checkout session ────────────────────────────
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: movieTitle,
                        description: `${seats.length} seat(s) - ${new Date(showTime).toLocaleString('en-IN')}`,
                    },
                    unit_amount: amount * 100,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/my-bookings?success=true&bookingId=${booking._id}`,
            cancel_url: `${process.env.CLIENT_URL}/movies`,
            metadata: { bookingId: booking._id.toString() }
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('[Booking] create-checkout-session error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to create checkout session' });
    }
});

// ─── GET /verify/:bookingId ────────────────────────────────────────────────────
// Called by the frontend after Stripe redirects back with ?success=true.
// Marks booking as paid and publishes a BookingConfirmed event to the queue.
router.get('/verify/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;

        // Basic ObjectId format validation
        if (!/^[a-f\d]{24}$/i.test(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }

        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            { isPaid: true },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // ── Publish async event AFTER successful DB commit ─────────────────────
        // The booking is now confirmed. Fire-and-forget: notifications worker
        // will pick this up from RabbitMQ and send email/analytics.
        // If RabbitMQ is down, publishEvent logs a warning and returns — the
        // booking response is not affected.
        publishEvent('booking.confirmed', {
            bookingId: booking._id.toString(),
            userId: booking.user,
            movieTitle: booking.movieTitle,
            moviePoster: booking.moviePoster,
            showDateTime: booking.showDateTime,
            bookedSeats: booking.bookedSeats,
            amount: booking.amount,
        });

        res.json({ success: true, booking });
    } catch (error) {
        console.error('[Booking] verify error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to verify booking' });
    }
});

// ─── GET /user/:userId ─────────────────────────────────────────────────────────
router.get('/user/:userId', async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.params.userId })
            .sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        console.error('[Booking] user bookings error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
    }
});

export default router;