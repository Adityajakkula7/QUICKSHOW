import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    user: { type: String, required: true }, // User ObjectId
    movie: { type: Number, required: true }, // TMDB movie ID
    movieTitle: { type: String, required: true },
    moviePoster: { type: String },
    showDateTime: { type: Date, required: true },
    bookedSeats: { type: Array, required: true },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    stripeSessionId: { type: String },
}, { timestamps: true });

export default mongoose.model('Booking', bookingSchema);