/**
 * Cache Service — cache-aside pattern helpers.
 *
 * Usage:
 *   const cached = await getCache('key');
 *   if (cached) return cached;
 *   const data = await fetchFromDB();
 *   await setCache('key', data, 600); // 10-min TTL
 *
 * All methods are safe to call even when Redis is unavailable:
 * they catch errors and return null so callers transparently
 * fall back to the database.
 */

import { getRedisClient, isRedisReady } from '../configs/redis.js';

/**
 * Retrieve a cached value.
 * @returns {Promise<any|null>} Parsed value, or null on miss/error.
 */
export const getCache = async (key) => {
    if (!isRedisReady()) {
        console.debug(`[Cache] SKIP (Redis not ready) — key="${key}"`);
        return null;
    }
    try {
        const redis = getRedisClient();
        const raw = await redis.get(key);
        if (raw === null) {
            console.debug(`[Cache] MISS — key="${key}"`);
            return null;
        }
        console.debug(`[Cache] HIT  — key="${key}"`);
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`[Cache] GET error for key="${key}":`, err.message);
        return null;
    }
};

/**
 * Store a value in the cache with an optional TTL.
 * @param {string} key
 * @param {any} value — will be JSON-serialized
 * @param {number} [ttlSeconds=300] — default 5 minutes
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
    if (!isRedisReady()) return;
    try {
        const redis = getRedisClient();
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        console.debug(`[Cache] SET  — key="${key}" ttl=${ttlSeconds}s`);
    } catch (err) {
        console.warn(`[Cache] SET error for key="${key}":`, err.message);
    }
};

/**
 * Delete a single cache entry.
 */
export const deleteCache = async (key) => {
    if (!isRedisReady()) return;
    try {
        const redis = getRedisClient();
        await redis.del(key);
        console.debug(`[Cache] DEL  — key="${key}"`);
    } catch (err) {
        console.warn(`[Cache] DEL error for key="${key}":`, err.message);
    }
};

/**
 * Delete all cache entries matching a glob pattern.
 * Iterates with SCAN to avoid blocking the Redis server.
 * @example deleteCachePattern('shows:movie:*')
 */
export const deleteCachePattern = async (pattern) => {
    if (!isRedisReady()) return;
    try {
        const redis = getRedisClient();
        let cursor = '0';
        let deleted = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
                deleted += keys.length;
            }
        } while (cursor !== '0');
        if (deleted > 0) {
            console.debug(`[Cache] PURGE — pattern="${pattern}" removed ${deleted} key(s)`);
        }
    } catch (err) {
        console.warn(`[Cache] PURGE error for pattern="${pattern}":`, err.message);
    }
};

// ─── Cache key helpers ────────────────────────────────────────────────────────
// Centralizing key strings prevents typos across routes.

export const CACHE_KEYS = {
    nowPlaying: (language) => `movies:now-playing:${language || 'all'}`,
    movieDetail: (id) => `movie:detail:${id}`,
    showsByMovie: (movieId) => `shows:movie:${movieId}`,
};

export const CACHE_TTL = {
    NOW_PLAYING: 10 * 60,  // 10 minutes — movie listings change infrequently
    MOVIE_DETAIL: 30 * 60, // 30 minutes — metadata is very stable
    SHOWS: 5 * 60,         // 5 minutes  — show schedule changes occasionally
};
