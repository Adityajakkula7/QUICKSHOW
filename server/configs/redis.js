/**
 * Redis client singleton using ioredis.
 * Reads REDIS_URL from environment variables.
 * Falls back gracefully — if Redis is unavailable, all cache operations
 * will return null and the application continues using the database.
 */

import Redis from 'ioredis';

let client = null;
let isReady = false;

const createRedisClient = () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const redisClient = new Redis(redisUrl, {
        // Don't throw on failed reconnects — let cacheService handle null
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            // Give up after 3 attempts; cacheService will fall back to DB
            if (times > 3) {
                console.warn('[Redis] Max reconnect attempts reached — running without cache');
                return null; // stop retrying
            }
            return Math.min(times * 500, 2000);
        },
    });

    redisClient.on('connect', () => {
        isReady = true;
        console.log('[Redis] Connected successfully');
    });

    redisClient.on('ready', () => {
        isReady = true;
        console.log('[Redis] Ready to accept commands');
    });

    redisClient.on('error', (err) => {
        isReady = false;
        // Log only unique errors to avoid spam
        if (!err.message?.includes('ECONNREFUSED') || Math.random() < 0.05) {
            console.warn('[Redis] Connection error:', err.message);
        }
    });

    redisClient.on('close', () => {
        isReady = false;
    });

    redisClient.on('reconnecting', () => {
        console.log('[Redis] Attempting to reconnect...');
    });

    return redisClient;
};

export const getRedisClient = () => {
    if (!client) {
        client = createRedisClient();
        // Attempt connection — don't await, let it connect in background
        client.connect().catch(() => {
            // Silently ignore initial connection failure
            // The retryStrategy and error handler will log appropriately
        });
    }
    return client;
};

export const isRedisReady = () => isReady;

export default getRedisClient;
