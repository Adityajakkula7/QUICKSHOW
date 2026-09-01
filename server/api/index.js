import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from '../configs/db.js';
import { getRedisClient } from '../configs/redis.js';
import { connectQueue } from '../services/queueService.js';
import { serve } from 'inngest/express';
import { inngest, functions } from '../inngest/index.js';
import movieRoutes from '../routes/movieRoutes.js';
import showRoutes from '../routes/showRoutes.js';
import bookingRoutes from '../routes/bookingRoutes.js';
import authRoutes from '../routes/authRoutes.js';
import transportRoutes from '../routes/transportRoutes.js';

const app = express();

// Middleware
app.use(express.json());
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Ensure DB + Redis are connected before every request (cached after first connect)
app.use(async (req, res, next) => {
    await connectDB();
    getRedisClient(); // idempotent — only creates client once
    next();
});

// Routes
app.get('/', (req, res) => res.send('Server is Live'));
app.use('/api/inngest', serve({ client: inngest, functions }));
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transport', transportRoutes);

// Note: RabbitMQ connectQueue() is not called in Vercel serverless mode
// because serverless functions are stateless — they cannot maintain
// long-lived connections. The publishEvent call will no-op gracefully.

export default app;
