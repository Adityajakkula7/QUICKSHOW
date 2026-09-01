import express from 'express';
import Show from '../models/Show.js';
import { getCache, setCache, deleteCachePattern, CACHE_KEYS, CACHE_TTL } from '../services/cacheService.js';

const router = express.Router();

// ─── GET /:movieId — Shows grouped by date ─────────────────────────────────────
// Cached: 5 minutes. Show schedule is relatively stable but changes more often
// than movie metadata (admin can add shows). Safe to cache — seat availability
// is fetched separately and never cached.
router.get('/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;

        // Validate movieId is numeric
        if (!/^\d+$/.test(movieId)) {
            return res.status(400).json({ success: false, message: 'Invalid movieId format' });
        }

        const cacheKey = CACHE_KEYS.showsByMovie(movieId);

        // 1. Check cache
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({ success: true, dateTime: cached, fromCache: true });
        }

        // 2. Cache miss — fetch from DB
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

        // 3. Populate cache
        await setCache(cacheKey, dateTime, CACHE_TTL.SHOWS);

        res.json({ success: true, dateTime, fromCache: false });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── POST /add — Admin: Add a show ────────────────────────────────────────────
// Invalidates the show cache for this movie so next request gets fresh data.
router.post('/add', async (req, res) => {
    try {
        const { movie, showDateTime, showPrice } = req.body;

        if (!movie || !showDateTime || !showPrice) {
            return res.status(400).json({ success: false, message: 'movie, showDateTime, and showPrice are required' });
        }

        const show = await Show.create({ movie, showDateTime, showPrice });

        // Invalidate cache for this movie's shows
        await deleteCachePattern(`shows:movie:${movie}`);

        res.json({ success: true, show });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;