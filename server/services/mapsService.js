/**
 * Maps Service — Google Maps Routes API integration with fare estimation.
 *
 * WHY BACKEND PROXY?
 * The Google Maps API key must never be exposed in frontend code, where it
 * could be scraped from network requests or browser DevTools. All map API
 * calls go through this server-side service.
 *
 * FARE ESTIMATION:
 * estimatedFare = baseFare + (distanceKm × perKmRate)
 * Rates are configurable via environment variables.
 * Results are clearly labeled as ESTIMATES — not actual taxi fares.
 *
 * DEV FALLBACK:
 * If GOOGLE_MAPS_API_KEY is not configured, calculateRoute returns a
 * clearly-marked development fallback response so the app can run locally
 * without a real API key.
 *
 * ERROR HANDLING:
 * - Missing API key → dev fallback
 * - HTTP error from Google → descriptive error thrown
 * - No route found → specific error message
 * - Timeout → axios timeout error propagated
 */

import axios from 'axios';

const GOOGLE_ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const REQUEST_TIMEOUT_MS = 8000;

// ─── Fare configuration (from env, with sensible defaults) ───────────────────
const FARE_CONFIG = {
    auto: {
        name: 'Auto',
        base: Number(process.env.FARE_BASE_AUTO) || 25,
        perKm: Number(process.env.FARE_PKM_AUTO) || 12,
    },
    mini: {
        name: 'Mini Cab',
        base: Number(process.env.FARE_BASE_MINI) || 40,
        perKm: Number(process.env.FARE_PKM_MINI) || 14,
    },
    sedan: {
        name: 'Sedan',
        base: Number(process.env.FARE_BASE_SEDAN) || 50,
        perKm: Number(process.env.FARE_PKM_SEDAN) || 18,
    },
};

/**
 * Calculate fare for a given distance and cab type.
 * Formula: baseFare + (distanceKm × perKmRate), rounded to nearest rupee.
 *
 * @param {number} distanceKm
 * @param {string} cabType — 'auto' | 'mini' | 'sedan'
 * @returns {{ name: string, estimatedFare: number, breakdown: string }}
 */
export const estimateFare = (distanceKm, cabType = 'mini') => {
    const config = FARE_CONFIG[cabType] || FARE_CONFIG.mini;
    const estimatedFare = Math.round(config.base + (distanceKm * config.perKm));
    return {
        name: config.name,
        estimatedFare,
        breakdown: `₹${config.base} base + ₹${config.perKm}/km × ${distanceKm}km`,
        isEstimate: true, // Always flag as estimate — not an actual taxi fare
    };
};

/**
 * Calculate all fare tiers for a distance.
 * @param {number} distanceKm
 * @returns {object} — { auto, mini, sedan }
 */
export const allFares = (distanceKm) => {
    return Object.fromEntries(
        Object.keys(FARE_CONFIG).map(type => [type, estimateFare(distanceKm, type)])
    );
};

/**
 * Call Google Maps Routes API to get road distance and duration.
 *
 * @param {{ lat: number, lng: number }|string} origin — coords or address string
 * @param {{ lat: number, lng: number }|string} destination — coords or address
 * @returns {Promise<{ distanceKm: number, durationMin: number, distanceText: string, durationText: string, isDevelopmentFallback: boolean }>}
 */
export const calculateRoute = async (origin, destination) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // ── Dev fallback when API key is not configured ───────────────────────────
    if (!apiKey) {
        console.warn('[Maps] GOOGLE_MAPS_API_KEY not set — using development fallback');
        return buildDevFallback(origin, destination);
    }

    // ── Build request body ────────────────────────────────────────────────────
    const originWaypoint = buildWaypoint(origin);
    const destinationWaypoint = buildWaypoint(destination);

    const requestBody = {
        origin: originWaypoint,
        destination: destinationWaypoint,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        languageCode: 'en-IN',
        units: 'METRIC',
    };

    try {
        const response = await axios.post(GOOGLE_ROUTES_API_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.localizedValues',
            },
            timeout: REQUEST_TIMEOUT_MS,
        });

        const routes = response.data?.routes;
        if (!routes || routes.length === 0) {
            throw new Error('No route found between the specified locations');
        }

        const route = routes[0];
        const distanceMeters = route.distanceMeters || 0;
        const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);

        const distanceKm = parseFloat((distanceMeters / 1000).toFixed(1));
        const durationMin = Math.ceil(durationSeconds / 60);

        return {
            distanceKm,
            durationMin,
            distanceText: `${distanceKm} km`,
            durationText: durationMin >= 60
                ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
                : `${durationMin} min`,
            isDevelopmentFallback: false,
        };
    } catch (err) {
        if (err.response) {
            // Google API returned an error response
            const status = err.response.status;
            const msg = err.response.data?.error?.message || err.message;
            console.error(`[Maps] Google Routes API error ${status}:`, msg);
            throw new Error(`Maps API error: ${msg}`);
        }
        if (err.code === 'ECONNABORTED') {
            throw new Error('Maps API request timed out. Please try again.');
        }
        throw err;
    }
};

// ─── Helper: build waypoint from coords or address string ────────────────────
const buildWaypoint = (location) => {
    if (typeof location === 'string') {
        return { address: location };
    }
    if (typeof location === 'object' && location.lat !== undefined) {
        return {
            location: {
                latLng: {
                    latitude: location.lat,
                    longitude: location.lng,
                }
            }
        };
    }
    throw new Error('Invalid location format — provide { lat, lng } or an address string');
};

// ─── Dev fallback ─────────────────────────────────────────────────────────────
const buildDevFallback = (origin, destination) => {
    const distanceKm = 8.5; // Plausible urban distance
    const durationMin = 22;

    return {
        distanceKm,
        durationMin,
        distanceText: `${distanceKm} km`,
        durationText: `${durationMin} min`,
        isDevelopmentFallback: true,
        devNote: 'GOOGLE_MAPS_API_KEY is not configured. This is a simulated response for development only.',
    };
};

export { FARE_CONFIG };
export default { calculateRoute, estimateFare, allFares };
