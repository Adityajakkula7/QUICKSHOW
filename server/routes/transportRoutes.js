/**
 * Transport Routes
 *
 * Provides a secure backend proxy for Google Maps API calls and
 * a static theatre list for the transport assistance feature.
 *
 * Endpoints:
 *   POST /api/transport/route   — Calculate road distance + fare estimate
 *   GET  /api/transport/theatres — Return list of theatres with coordinates
 *
 * Security: GOOGLE_MAPS_API_KEY is consumed server-side and never exposed
 * in any response body or frontend bundle.
 */

import express from 'express';
import { calculateRoute, allFares } from '../services/mapsService.js';

const router = express.Router();

// ─── Static theatre data ──────────────────────────────────────────────────────
// In a production system these would come from a Theatre model in the DB.
// Kept static here as a clean starting point; easily replaceable with a DB query.
const THEATRES = [
    { id: 't1', name: 'PVR Cinemas - Inorbit Mall', address: 'Inorbit Mall, Hitech City, Hyderabad', lat: 17.4344, lng: 78.3842 },
    { id: 't2', name: 'IMAX AMB Cinemas',           address: 'AMB Mall, Gachibowli, Hyderabad',   lat: 17.4276, lng: 78.3467 },
    { id: 't3', name: 'Prasads Multiplex',           address: 'NTR Marg, Necklace Road, Hyderabad', lat: 17.4074, lng: 78.4741 },
    { id: 't4', name: 'Cinepolis Forum Sujana Mall', address: 'KPHB Colony, Kukatpally, Hyderabad', lat: 17.4935, lng: 78.3996 },
    { id: 't5', name: 'Asian Cinemas - Aura Mall',   address: 'Kondapur, Hyderabad',               lat: 17.4608, lng: 78.3578 },
    { id: 't6', name: 'PVR Cinemas - Forum Vijaya',  address: 'Vadapalani, Chennai',               lat: 13.0529, lng: 80.2122 },
    { id: 't7', name: 'Sathyam Cinemas',             address: 'Royapettah, Chennai',               lat: 13.0536, lng: 80.2620 },
    { id: 't8', name: 'PVR Director\'s Cut',         address: 'Ambience Mall, Gurugram',           lat: 28.4595, lng: 77.0266 },
    { id: 't9', name: 'INOX Nariman Point',          address: 'Nariman Point, Mumbai',             lat: 18.9230, lng: 72.8244 },
    { id: 't10', name: 'PVR Icon - Phoenix',         address: 'Phoenix Mall, Kurla, Mumbai',       lat: 19.0855, lng: 72.8893 },
];

// ─── GET /theatres ─────────────────────────────────────────────────────────────
// Returns the list of available theatres. Frontend uses this to populate the
// theatre dropdown and derive the destination for route calculation.
router.get('/theatres', (req, res) => {
    res.json({ success: true, theatres: THEATRES });
});

// ─── POST /route ───────────────────────────────────────────────────────────────
// Body: { origin: { lat, lng } | string, theatreId: string }
// Returns: { distanceKm, durationMin, fares: { auto, mini, sedan }, isDevelopmentFallback }
router.post('/route', async (req, res) => {
    try {
        const { origin, theatreId, destination } = req.body;

        // ── Input validation ─────────────────────────────────────────────────
        if (!origin) {
            return res.status(400).json({
                success: false,
                message: 'origin is required. Provide { lat, lng } or an address string.'
            });
        }

        // Validate origin format
        if (typeof origin === 'object') {
            const lat = Number(origin.lat);
            const lng = Number(origin.lng);
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return res.status(400).json({ success: false, message: 'Invalid origin coordinates' });
            }
        } else if (typeof origin !== 'string' || origin.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Origin address must be at least 3 characters' });
        }

        // Resolve destination: prefer theatreId → lookup; fall back to raw destination string
        let resolvedDestination = destination;

        if (theatreId) {
            const theatre = THEATRES.find(t => t.id === theatreId);
            if (!theatre) {
                return res.status(400).json({ success: false, message: `Theatre with id="${theatreId}" not found` });
            }
            resolvedDestination = { lat: theatre.lat, lng: theatre.lng };
        }

        if (!resolvedDestination) {
            return res.status(400).json({
                success: false,
                message: 'Provide either theatreId (from /theatres) or a destination address/coordinates'
            });
        }

        // ── Call Maps Service ────────────────────────────────────────────────
        const routeResult = await calculateRoute(origin, resolvedDestination);

        // ── Calculate all fare tiers ─────────────────────────────────────────
        const fares = allFares(routeResult.distanceKm);

        // ── Respond ──────────────────────────────────────────────────────────
        // IMPORTANT: Never include GOOGLE_MAPS_API_KEY in this response.
        res.json({
            success: true,
            distanceKm: routeResult.distanceKm,
            durationMin: routeResult.durationMin,
            distanceText: routeResult.distanceText,
            durationText: routeResult.durationText,
            fares,
            fareDisclaimer: 'Fare shown is an ESTIMATE only. Actual taxi/auto fare may vary depending on traffic, surge pricing, and operator.',
            isDevelopmentFallback: routeResult.isDevelopmentFallback || false,
            ...(routeResult.devNote && { devNote: routeResult.devNote }),
        });
    } catch (err) {
        console.error('[Transport] /route error:', err.message);

        // Return user-friendly error without exposing internal details
        if (err.message.includes('No route found')) {
            return res.status(422).json({ success: false, message: 'No driving route found between these locations.' });
        }
        if (err.message.includes('timed out')) {
            return res.status(504).json({ success: false, message: 'Route calculation timed out. Please try again.' });
        }
        if (err.message.startsWith('Maps API error:')) {
            return res.status(502).json({ success: false, message: err.message });
        }

        res.status(500).json({ success: false, message: 'Route calculation failed. Please try again.' });
    }
});

export default router;
