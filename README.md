# QuickShow 🎟️

QuickShow is a modern, high-performance web application for movie ticket booking. It features real-time movie listings fetched from the TMDB API, dynamic interactive seat layout selection, a temporary seat-locking system to prevent double-booking, Stripe payment integration, Clerk user authentication, and a dashboard for managing bookings and showtimes.

---

## 🚀 Key Features

*   **Real-time Movie Explorer**: Interactive listings of now-playing movies with detailed views including rating, runtime, genre, cast members, and trailer support.
*   **Dynamic Seat Selection & Lock**:
    *   Sleek seat grid showing available, selected, temporarily locked, and booked seats.
    *   **Seat Lock Mechanism**: When a user clicks "Proceed to Checkout", the selected seats are temporarily locked for 10 minutes (using pending/unpaid booking records).
    *   **Double-Booking Prevention**: Backend verification checks seat availability during Stripe session creation. If a seat gets locked by another user in the interim, the transaction is rejected, the user selection is cleared, and the UI updates dynamically.
*   **Stripe Payments**: Safe checkout flow with Stripe webhooks/verification updating seat bookings to fully occupied on successful payment.
*   **Clerk Authentication**: Seamless, secure authentication syncing users to MongoDB in the background using **Inngest** webhooks.
*   **Transit/Cab Booker & Maps**: Integrated mapping service using OpenStreetMap & Leaflet to book rides directly to the theatre once tickets are secured.

---

## 🔍 Architecture Notes: Live Integrations vs. Mock Components

When developing or extending this application, keep in mind how the client and server components are separated:

### 1. Fully Integrated Live Flows (Connected to MongoDB)
The client-facing seat booking and movie exploration flows are fully functional and connected to the live Node/Express database endpoints:
*   **Authentication**: Clerk accounts are synced to the MongoDB `User` model automatically in the background using [Inngest Functions](file:///c:/QUICKSHOW/server/inngest/index.js) triggering on Clerk webhook events (`user.created`, `user.updated`, `user.deleted`).
*   **Movies**: Movie data is fetched in real-time from the TMDB API using a backend router with query retries in [movieRoutes.js](file:///c:/QUICKSHOW/server/routes/movieRoutes.js).
*   **Seat Locks & Checkouts**: Checked and verified in the database on checkout initiation. Unpaid bookings serve as 10-minute locks, preventing other clients from checking out the same seats.
*   **Verification**: Upon successful Stripe payment, the client redirects to the `/my-bookings` verification endpoint, changing the booking record status from unpaid to paid (`isPaid: true`) and finalizing seat occupation.

### 2. Client-Side External Integrations (No Custom Backend)
Some user features are handled completely on the frontend for simplicity and serverless compliance:
*   **Theatre Discovery**: Fetched directly from the **OSM Nominatim API** (`https://nominatim.openstreetmap.org/search`) using local coordinates ± `0.18` degrees to target nearby theaters.
*   **Haversine Distance Filter**: Calculated client-side using the Haversine formula to ensure only cinemas strictly within a **20km radius** are kept.
*   **Route Routing Engine**: Uses the **OSRM Route API** (`https://router.project-osrm.org/route/v1/driving/`) on the client to retrieve geometry coordinates representing driving routes. The route is rendered as a polyline directly on the Leaflet map container.
*   **OTP Verification**: The 6-digit OTP code shown during the ride confirmation is **simulated entirely on the frontend** via `Math.random()`. No backend storage or SMS gateway is used; it matches a local mock driver (e.g., *Ravi Kumar*, *Suresh Babu*) and estimates an ETA based on the calculated driving distance.

### 3. Static Admin Mock Components (Design-Only Mockups)
The Admin Dashboard routes located at `/admin` (mapped in [App.jsx](file:///c:/QUICKSHOW/client/src/App.jsx) to [Layout.jsx](file:///c:/QUICKSHOW/client/src/pages/admin/Layout.jsx)) are **static mock UI pages**. 
*   **Dashboard Statistics**, [AddShows.jsx](file:///c:/QUICKSHOW/client/src/pages/admin/AddShows.jsx), [ListShows.jsx](file:///c:/QUICKSHOW/client/src/pages/admin/ListShows.jsx), and [ListBookings.jsx](file:///c:/QUICKSHOW/client/src/pages/admin/ListBookings.jsx) read from client-side local assets/dummy data arrays (`dummyShowsData`, `dummyBookingData`) and do not submit or retrieve records to/from the live Express Mongo server APIs. These pages can be wired to the backend `/api/shows` and `/api/bookings` routes for full administration capability.

---

## 🛠️ Tech Stack

### Frontend (Client)
*   **Core**: React (v19) & Vite
*   **Styling**: Tailwind CSS (v4)
*   **Icons**: Lucide React
*   **Routing**: React Router DOM (v7) — configuration in [App.jsx](file:///c:/QUICKSHOW/client/src/App.jsx)
*   **Auth**: Clerk React (`@clerk/clerk-react`)
*   **Payments**: Stripe JS (`@stripe/stripe-js`)
*   **Maps & Geolocation**: Leaflet & React Leaflet (for transit mapping in [Transport.jsx](file:///c:/QUICKSHOW/client/src/pages/Transport.jsx))
*   **State & Notifications**: React Hot Toast

### Backend (Server)
*   **Framework**: Express.js (Node.js ES modules) — configurations in [server.js](file:///c:/QUICKSHOW/server/server.js) & [index.js](file:///c:/QUICKSHOW/server/api/index.js)
*   **Database**: MongoDB & Mongoose — setup in [db.js](file:///c:/QUICKSHOW/server/configs/db.js)
*   **Background Jobs**: Inngest (handles webhook syncing for user data in [index.js](file:///c:/QUICKSHOW/server/inngest/index.js))
*   **Auth Middleware**: `@clerk/express`
*   **Payments**: Stripe Node SDK

---

## 📁 Project Structure

*   [client/](file:///c:/QUICKSHOW/client) — Frontend React Application
    *   [client/src/](file:///c:/QUICKSHOW/client/src) — App Source Code
        *   [client/src/components/](file:///c:/QUICKSHOW/client/src/components) — Reusable layout and helper components
        *   [client/src/pages/](file:///c:/QUICKSHOW/client/src/pages) — View Pages (e.g. [MovieDetails.jsx](file:///c:/QUICKSHOW/client/src/pages/MovieDetails.jsx), [SeatLayout.jsx](file:///c:/QUICKSHOW/client/src/pages/SeatLayout.jsx), [Transport.jsx](file:///c:/QUICKSHOW/client/src/pages/Transport.jsx))
        *   [client/src/App.jsx](file:///c:/QUICKSHOW/client/src/App.jsx) — Main router configuration
        *   [client/src/main.jsx](file:///c:/QUICKSHOW/client/src/main.jsx) — App entry point
    *   [client/package.json](file:///c:/QUICKSHOW/client/package.json) — Frontend dependencies
*   [server/](file:///c:/QUICKSHOW/server) — Backend Node/Express API
    *   [server/api/index.js](file:///c:/QUICKSHOW/server/api/index.js) — Serverless routing entry point
    *   [server/configs/db.js](file:///c:/QUICKSHOW/server/configs/db.js) — Database connection configuration
    *   [server/inngest/index.js](file:///c:/QUICKSHOW/server/inngest/index.js) — Inngest background sync jobs
    *   [server/models/](file:///c:/QUICKSHOW/server/models) — Mongoose schemas: [Booking.js](file:///c:/QUICKSHOW/server/models/Booking.js), [Show.js](file:///c:/QUICKSHOW/server/models/Show.js), [User.js](file:///c:/QUICKSHOW/server/models/User.js)
    *   [server/routes/](file:///c:/QUICKSHOW/server/routes) — Express route handlers: [movieRoutes.js](file:///c:/QUICKSHOW/server/routes/movieRoutes.js), [bookingRoutes.js](file:///c:/QUICKSHOW/server/routes/bookingRoutes.js), [showRoutes.js](file:///c:/QUICKSHOW/server/routes/showRoutes.js)
    *   [server/server.js](file:///c:/QUICKSHOW/server/server.js) — Main entry point for local server execution
    *   [server/package.json](file:///c:/QUICKSHOW/server/package.json) — Backend dependencies

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the `/server` directory and a `.env` file in the `/client` directory based on the following configurations:

### Server Environment (`server/.env`)
```env
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173
TMDB_API_KEY=your_tmdb_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key

# Clerk Keys (Syncing Webhooks)
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### Client Environment (`client/.env`)
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_CURRENCY=₹
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## 🏃 Getting Started

### Prerequisites
*   Node.js (v18+)
*   NPM or Yarn
*   A running MongoDB instance (or Atlas)

### Step 1: Install Dependencies
Run the installation command in both the `client` and `server` directories.

```bash
# For Client
cd client
npm install

# For Server
cd ../server
npm install
```

### Step 2: Start Development Servers
Run the development command in separate terminal sessions or run them in parallel.

```bash
# Start Backend (runs on port 3000)
cd server
npm run dev

# Start Frontend (runs on port 5173)
cd client
npm run dev
```

---

## 🛰️ Key API Endpoints

### Movie Routes ([movieRoutes.js](file:///c:/QUICKSHOW/server/routes/movieRoutes.js))
*   `GET /now-playing` - Returns the currently showing movies list (filtered optionally by language).
*   `GET /:id` - Fetches detailed TMDB metadata and cast information for a specific movie.

### Booking Routes ([bookingRoutes.js](file:///c:/QUICKSHOW/server/routes/bookingRoutes.js))
*   `GET /seats-status` - Returns list of occupied (paid) and locked (unpaid, < 10 mins) seat IDs.
*   `POST /create-checkout-session` - Validates seat availability, initiates a temporary seat lock, and generates a Stripe payment session.
*   `GET /verify/:bookingId` - Confirms and marks the booking as paid (`isPaid: true`), finalizing the seat occupancy.
*   `GET /user/:userId` - Returns all booking histories for a logged-in user.

### Show Routes ([showRoutes.js](file:///c:/QUICKSHOW/server/routes/showRoutes.js))
*   `GET /:movieId` - Returns dates/timings of active shows for a movie.
*   `POST /add` - Admin route to create new show records.
