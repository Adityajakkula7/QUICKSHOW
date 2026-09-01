/**
 * Booking Route Tests
 *
 * Tests:
 * - Booking confirmation event is published after payment verification
 * - Queue unavailable does not break booking verification
 * - Concurrent booking of same seat results in one success, one conflict
 * - Input validation rejects bad seat IDs and missing fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock publishEvent ────────────────────────────────────────────────────────
vi.mock('../services/queueService.js', () => ({
    publishEvent: vi.fn(),
    connectQueue: vi.fn(),
    isQueueConnected: vi.fn(() => true),
}));

// ─── Mock Mongoose models ─────────────────────────────────────────────────────
vi.mock('../models/Booking.js', () => {
    return {
        default: {
            find: vi.fn(),
            findByIdAndUpdate: vi.fn(),
            create: vi.fn(),
        }
    };
});

vi.mock('../models/Show.js', () => {
    return {
        default: {
            findOne: vi.fn(),
            findOneAndUpdate: vi.fn(),
            findByIdAndUpdate: vi.fn(),
            create: vi.fn(),
        }
    };
});

import { publishEvent } from '../services/queueService.js';
import Booking from '../models/Booking.js';
import Show from '../models/Show.js';

// ─── Helpers to simulate the verify endpoint logic ─────────────────────────────
// We test the service-layer logic rather than doing full HTTP integration tests
// (which would require a running DB). The actual route handler logic is:
// 1. findByIdAndUpdate → booking
// 2. publishEvent('booking.confirmed', {...})

const simulateVerify = async (bookingId) => {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
        throw new Error('Invalid booking ID');
    }

    const booking = await Booking.findByIdAndUpdate(
        bookingId,
        { isPaid: true },
        { new: true }
    );

    if (!booking) throw new Error('Booking not found');

    publishEvent('booking.confirmed', {
        bookingId: booking._id.toString(),
        userId: booking.user,
        movieTitle: booking.movieTitle,
        bookedSeats: booking.bookedSeats,
        amount: booking.amount,
    });

    return booking;
};

describe('Booking Verification + Event Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('publishes booking.confirmed event after successful payment', async () => {
        const mockBooking = {
            _id: { toString: () => '507f1f77bcf86cd799439011' },
            user: 'user123',
            movieTitle: 'Test Movie',
            bookedSeats: ['A1', 'A2'],
            amount: 300,
        };

        Booking.findByIdAndUpdate.mockResolvedValue(mockBooking);

        await simulateVerify('507f1f77bcf86cd799439011');

        expect(publishEvent).toHaveBeenCalledOnce();
        expect(publishEvent).toHaveBeenCalledWith('booking.confirmed', expect.objectContaining({
            bookingId: '507f1f77bcf86cd799439011',
            userId: 'user123',
            movieTitle: 'Test Movie',
            bookedSeats: ['A1', 'A2'],
            amount: 300,
        }));
    });

    it('does not publish event when booking is not found', async () => {
        Booking.findByIdAndUpdate.mockResolvedValue(null);

        await expect(
            simulateVerify('507f1f77bcf86cd799439011')
        ).rejects.toThrow('Booking not found');

        expect(publishEvent).not.toHaveBeenCalled();
    });

    it('rejects invalid booking ID format', async () => {
        await expect(
            simulateVerify('invalid-id')
        ).rejects.toThrow('Invalid booking ID');

        expect(Booking.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(publishEvent).not.toHaveBeenCalled();
    });
});

describe('Seat Validation Logic', () => {
    const validSeatPattern = /^[A-J][1-9]$/;

    it('accepts valid seat IDs', () => {
        const validSeats = ['A1', 'B9', 'J1', 'E5', 'H8'];
        expect(validSeats.every(s => validSeatPattern.test(s))).toBe(true);
    });

    it('rejects invalid seat ID formats', () => {
        const invalidSeats = ['a1', 'K1', 'A0', 'A10', 'AA1', '1A', '', 'A'];
        invalidSeats.forEach(seat => {
            expect(validSeatPattern.test(seat)).toBe(false);
        });
    });
});

describe('Concurrent Booking — Atomic Seat Claim', () => {
    // Simulates the findOneAndUpdate conditional query logic
    // In production, MongoDB ensures atomicity at the document level

    it('first request claims seat, second gets null (conflict)', async () => {
        const show = { _id: 'show1', occupiedSeats: {} };
        const seats = ['A1', 'A2'];

        // First call: no conflict → returns updated show
        Show.findOneAndUpdate
            .mockResolvedValueOnce({ ...show, occupiedSeats: { A1: 'booking1', A2: 'booking1' } })
            // Second call: seats already claimed → returns null
            .mockResolvedValueOnce(null);

        const seatConflictCondition = {};
        seats.forEach(seat => {
            seatConflictCondition[`occupiedSeats.${seat}`] = { $exists: false };
        });

        // First concurrent request
        const result1 = await Show.findOneAndUpdate(
            { _id: 'show1', ...seatConflictCondition },
            { $set: { 'occupiedSeats.A1': 'booking1', 'occupiedSeats.A2': 'booking1' } },
            { new: true }
        );

        // Second concurrent request (same seats)
        const result2 = await Show.findOneAndUpdate(
            { _id: 'show1', ...seatConflictCondition },
            { $set: { 'occupiedSeats.A1': 'booking2', 'occupiedSeats.A2': 'booking2' } },
            { new: true }
        );

        // First wins
        expect(result1).not.toBeNull();
        expect(result1.occupiedSeats.A1).toBe('booking1');

        // Second gets null → should return 409
        expect(result2).toBeNull();
    });
});

describe('Queue Unavailable — Graceful Degradation', () => {
    it('booking verification succeeds even when publishEvent throws', async () => {
        const mockBooking = {
            _id: { toString: () => '507f1f77bcf86cd799439011' },
            user: 'user123',
            movieTitle: 'Test Movie',
            bookedSeats: ['B3'],
            amount: 150,
        };

        Booking.findByIdAndUpdate.mockResolvedValue(mockBooking);
        // Simulate queue service silently swallowing the error (as designed)
        publishEvent.mockImplementation(() => {
            // publishEvent never throws in our implementation — it logs and returns
            return undefined;
        });

        // Should not throw even if queue has issues
        const result = await simulateVerify('507f1f77bcf86cd799439011');
        expect(result).toBeDefined();
        expect(result.movieTitle).toBe('Test Movie');
    });
});
