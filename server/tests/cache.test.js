/**
 * Cache Service Tests
 *
 * Tests the cache-aside pattern including:
 * - Cache hit returns data without hitting source
 * - Cache miss fetches from source and populates cache
 * - Redis unavailable gracefully falls back to null
 * - TTL and key generation helpers work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock ioredis before importing cacheService ───────────────────────────────
vi.mock('../configs/redis.js', () => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockDel = vi.fn();
    const mockScan = vi.fn();

    const mockClient = { get: mockGet, set: mockSet, del: mockDel, scan: mockScan };

    return {
        getRedisClient: () => mockClient,
        isRedisReady: vi.fn(() => true),
        __mockClient: mockClient,
        __mockIsReady: vi.fn(() => true),
    };
});

import { getCache, setCache, deleteCache, CACHE_KEYS, CACHE_TTL } from '../services/cacheService.js';
import * as redisConfig from '../configs/redis.js';

describe('Cache Service', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = redisConfig.getRedisClient();
        vi.clearAllMocks();
        // Default: Redis is ready
        vi.mocked(redisConfig.isRedisReady).mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─── getCache ─────────────────────────────────────────────────────────────

    describe('getCache', () => {
        it('returns null on cache MISS', async () => {
            mockClient.get.mockResolvedValue(null);
            const result = await getCache('movies:now-playing:all');
            expect(result).toBeNull();
            expect(mockClient.get).toHaveBeenCalledWith('movies:now-playing:all');
        });

        it('returns parsed data on cache HIT', async () => {
            const cached = [{ id: 1, title: 'Test Movie' }];
            mockClient.get.mockResolvedValue(JSON.stringify(cached));
            const result = await getCache('movies:now-playing:all');
            expect(result).toEqual(cached);
        });

        it('returns null when Redis is not ready (graceful fallback)', async () => {
            vi.mocked(redisConfig.isRedisReady).mockReturnValue(false);
            const result = await getCache('some-key');
            expect(result).toBeNull();
            expect(mockClient.get).not.toHaveBeenCalled(); // should not attempt Redis call
        });

        it('returns null when Redis throws an error (graceful fallback)', async () => {
            mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));
            const result = await getCache('some-key');
            expect(result).toBeNull(); // does not throw
        });
    });

    // ─── setCache ─────────────────────────────────────────────────────────────

    describe('setCache', () => {
        it('stores value with correct TTL', async () => {
            mockClient.set.mockResolvedValue('OK');
            const data = [{ id: 1 }];
            await setCache('movies:now-playing:all', data, 600);

            expect(mockClient.set).toHaveBeenCalledWith(
                'movies:now-playing:all',
                JSON.stringify(data),
                'EX',
                600
            );
        });

        it('does nothing when Redis is not ready', async () => {
            vi.mocked(redisConfig.isRedisReady).mockReturnValue(false);
            await setCache('some-key', { x: 1 });
            expect(mockClient.set).not.toHaveBeenCalled();
        });

        it('does not throw when Redis errors', async () => {
            mockClient.set.mockRejectedValue(new Error('Redis unavailable'));
            await expect(setCache('key', 'value')).resolves.toBeUndefined();
        });
    });

    // ─── CACHE_KEYS helpers ───────────────────────────────────────────────────

    describe('CACHE_KEYS', () => {
        it('generates correct now-playing key for a language', () => {
            expect(CACHE_KEYS.nowPlaying('en')).toBe('movies:now-playing:en');
            expect(CACHE_KEYS.nowPlaying('all')).toBe('movies:now-playing:all');
            expect(CACHE_KEYS.nowPlaying(undefined)).toBe('movies:now-playing:all');
        });

        it('generates correct movie detail key', () => {
            expect(CACHE_KEYS.movieDetail('12345')).toBe('movie:detail:12345');
        });

        it('generates correct shows key', () => {
            expect(CACHE_KEYS.showsByMovie('789')).toBe('shows:movie:789');
        });
    });

    // ─── CACHE_TTL values ─────────────────────────────────────────────────────

    describe('CACHE_TTL', () => {
        it('has sensible TTL values', () => {
            expect(CACHE_TTL.NOW_PLAYING).toBe(600);  // 10 minutes
            expect(CACHE_TTL.MOVIE_DETAIL).toBe(1800); // 30 minutes
            expect(CACHE_TTL.SHOWS).toBe(300);          // 5 minutes
        });
    });

    // ─── deleteCache ──────────────────────────────────────────────────────────

    describe('deleteCache', () => {
        it('calls redis del with the correct key', async () => {
            mockClient.del.mockResolvedValue(1);
            await deleteCache('shows:movie:123');
            expect(mockClient.del).toHaveBeenCalledWith('shows:movie:123');
        });

        it('does not throw when Redis errors', async () => {
            mockClient.del.mockRejectedValue(new Error('Redis error'));
            await expect(deleteCache('key')).resolves.toBeUndefined();
        });
    });
});
