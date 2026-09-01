/**
 * Transport / Maps Service Tests
 *
 * Tests:
 * - Fare calculation formula and configurable rates
 * - allFares returns all cab types
 * - Dev fallback when GOOGLE_MAPS_API_KEY is not set
 * - Google Maps API error handling
 * - Invalid location input
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock axios to avoid real HTTP calls ──────────────────────────────────────
vi.mock('axios');
import axios from 'axios';

import { estimateFare, allFares, calculateRoute, FARE_CONFIG } from '../services/mapsService.js';

describe('Fare Estimation', () => {
    it('calculates auto fare correctly', () => {
        // Formula: baseFare + (distanceKm × perKmRate)
        // Auto defaults: base=25, perKm=12
        const result = estimateFare(10, 'auto');
        expect(result.estimatedFare).toBe(145); // 25 + (10 × 12) = 145
        expect(result.isEstimate).toBe(true);
        expect(result.name).toBe('Auto');
    });

    it('calculates mini fare correctly', () => {
        // Mini defaults: base=40, perKm=14
        const result = estimateFare(5, 'mini');
        expect(result.estimatedFare).toBe(110); // 40 + (5 × 14) = 110
    });

    it('calculates sedan fare correctly', () => {
        // Sedan defaults: base=50, perKm=18
        const result = estimateFare(8, 'sedan');
        expect(result.estimatedFare).toBe(194); // 50 + (8 × 18) = 194
    });

    it('rounds to nearest rupee', () => {
        // 0.7 km with auto: 25 + (0.7 × 12) = 25 + 8.4 = 33.4 → 33
        const result = estimateFare(0.7, 'auto');
        expect(Number.isInteger(result.estimatedFare)).toBe(true);
    });

    it('always marks result as isEstimate=true', () => {
        const result = estimateFare(10, 'mini');
        expect(result.isEstimate).toBe(true);
    });

    it('falls back to mini for unknown cab type', () => {
        const result = estimateFare(10, 'helicopter');
        expect(result.name).toBe('Mini Cab');
    });
});

describe('allFares', () => {
    it('returns fares for all cab types', () => {
        const fares = allFares(10);
        expect(fares).toHaveProperty('auto');
        expect(fares).toHaveProperty('mini');
        expect(fares).toHaveProperty('sedan');
        expect(fares.auto.estimatedFare).toBeGreaterThan(0);
        expect(fares.mini.estimatedFare).toBeGreaterThan(0);
        expect(fares.sedan.estimatedFare).toBeGreaterThan(0);
    });

    it('sedan is more expensive than mini which is more than auto for same distance', () => {
        const fares = allFares(15);
        expect(fares.auto.estimatedFare).toBeLessThan(fares.mini.estimatedFare);
        expect(fares.mini.estimatedFare).toBeLessThan(fares.sedan.estimatedFare);
    });
});

describe('calculateRoute', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    it('returns dev fallback when GOOGLE_MAPS_API_KEY is not set', async () => {
        delete process.env.GOOGLE_MAPS_API_KEY;

        const result = await calculateRoute(
            { lat: 17.385, lng: 78.4867 },
            { lat: 17.434, lng: 78.384 }
        );

        expect(result.isDevelopmentFallback).toBe(true);
        expect(result.distanceKm).toBeGreaterThan(0);
        expect(result.devNote).toContain('GOOGLE_MAPS_API_KEY');
        // Ensure axios was NOT called (no real API call)
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('returns route data when Google Maps responds successfully', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

        axios.post.mockResolvedValue({
            data: {
                routes: [{
                    distanceMeters: 12500,
                    duration: '900s',
                    localizedValues: {}
                }]
            }
        });

        const result = await calculateRoute(
            { lat: 17.385, lng: 78.4867 },
            { lat: 17.434, lng: 78.384 }
        );

        expect(result.isDevelopmentFallback).toBe(false);
        expect(result.distanceKm).toBe(12.5);
        expect(result.durationMin).toBe(15);
        expect(result.distanceText).toBe('12.5 km');
    });

    it('throws descriptive error when no route found', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

        axios.post.mockResolvedValue({ data: { routes: [] } });

        await expect(
            calculateRoute({ lat: 0, lng: 0 }, { lat: 90, lng: 180 })
        ).rejects.toThrow('No route found');
    });

    it('throws Maps API error for non-2xx Google response', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

        const axiosError = new Error('Request failed');
        axiosError.response = {
            status: 400,
            data: { error: { message: 'API_KEY_INVALID' } }
        };
        axios.post.mockRejectedValue(axiosError);

        await expect(
            calculateRoute({ lat: 17.385, lng: 78.4867 }, { lat: 17.434, lng: 78.384 })
        ).rejects.toThrow('Maps API error: API_KEY_INVALID');
    });

    it('throws timeout error when request times out', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

        const timeoutError = new Error('timeout of 8000ms exceeded');
        timeoutError.code = 'ECONNABORTED';
        axios.post.mockRejectedValue(timeoutError);

        await expect(
            calculateRoute({ lat: 17.385, lng: 78.4867 }, { lat: 17.434, lng: 78.384 })
        ).rejects.toThrow('timed out');
    });

    it('throws for invalid location format', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

        await expect(
            calculateRoute(12345, { lat: 17.434, lng: 78.384 })
        ).rejects.toThrow('Invalid location format');
    });

    it('accepts string address as origin', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

        axios.post.mockResolvedValue({
            data: {
                routes: [{
                    distanceMeters: 5000,
                    duration: '600s',
                }]
            }
        });

        const result = await calculateRoute('Hitech City, Hyderabad', { lat: 17.434, lng: 78.384 });
        expect(result.distanceKm).toBe(5.0);

        // Verify the request body used address format
        const callBody = axios.post.mock.calls[0][1];
        expect(callBody.origin).toEqual({ address: 'Hitech City, Hyderabad' });
    });
});
