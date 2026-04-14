import mongoose from 'mongoose';

const showSchema = new mongoose.Schema({
    movie: { type: Number, required: true },
    showDateTime: { type: Date, required: true },
    showPrice: { type: Number, required: true },
    occupiedSeats: { type: Object, default: {} },
    totalSeats: { type: Number, default: 90 }
});

export default mongoose.model('Show', showSchema);