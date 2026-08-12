import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Clerk webhook functions removed — user management now handled by auth routes directly
export const functions = [];
