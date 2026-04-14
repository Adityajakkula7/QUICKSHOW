import express from 'express';
import Show from '../models/Show.js';

const router = express.Router();

// Get shows by movie id
router.get('/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const shows = await Show.find({ movie: movieId });

        // Group by date
        const dateTime = {};
        shows.forEach(show => {
            const date = show.showDateTime.toISOString().split('T')[0];
            if (!dateTime[date]) dateTime[date] = [];
            dateTime[date].push({
                time: show.showDateTime,
                showId: show._id,
                price: show.showPrice
            });
        });

        res.json({ success: true, dateTime });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin - Add a show
router.post('/add', async (req, res) => {
    try {
        const { movie, showDateTime, showPrice } = req.body;
        const show = await Show.create({ movie, showDateTime, showPrice });
        res.json({ success: true, show });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;