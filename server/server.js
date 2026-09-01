import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { getRedisClient } from './configs/redis.js';
import { connectQueue } from './services/queueService.js';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import movieRoutes from './routes/movieRoutes.js';
import showRoutes from './routes/showRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import authRoutes from './routes/authRoutes.js';
import transportRoutes from './routes/transportRoutes.js';

const app = express();
const port = 3000;

const startServer = async () => {
    await connectDB();

    // Initialize Redis connection (non-blocking — app works without it)
    getRedisClient();

    // Initialize RabbitMQ connection (non-blocking — booking works without it)
    await connectQueue();
};

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.send('Server is Live');
});

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transport', transportRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
// Only start HTTP server when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server is listening at http://localhost:${port}`)
    });
    startServer();
}

export default app;