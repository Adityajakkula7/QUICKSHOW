import express from 'express';
import Stripe from 'stripe';
import Booking from '../models/Booking.js';

const router = express.Router();


// Get occupied and locked seats for a movie and showtime
router.get('/seats-status', async (req, res) => {
    try {
        const { movieId, showTime } = req.query;
        if (!movieId || !showTime) {
            return res.status(400).json({ success: false, message: 'Missing movieId or showTime' });
        }

        const bookings = await Booking.find({
            movie: Number(movieId),
            showDateTime: new Date(showTime)
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

        res.json({
            success: true,
            occupiedSeats,
            lockedSeats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const { seats, movieId, movieTitle, moviePoster, showTime, amount, userId } = req.body;

        // Check if any of the requested seats are already booked or locked
        const existingBookings = await Booking.find({
            movie: Number(movieId),
            showDateTime: new Date(showTime)
        });

        const occupiedSeats = new Set();
        const lockedSeats = new Set();
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        existingBookings.forEach(booking => {
            if (booking.isPaid) {
                booking.bookedSeats.forEach(seat => occupiedSeats.add(seat));
            } else if (booking.createdAt > tenMinutesAgo) {
                booking.bookedSeats.forEach(seat => lockedSeats.add(seat));
            }
        });

        const isAnySeatUnavailable = seats.some(seat => occupiedSeats.has(seat) || lockedSeats.has(seat));
        if (isAnySeatUnavailable) {
            return res.status(400).json({
                success: false,
                message: 'One or more of the selected seats are already locked or booked. Please select other seats.'
            });
        }

        // Save booking as unpaid first
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
        console.error('Stripe Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Verify payment and mark booking as paid
router.get('/verify/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.bookingId,
            { isPaid: true },
            { new: true }
        );
        res.json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user bookings
router.get('/user/:userId', async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.params.userId })
            .sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;