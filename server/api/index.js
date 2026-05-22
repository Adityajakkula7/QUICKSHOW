import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from '../configs/db.js';
import { clerkMiddleware } from '@clerk/express';
import { serve } from 'inngest/express';
import { inngest, functions } from '../inngest/index.js';
import movieRoutes from '../routes/movieRoutes.js';
import showRoutes from '../routes/showRoutes.js';
import bookingRoutes from '../routes/bookingRoutes.js';

const app = express();

// Middleware
app.use(express.json());

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(clerkMiddleware());

// Ensure DB is connected before every request (cached after first connect)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Routes
app.get('/', (req, res) => res.send('Server is Live'));
app.use('/api/inngest', serve({ client: inngest, functions }));
app.use('/api/movies', movieRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);

export default app;
