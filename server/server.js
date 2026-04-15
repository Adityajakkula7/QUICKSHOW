import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import movieRoutes from './routes/movieRoutes.js';
import showRoutes from './routes/showRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

const app = express();
const port = 3000;
const startServer = async () => {
    await connectDB();
}

//Middleware
app.use(express.json());
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(clerkMiddleware());

//API Routes

app.get("/", (req, res) => {
    res.send('Server is Live');
})

app.use("/api/inngest", serve({ client: inngest, functions }));

// add with other routes
app.use('/api/movies', movieRoutes);

//add show data
app.use('/api/shows', showRoutes);


app.use('/api/bookings', bookingRoutes);


app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`)
})

startServer();