import mongoose from 'mongoose';

const showSchema = new mongoose.Schema({
    movie: { type: Number, required: true },
    showDateTime: { type: Date, required: true },
    showPrice: { type: Number, required: true },
    /**
     * occupiedSeats stores confirmed-paid seat IDs as keys → booking ObjectId as value.
     * Example: { "A1": "6871a...", "A2": "6871a..." }
     *
     * Using an Object (Mixed) allows atomic $set operations per seat key via
     * findOneAndUpdate + conditional queries, preventing double-booking without
     * requiring multi-document transactions (which aren't available on Atlas M0).
     */
    occupiedSeats: { type: Object, default: {} },
    totalSeats: { type: Number, default: 90 }
});

// Compound index for fast seat-status and show lookups
showSchema.index({ movie: 1, showDateTime: 1 });

export default mongoose.model('Show', showSchema);