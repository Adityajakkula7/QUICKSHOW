/**
 * Notification Worker — RabbitMQ consumer
 *
 * Run this as a separate process:
 *   node workers/notificationWorker.js
 *
 * This worker listens for events published by the booking service and handles
 * non-critical async tasks that don't need to block the HTTP response:
 *   - Sending booking confirmation emails
 *   - Logging analytics events
 *   - Future: loyalty points, push notifications, etc.
 *
 * RETRY LOGIC:
 *   - On transient error: nack the message with requeue=true (will retry once)
 *   - On persistent error (3rd attempt): nack with requeue=false → dead-letter
 *   - The dead-letter exchange allows manual inspection/reprocessing
 *
 * NOTE: In production, replace the simulated email/analytics calls with real
 * integrations (e.g. SendGrid, Segment, Mixpanel, etc.)
 */

import 'dotenv/config';
import amqplib from 'amqplib';

const EXCHANGE_NAME = 'booking.events';
const QUEUE_NAME = 'notification.queue';
const DEAD_LETTER_EXCHANGE = 'booking.events.dlx';
const ROUTING_KEY = 'booking.confirmed';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ─── Simulated async tasks ────────────────────────────────────────────────────

const sendConfirmationEmail = async (booking) => {
    // TODO: Replace with real email provider (SendGrid, Nodemailer, etc.)
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate I/O
    console.log(`[Worker] 📧 Email sent to user=${booking.userId}`);
    console.log(`         Movie: ${booking.movieTitle}`);
    console.log(`         Seats: ${booking.bookedSeats?.join(', ')}`);
    console.log(`         Amount: ₹${booking.amount}`);
};

const logAnalyticsEvent = async (booking) => {
    // TODO: Replace with real analytics (Segment, Mixpanel, etc.)
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`[Worker] 📊 Analytics: BookingConfirmed bookingId=${booking.bookingId}`);
};

// ─── Message handler ──────────────────────────────────────────────────────────

const handleBookingConfirmed = async (payload, channel, msg) => {
    // Track retry count via message headers
    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0);

    try {
        console.log(`\n[Worker] ▶ Processing booking.confirmed (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        console.log(`         bookingId=${payload.bookingId}`);

        await sendConfirmationEmail(payload);
        await logAnalyticsEvent(payload);

        // Acknowledge — remove from queue
        channel.ack(msg);
        console.log(`[Worker] ✅ Processed bookingId=${payload.bookingId}`);
    } catch (err) {
        console.error(`[Worker] ❌ Error processing bookingId=${payload.bookingId}:`, err.message);

        if (retryCount < MAX_RETRIES - 1) {
            // Retry: re-publish with incremented retry count after delay
            console.log(`[Worker] 🔄 Retrying in ${RETRY_DELAY_MS}ms...`);
            channel.nack(msg, false, false); // nack, don't requeue (we'll republish manually)

            setTimeout(() => {
                channel.publish(EXCHANGE_NAME, ROUTING_KEY,
                    Buffer.from(JSON.stringify(payload)), {
                        persistent: true,
                        contentType: 'application/json',
                        headers: { 'x-retry-count': retryCount + 1 }
                    }
                );
            }, RETRY_DELAY_MS);
        } else {
            // Max retries reached — send to dead-letter queue for manual inspection
            console.warn(`[Worker] ☠️  Max retries reached for bookingId=${payload.bookingId} — sending to DLX`);
            channel.nack(msg, false, false); // nack without requeue → goes to DLX
        }
    }
};

// ─── Worker startup ───────────────────────────────────────────────────────────

const startWorker = async () => {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost';
    let retries = 0;
    const maxStartRetries = 10;

    while (retries < maxStartRetries) {
        try {
            console.log(`[Worker] Connecting to RabbitMQ at ${url}...`);
            const connection = await amqplib.connect(url);
            const channel = await connection.createChannel();

            // Dead-letter exchange for failed messages
            await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'topic', { durable: true });
            await channel.assertQueue('dead.letter.queue', {
                durable: true,
                arguments: { 'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE }
            });
            await channel.bindQueue('dead.letter.queue', DEAD_LETTER_EXCHANGE, '#');

            // Main exchange and queue
            await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
            await channel.assertQueue(QUEUE_NAME, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
                    'x-dead-letter-routing-key': 'dead.booking.confirmed'
                }
            });
            await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

            // Process one message at a time (prefetch=1)
            channel.prefetch(1);

            console.log(`[Worker] 🐰 Listening on exchange="${EXCHANGE_NAME}" queue="${QUEUE_NAME}"`);
            console.log(`[Worker] Waiting for booking.confirmed events...\n`);

            channel.consume(QUEUE_NAME, async (msg) => {
                if (!msg) return;
                try {
                    const payload = JSON.parse(msg.content.toString());
                    await handleBookingConfirmed(payload, channel, msg);
                } catch (parseErr) {
                    console.error('[Worker] Could not parse message:', parseErr.message);
                    channel.nack(msg, false, false); // dead-letter unparseable messages
                }
            });

            connection.on('error', (err) => {
                console.error('[Worker] Connection error:', err.message);
                process.exit(1); // Let process manager (PM2/Docker) restart
            });

            connection.on('close', () => {
                console.warn('[Worker] Connection closed — exiting for restart');
                process.exit(1);
            });

            return; // Successfully connected
        } catch (err) {
            retries++;
            console.warn(`[Worker] Could not connect (attempt ${retries}/${maxStartRetries}): ${err.message}`);
            if (retries < maxStartRetries) {
                console.log(`[Worker] Retrying in 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            } else {
                console.error('[Worker] Failed to connect after max retries. Exiting.');
                process.exit(1);
            }
        }
    }
};

startWorker();
