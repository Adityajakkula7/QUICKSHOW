/**
 * Queue Service — RabbitMQ integration using amqplib.
 *
 * WHY A MESSAGE QUEUE?
 * After a booking is confirmed, we need to:
 *   • Send confirmation email to user
 *   • Update analytics / reporting systems
 *   • Potentially trigger loyalty-point credits
 *
 * These are non-critical operations — the user doesn't need to wait for them.
 * If email delivery fails, we retry; we don't want the booking endpoint to
 * fail or slow down because the email server is temporarily unavailable.
 *
 * The booking transaction stays synchronous (validate → commit → respond).
 * Only AFTER the booking is committed do we fire the async event:
 *   booking confirmed → published to queue → worker picks it up → sends email
 *
 * GRACEFUL DEGRADATION:
 * If RabbitMQ is unavailable, publishEvent logs a warning and returns without
 * throwing. The booking still succeeds; notifications are simply not sent.
 */

import amqplib from 'amqplib';

const EXCHANGE_NAME = 'booking.events';
const EXCHANGE_TYPE = 'topic';

let connection = null;
let channel = null;
let isConnected = false;

/**
 * Connect to RabbitMQ and create a channel + exchange.
 * Called once at server startup. Safe to call multiple times (idempotent).
 */
export const connectQueue = async () => {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost';

    try {
        connection = await amqplib.connect(url);
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });
        isConnected = true;
        console.log('[Queue] Connected to RabbitMQ — exchange:', EXCHANGE_NAME);

        // Handle unexpected disconnections
        connection.on('error', (err) => {
            console.warn('[Queue] Connection error:', err.message);
            isConnected = false;
        });
        connection.on('close', () => {
            console.warn('[Queue] Connection closed');
            isConnected = false;
        });
    } catch (err) {
        isConnected = false;
        console.warn('[Queue] Could not connect to RabbitMQ:', err.message);
        console.warn('[Queue] Booking will succeed but async notifications are disabled');
    }
};

/**
 * Publish an event to the exchange.
 *
 * @param {string} routingKey  e.g. 'booking.confirmed', 'booking.cancelled'
 * @param {object} payload     JSON-serializable event data
 *
 * Fire-and-forget — never throws, never blocks the caller.
 */
export const publishEvent = (routingKey, payload) => {
    if (!isConnected || !channel) {
        console.warn(`[Queue] SKIP publish — not connected. Event: ${routingKey}`);
        return;
    }

    try {
        const message = Buffer.from(JSON.stringify({
            ...payload,
            _timestamp: new Date().toISOString(),
            _routingKey: routingKey,
        }));

        const published = channel.publish(EXCHANGE_NAME, routingKey, message, {
            persistent: true,          // Survive RabbitMQ restart
            contentType: 'application/json',
        });

        if (published) {
            console.log(`[Queue] Published — routingKey="${routingKey}" bookingId="${payload.bookingId}"`);
        } else {
            console.warn(`[Queue] Publish returned false (back-pressure) — routingKey="${routingKey}"`);
        }
    } catch (err) {
        console.warn(`[Queue] Publish error for "${routingKey}":`, err.message);
    }
};

export const isQueueConnected = () => isConnected;

export default { connectQueue, publishEvent, isQueueConnected };
