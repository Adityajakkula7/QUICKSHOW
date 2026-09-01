# QuickShow 🎟️

> **Full-stack movie ticket booking platform** — React 19 · Vite · Tailwind CSS v4 · Express.js · MongoDB · Stripe · JWT/bcrypt · Redis · RabbitMQ · Google Maps

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Folder Structure](#4-folder-structure)
5. [Database Design](#5-database-design)
6. [Feature Deep Dives](#6-feature-deep-dives)
   - [Seat Locking & Concurrency](#61-seat-locking--concurrency)
   - [Redis Caching](#62-redis-caching)
   - [Stripe Payment Flow](#63-stripe-payment-flow)
   - [RabbitMQ Async Notifications](#64-rabbitmq-async-notifications)
   - [JWT + bcrypt Authentication](#65-jwt--bcrypt-authentication)
   - [TMDB API Integration](#66-tmdb-api-integration)
   - [Transport & Maps](#67-transport--maps)
7. [API Reference](#7-api-reference)
8. [Environment Variables](#8-environment-variables)
9. [Local Setup](#9-local-setup)
10. [Service Setup Guides](#10-service-setup-guides)
11. [Deployment](#11-deployment)
12. [Testing](#12-testing)
13. [Admin Dashboard](#13-admin-dashboard)
14. [User Flows](#14-user-flows)
15. [Interview Q&A](#15-interview-qa)

---

## 1. Project Overview

QuickShow is a **production-grade movie ticket booking web application** that simulates a real cinema platform end-to-end.

### Core Problems Solved

| Problem | Solution |
|---------|----------|
| **Double-booking / concurrency** | Atomic `findOneAndUpdate` + 10-min pending-booking lock pattern |
| **Stale movie data** | Real-time TMDB API proxy with retry logic |
| **Slow repeated reads** | Redis cache-aside for movie/show data (never for seat availability) |
| **Blocking async tasks** | RabbitMQ fire-and-forget for post-payment emails/analytics |
| **API key exposure** | Google Maps API key is server-side only; never in frontend bundle |
| **Seamless authentication** | Custom JWT + bcrypt — no vendor lock-in |
| **Last-mile transport** | Cab booking with maps integration directly in the platform |

### Architecture Classification

| Tier | Description | Status |
|------|-------------|--------|
| **Fully Integrated Live Flows** | Auth (JWT+bcrypt→MongoDB), Movie API (TMDB), Seat Locks & Checkout (Booking model), Payment (Stripe) | ✅ Live |
| **Backend-Proxied Services** | Google Maps Routes API (server-side key), TMDB (server-side key), Stripe | ✅ Live |
| **Client-Side External APIs** | OpenStreetMap tile rendering, Leaflet map display | ✅ Live |
| **Async Infrastructure** | Redis caching, RabbitMQ notifications | ✅ Live (optional) |
| **Static Admin Mockups** | Dashboard, AddShows, ListShows, ListBookings use dummy data | 🔧 Mock UI |

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | v19.1 | UI library — functional components, hooks |
| Vite | v6.3 | Build tool — HMR, ES module bundling |
| Tailwind CSS | v4.1 | Utility-first styling via `@tailwindcss/vite` plugin |
| React Router DOM | v7.6 | Client-side routing — nested routes, params |
| Leaflet + React Leaflet | 1.9 / 5.0 | Interactive maps, markers, polyline routes |
| React Player | v2.16 | Embed YouTube trailers |
| Lucide React | v0.515 | SVG icon library |
| React Hot Toast | v2.5 | Notification toasts |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | v18+ | JavaScript runtime |
| Express.js | v5.1 | HTTP framework |
| MongoDB + Mongoose | v8.15 | NoSQL database with schema-based ODM |
| ioredis | v5 | Redis client for caching |
| amqplib | v0.10 | RabbitMQ AMQP client |
| Stripe SDK | v20.4 | Checkout session creation, payment verification |
| bcryptjs | v2.4 | Password hashing — salt + hash |
| jsonwebtoken | v9.0 | JWT signing and verification |
| Axios | v1.13 | HTTP client for TMDB and Google Maps API calls |
| Vitest | v4.1 | Unit test framework |

### External APIs / Services

| API | Used For | Called From |
|-----|----------|-------------|
| TMDB (The Movie Database) | Now-playing movies, details, cast, genres | Server (proxied, key hidden) |
| Stripe Checkout | Hosted payment page, session creation | Server → client redirect |
| Google Maps Routes API | Driving distance + duration for transport feature | Server (key hidden) |
| OpenStreetMap | Map tile rendering | Client (free, no key needed) |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Vite)                            │
│  Home │ Movies │ MovieDetails │ SeatLayout │ MyBookings │ Transport  │
│  Login │ Register │ Admin (mock)                                     │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ HTTPS / REST (JSON)
┌──────────────────────▼───────────────────────────────────────────────┐
│                    EXPRESS SERVER (Node.js ESM)                      │
│                                                                      │
│  Middleware: express.json() → cors() → authMiddleware (per-route)   │
│                                                                      │
│  /api/auth        JWT auth (register, login, /me)                   │
│  /api/movies      TMDB proxy           ──► Redis Cache              │
│  /api/shows       Show schedule        ──► Redis Cache              │
│  /api/bookings    Seat booking         ──► MongoDB (atomic)         │
│  /api/transport   Maps proxy + fares   ──► Google Maps Routes API   │
│  /api/inngest     Inngest webhook                                    │
└──────┬───────────────────┬───────────────────────┬──────────────────┘
       │                   │                       │
  ┌────▼────┐         ┌────▼────┐           ┌──────▼──────┐
  │ MongoDB │         │  Redis  │           │  RabbitMQ   │
  │  Atlas  │         │  Cache  │           │   Queue     │
  └─────────┘         └─────────┘           └──────┬──────┘
                                                   │
                                        ┌──────────▼──────────┐
                                        │ notificationWorker  │
                                        │  (separate process) │
                                        │  email + analytics  │
                                        └─────────────────────┘
```

### Dual Entry Points (Local vs Vercel)

| | `server.js` (Local) | `api/index.js` (Vercel) |
|-|---------------------|-------------------------|
| DB connect | Once at startup (`startServer()`) | Per-request middleware (cached via `isConnected` flag) |
| Port | `app.listen(3000)` | N/A — Vercel wraps it |
| Redis/Queue | Init on startup | Redis init per-request; Queue skipped (stateless) |
| Guard | `if (!process.env.VERCEL)` | Always exported as `default` |

---

## 4. Folder Structure

```
QUICKSHOW/
├── .gitignore                    # Ignores node_modules, .env files
├── README.md
├── QuickShow_Complete_Guide.html # Detailed HTML reference guide
│
├── client/                       # ── Frontend React Application ──
│   ├── index.html                # HTML entry (title, favicon, root div)
│   ├── package.json
│   ├── vite.config.js            # React + Tailwind plugins
│   ├── vercel.json               # SPA catch-all rewrite for Vercel
│   ├── .env                      # VITE_BACKEND_URL, VITE_CURRENCY
│   ├── .env.example
│   └── src/
│       ├── main.jsx              # Entry → AuthProvider → BrowserRouter → App
│       ├── App.jsx               # Root → Routes + conditional Navbar/Footer
│       ├── index.css             # Tailwind @import, @theme custom colors, fonts
│       ├── assets/
│       │   └── assets.js         # Exports: dummyTrailers, dummyShowsData, dummyDashboardData
│       ├── lib/
│       │   ├── dateFormat.js     # toLocaleString with weekday/month/day/hour/minute
│       │   ├── isoTimeFormat.js  # ISO string → "HH:MM AM/PM"
│       │   ├── timeFormat.js     # minutes → "Xh Ym"
│       │   └── kconvetor.js      # number → "X.Xk"
│       ├── components/
│       │   ├── Navbar.jsx        # Fixed top nav — JWT login/avatar dropdown, mobile menu
│       │   ├── Footer.jsx
│       │   ├── HeroSection.jsx
│       │   ├── FeaturedSection.jsx # "Now Showing" grid
│       │   ├── TrailerSection.jsx  # ReactPlayer carousel
│       │   ├── MovieCard.jsx
│       │   ├── DateSelect.jsx    # Date picker → navigate to SeatLayout
│       │   ├── Blurcircle.jsx    # Decorative blurred glow circle
│       │   ├── Loading.jsx       # Spinner animation
│       │   └── admin/
│       │       ├── AdminNavbar.jsx
│       │       ├── AdminSidebar.jsx  # NavLink active highlighting
│       │       └── Title.jsx
│       └── pages/
│           ├── Home.jsx          # Composes Hero + Featured + Trailer sections
│           ├── Movies.jsx        # Grid with language filter
│           ├── MovieDetails.jsx  # Poster, cast, DateSelect
│           ├── SeatLayout.jsx    # ★ CORE: Seat grid, time selector, checkout
│           ├── MyBookings.jsx    # Booking history + payment verify on redirect
│           ├── Transport.jsx     # ★ UPGRADED: Backend proxy, maps, fare estimate
│           ├── Login.jsx         # JWT login page
│           ├── Register.jsx      # JWT register page
│           ├── Favorite.jsx
│           ├── Releases.jsx
│           └── admin/
│               ├── Layout.jsx    # AdminNavbar + AdminSidebar + Outlet
│               ├── Dashboard.jsx # Stats cards (dummy data)
│               ├── AddShows.jsx
│               ├── ListShows.jsx
│               └── ListBookings.jsx
│
└── server/                       # ── Backend Node/Express API ──
    ├── package.json
    ├── vercel.json               # Rewrite all to /api/index
    ├── .env                      # All secrets (never committed)
    ├── .env.example              # Placeholder template
    ├── server.js                 # Local dev entry — middleware, routes, listen :3000
    ├── api/
    │   └── index.js              # Vercel serverless entry
    ├── configs/
    │   ├── db.js                 # MongoDB singleton (isConnected flag)
    │   └── redis.js              # ioredis singleton (lazyConnect, retryStrategy)
    ├── models/
    │   ├── User.js               # {name, email, password (bcrypt hash), image}
    │   ├── Show.js               # {movie, showDateTime, showPrice, occupiedSeats} + compound index
    │   └── Booking.js            # {user, movie, bookedSeats, isPaid, createdAt} ★ dual-purpose
    ├── routes/
    │   ├── authRoutes.js         # POST /register, POST /login, GET /me
    │   ├── movieRoutes.js        # GET /now-playing, GET /:id — TMDB proxy + Redis cache
    │   ├── showRoutes.js         # GET /:movieId, POST /add — Redis cache + invalidation
    │   ├── bookingRoutes.js      # ★ Atomic seat claim, Stripe, verify + queue publish
    │   └── transportRoutes.js   # GET /theatres, POST /route — Maps proxy
    ├── services/
    │   ├── cacheService.js       # Cache-aside helpers: getCache, setCache, deleteCache
    │   ├── queueService.js       # RabbitMQ connect + publishEvent (fire-and-forget)
    │   └── mapsService.js        # Google Maps Routes API + fare estimation
    ├── workers/
    │   └── notificationWorker.js # RabbitMQ consumer — email + analytics (retry + DLQ)
    ├── inngest/
    │   └── index.js              # Inngest client (skeleton, extensible)
    └── tests/
        ├── cache.test.js         # 13 tests — cache hit/miss, TTL, Redis fallback
        ├── transport.test.js     # 15 tests — fare calc, Google API, dev fallback
        └── booking.test.js       # 7 tests  — event publish, concurrency, validation
```

---

## 5. Database Design

### User Model

```js
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }, // bcrypt hash — never plaintext
  image:    { type: String, default: '...' }  // default avatar URL
})
```

### Show Model

```js
const showSchema = new mongoose.Schema({
  movie:         { type: Number, required: true },  // TMDB movie ID
  showDateTime:  { type: Date, required: true },
  showPrice:     { type: Number, required: true },
  occupiedSeats: { type: Object, default: {} },     // seatId → bookingId map
  totalSeats:    { type: Number, default: 90 }
})
// Compound index for atomic seat claim queries
showSchema.index({ movie: 1, showDateTime: 1 })
```

### Booking Model ★ (The Concurrency Key)

```js
const bookingSchema = new mongoose.Schema({
  user:         { type: String, required: true },  // MongoDB User ObjectId
  movie:        { type: Number, required: true },  // TMDB movie ID
  movieTitle:   { type: String, required: true },
  moviePoster:  { type: String },
  showDateTime: { type: Date, required: true },
  bookedSeats:  { type: Array, required: true },   // ["A1", "A2", "B3"]
  amount:       { type: Number, required: true },
  isPaid:       { type: Boolean, default: false },  // ★ false = lock, true = ticket
}, { timestamps: true })  // ★ createdAt used for 10-min lock expiry
```

> **The Dual-Purpose Booking Record**: A booking with `isPaid: false` is a **temporary seat lock**. `createdAt` determines when it expires. After payment, `isPaid` becomes `true` — no data movement needed.

### ER Diagram

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│     User     │        │     Booking      │        │     Show     │
│──────────────│        │──────────────────│        │──────────────│
│ _id (ObjId)  │◄──┐    │ _id (ObjectId)   │   ┌──►│ _id (ObjId)  │
│ name         │   │    │ user (String) ───┘   │   │ movie (Num)  │
│ email        │   │    │ movie (Number)        │   │ showDateTime │
│ password     │   │    │ movieTitle            │   │ showPrice    │
│ image        │   │    │ showDateTime ─────────┘   │ occupiedSeats│
└──────────────┘   │    │ bookedSeats []            └──────────────┘
                   │    │ amount
              /api/auth │ isPaid ★
                   │    │ createdAt ★
                   │    └──────────────────┘
                   │
                 JWT token
```

---

## 6. Feature Deep Dives

### 6.1 Seat Locking & Concurrency

> **This is the #1 interview topic for this project.**

**The Problem**: User A selects seat A1 at 10:00:00. User B selects A1 at 10:00:05. Both reach Stripe checkout. Without a lock, both could pay successfully — a double-booking.

**Three Seat States**:

| State | Visual | Condition |
|-------|--------|-----------|
| **Available** | Outlined border, hover effect | No booking, or only expired unpaid records |
| **Locked** | Amber colour, disabled | Unpaid booking `createdAt > (now - 10 min)` |
| **Occupied** | Red colour, disabled | `isPaid: true` |

**How It Works (step by step)**:

```
Step 1: GET /seats-status
  → Query Booking collection for this show
  → isPaid=true → occupiedSeats
  → isPaid=false AND createdAt > tenMinutesAgo → lockedSeats
  → isPaid=false AND createdAt <= tenMinutesAgo → expired, ignored

Step 2: POST /create-checkout-session (user clicks checkout)
  A) Re-verify availability at checkout time (not just at seat selection)
  B) If any seat is taken/locked → 409 Conflict
  C) findOneAndUpdate with ATOMIC SEAT CLAIM:
     Query: show._id + each seat $exists: false  ← concurrency guard
     Update: $set each seat to 'pending'
     If null returned → another request beat us → 409
  D) Booking.create({ isPaid: false })  ← THIS IS THE LOCK
  E) Update Show's occupiedSeats with actual bookingId
  F) stripe.checkout.sessions.create() → return session.url

Step 3: User pays on Stripe → redirects to /my-bookings?success=true&bookingId=X

Step 4: GET /verify/:bookingId
  → findByIdAndUpdate(id, { isPaid: true })  ← LOCK BECOMES PERMANENT
  → publishEvent('booking.confirmed', ...)   ← async, fire-and-forget
```

**Timing Diagram**:

```
Time ─────────────────────────────────────────────────────────►

User A:  [Select A1] ──► [Checkout] ──► [Booking: isPaid=false]
                                         │  (A1 LOCKED for 10 min)
                                    [Stripe payment...]
                                         │
User B:       [Select A1] ──► [Checkout]─┤
                                 │       │
                          [409: A1       │
                           is locked]   │
                                    [Payment SUCCESS]
                                         │
                              [/verify/:id → isPaid=true]
                              (A1 now PERMANENTLY OCCUPIED)
```

**Lock Expiry — No cron job needed**: The expiry is computed at read-time using `const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)`. Expired locks are passively ignored, no cleanup infrastructure required.

**Why not a separate Lock collection?** The Booking record serves dual purposes — lock when `isPaid: false`, permanent ticket when `isPaid: true`. A single `findByIdAndUpdate(id, {isPaid: true})` finalises it.

---

### 6.2 Redis Caching

**Cache-Aside Pattern** — check Redis first, fall back to DB/API on miss, then populate cache.

```
Client Request
     │
     ▼
getCache(key) from Redis
     ├── HIT  → return cached data ──────────────────────► Response ✓ (~2ms)
     └── MISS → fetch from TMDB / MongoDB
                     │
                     ▼
               setCache(key, data, TTL)  ← populate for next request
                     │
                     ▼
               Response ✓ (~200-500ms)
```

**Cache Keys & TTLs**:

| Key Pattern | TTL | Reason |
|-------------|-----|--------|
| `movies:now-playing:{lang}` | 10 min | TMDB updates infrequently |
| `movie:detail:{id}` | 30 min | Very stable metadata |
| `shows:movie:{movieId}` | 5 min | Admins occasionally add shows |

**What is NEVER cached**:

> `GET /api/bookings/seats-status` — **always reads from primary DB**. Stale seat data → user selects an already-booked seat → fails at checkout. The database is the only source of truth for availability.

**Graceful degradation**: If Redis is down, `getCache()` returns `null` and the app falls back to direct DB/TMDB reads. The user experience is slower but fully functional. Watch for `[Cache] SKIP (Redis not ready)` in server logs.

**Cache invalidation**: When a new show is added (`POST /api/shows/add`), the relevant `shows:movie:*` cache key is deleted immediately.

---

### 6.3 Stripe Payment Flow

```
Client: handleCheckout() in SeatLayout.jsx
     │
     ▼
POST /api/bookings/create-checkout-session
  Body: { seats, movieId, movieTitle, showTime, amount, userId }
     │
     ├── Validate input (seat IDs format, array length ≤10)
     ├── Atomic seat claim (see §6.1)
     ├── Booking.create({ isPaid: false })
     └── stripe.checkout.sessions.create({
             currency: 'inr',
             unit_amount: amount * 100,  // Stripe uses paisa (1₹ = 100 paisa)
             success_url: CLIENT_URL + /my-bookings?success=true&bookingId=X,
             cancel_url:  CLIENT_URL + /movies,
             metadata: { bookingId }
         })
     │
     ▼
Return { url: session.url }
     │
     ▼  Client: window.location.href = url (redirect to Stripe hosted page)
     │
     ▼  User pays → Stripe redirects to success_url
     │
     ▼
GET /api/bookings/verify/:bookingId
  → findByIdAndUpdate(id, { isPaid: true })
  → publishEvent('booking.confirmed', ...) ← fire-and-forget
  → Response: { success: true, booking }
```

**Why Stripe Checkout (hosted) vs Stripe Elements (embedded)?** The hosted page handles card input validation, 3D Secure, PCI compliance, and mobile responsiveness out of the box. Elements would require building the form UI and handling edge cases manually.

**What if user cancels?** Redirected to `/movies`. The unpaid booking auto-expires after 10 minutes — no cleanup needed.

**Production improvement**: Use Stripe webhooks (`checkout.session.completed`) instead of client-triggered verification. Stripe sends a cryptographically-signed event server-to-server, which is more reliable and secure.

---

### 6.4 RabbitMQ Async Notifications

**Why a message queue?** After booking confirmation, the system needs to send emails and log analytics. Doing this synchronously blocks the HTTP response. If the email server is slow or down, the booking endpoint fails.

**Flow**:

```
POST /verify/:bookingId
     │
     ├── findByIdAndUpdate → isPaid = true   [DB committed]
     ├── res.json({ success: true, booking }) ← USER SEES RESPONSE IMMEDIATELY
     │
     └── publishEvent('booking.confirmed', payload)   ← FIRE AND FORGET
              │   (returns instantly whether queue is up or not)
              ▼
         RabbitMQ exchange: booking.events
              │
              ▼ (async, after response)
         notificationWorker.js (separate process)
              ├── prefetch(1)  — process one at a time
              ├── sendConfirmationEmail()   → retry up to 3x on failure
              ├── logAnalyticsEvent()
              └── On max retries → dead-letter queue (manual inspection)
```

**If RabbitMQ is unavailable**: `publishEvent` logs a warning and returns silently. Bookings work normally. Notifications are not sent for that booking only.

**Run the worker**:
```bash
cd server
npm run worker  # or: node workers/notificationWorker.js
```

---

### 6.5 JWT + bcrypt Authentication

**Registration** (`POST /api/auth/register`):
1. Validate email uniqueness
2. `bcrypt.genSalt(10)` → `bcrypt.hash(password, salt)` → save hashed password
3. `jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })` → return token

**Login** (`POST /api/auth/login`):
1. Find user by email
2. `bcrypt.compare(password, user.password)` → verify
3. Return signed JWT on success

**Client side** — `AuthProvider` (React Context):
- Stores JWT in `localStorage`
- Exposes `useAuth()` hook providing `{ user, token, login, register, logout, isLoaded }`
- On mount: fetches `/api/auth/me` with stored token to restore session
- Protected actions (booking checkout, date selection) redirect to `/login` if no user

**Server middleware** — `authMiddleware.js`:
- Reads `Authorization: Bearer <token>` header
- `jwt.verify(token, JWT_SECRET)` → attaches `req.user`
- Applied per-route, not globally

> **Why custom JWT+bcrypt instead of Clerk?** Complete control over user data, no vendor lock-in, no webhook synchronisation latency, and demonstrates core backend security fundamentals.

---

### 6.6 TMDB API Integration

**Why proxy through backend?**
1. `TMDB_API_KEY` stays on server — never exposed to browser
2. Server maps raw TMDB data to a clean schema with full-resolution image URLs
3. `fetchWithRetry` provides resilience (3 attempts, 10s timeout each)

**GET /api/movies/now-playing**:
- Calls TMDB `/movie/now_playing` with `region=IN`
- Maps genre IDs → names via local `genreMap` (19 genres, no extra API call)
- Optional `?language=` filter: `en` / `hi` / `te` / `ta` / `all`
- Result: Redis cached for 10 minutes

**GET /api/movies/:id**:
- Calls TMDB `/movie/:id?append_to_response=credits`
- Returns full movie data + first 12 cast members
- Result: Redis cached for 30 minutes

**Cache invalidation**: Movie data is stable (no explicit invalidation needed; TTL handles it).

---

### 6.7 Transport & Maps

**Security-first design**: `GOOGLE_MAPS_API_KEY` is server-side only. The frontend calls `/api/transport/route` — never Google Maps directly.

**Fare estimation formula**:
```
estimatedFare = baseFare + (distanceKm × perKmRate)
```
All rates are configurable via environment variables. Results are always labelled as **ESTIMATES**.

**Flow**:
```
Frontend picks: GPS location OR manual address input
     │
     ▼
GET /api/transport/theatres   → static list of theatres with coordinates
     │
     ▼ (user selects a theatre)
POST /api/transport/route
  Body: { origin: { lat, lng } | "address", theatreId: "t1" }
     │
     ▼ [SERVER-SIDE — API key never leaves server]
Google Maps Routes API (traffic-aware routing)
     │
     ▼
Response: { distanceKm, durationText, fares: { auto, mini, sedan }, fareDisclaimer }
     │
     ▼
Client displays on Leaflet map + fare panel with disclaimer
```

**Dev fallback**: If `GOOGLE_MAPS_API_KEY` is not set, `mapsService.js` returns a clearly-labelled simulated response. A banner reads: *"🛠️ Dev Mode: GOOGLE_MAPS_API_KEY is not configured."*

**Map technology**: OpenStreetMap tiles via Leaflet (free, no key needed) for rendering. Google Routes API (server-side, keyed) for accurate driving distance/duration.

---

## 7. API Reference

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Register. Body: `{ name, email, password }` |
| POST | `/login` | — | Login. Body: `{ email, password }` |
| GET | `/me` | Bearer | Get current authenticated user |

### Movies (`/api/movies`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/now-playing?language=en` | — | Now-playing movies (Redis cached 10 min) |
| GET | `/:id` | — | Movie detail + cast (Redis cached 30 min) |

### Shows (`/api/shows`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:movieId` | — | Show schedule by movie (Redis cached 5 min) |
| POST | `/add` | — | Admin: add show (invalidates cache) |

### Bookings (`/api/bookings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/seats-status?movieId=&showTime=` | — | Real-time seat availability (**never cached**) |
| POST | `/create-checkout-session` | — | Atomic seat claim + Stripe checkout session |
| GET | `/verify/:bookingId` | — | Mark booking paid + publish queue event |
| GET | `/user/:userId` | — | User's booking history |

### Transport (`/api/transport`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/theatres` | — | List available theatres with coordinates |
| POST | `/route` | — | Route distance + fare estimate (Google Maps proxy) |

---

## 8. Environment Variables

### Server (`server/.env`)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string | — |
| `JWT_SECRET` | ✅ | JWT signing secret (≥32 chars) | — |
| `TMDB_API_KEY` | ✅ | [themoviedb.org](https://www.themoviedb.org/settings/api) API key | — |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key (`sk_test_...`) | — |
| `CLIENT_URL` | ✅ | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `REDIS_URL` | ⚠️ | Redis connection string | `redis://localhost:6379` |
| `RABBITMQ_URL` | ⚠️ | RabbitMQ AMQP URL | `amqp://localhost` |
| `GOOGLE_MAPS_API_KEY` | ⚠️ | Server-side Maps key ([Routes API](https://console.cloud.google.com/apis/library)) | dev fallback |
| `FARE_BASE_AUTO` | optional | Auto base fare (₹) | `25` |
| `FARE_PKM_AUTO` | optional | Auto per-km rate (₹) | `12` |
| `FARE_BASE_MINI` | optional | Mini cab base fare (₹) | `40` |
| `FARE_PKM_MINI` | optional | Mini cab per-km rate (₹) | `14` |
| `FARE_BASE_SEDAN` | optional | Sedan base fare (₹) | `50` |
| `FARE_PKM_SEDAN` | optional | Sedan per-km rate (₹) | `18` |
| `INNGEST_EVENT_KEY` | optional | Inngest event key | — |
| `INNGEST_SIGNING_KEY` | optional | Inngest signing key | — |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BACKEND_URL` | ✅ | Backend URL (e.g. `http://localhost:3000`) |
| `VITE_CURRENCY` | optional | Currency symbol (default `₹`) |

> **Security**: `VITE_` prefix is required for Vite to expose a variable to the browser bundle. Never put `GOOGLE_MAPS_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, or `STRIPE_SECRET_KEY` in the client `.env`.

---

## 9. Local Setup

### Prerequisites

- Node.js 18+ and npm 9+
- Docker (for Redis and RabbitMQ)

### Steps

```bash
# 1. Install server dependencies
cd server
cp .env.example .env       # fill in your keys
npm install

# 2. Install client dependencies
cd ../client
cp .env.example .env       # set VITE_BACKEND_URL=http://localhost:3000
npm install

# 3. Start Redis (required for caching)
docker run -d --name quickshow-redis -p 6379:6379 redis:7

# 4. Start RabbitMQ (required for notifications)
docker run -d --name quickshow-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# 5. Start the Express server
cd server
npm run dev          # nodemon on :3000

# 6. Start the notification worker (optional)
npm run worker       # in a separate terminal

# 7. Start the React client
cd ../client
npm run dev          # Vite on :5173
```

**Stripe test card**: `4242 4242 4242 4242` — any future expiry, any CVV.

---

## 10. Service Setup Guides

### Redis

```bash
# Local Docker
docker run -d --name quickshow-redis -p 6379:6379 redis:7

# Cloud options: Redis Cloud (30MB free), Upstash (serverless)
REDIS_URL=redis://default:<password>@<host>:<port>
```

**Verify**: Watch server logs for `[Cache] HIT` vs `[Cache] MISS`.
**If unavailable**: App falls back to direct DB queries automatically.

### RabbitMQ

```bash
# Local Docker — management UI at http://localhost:15672 (guest/guest)
docker run -d --name quickshow-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Cloud: CloudAMQP (1M messages/month free)
RABBITMQ_URL=amqps://user:pass@hostname/vhost
```

**Verify**: Complete a booking, check worker logs for `[Worker] ▶ Processing booking.confirmed`.
**If unavailable**: `[Queue] SKIP publish — not connected` in logs. Bookings still work.

### Google Maps API

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select project
2. **APIs & Services → Library** → enable **Routes API**
3. **APIs & Services → Credentials** → create API Key
4. Restrict key: **API restrictions → Routes API only** + **IP restrictions** (server IP)
5. Add to `.env`: `GOOGLE_MAPS_API_KEY=AIza...`

**If not set**: Transport page shows a clearly-labelled dev fallback. No errors thrown.

---

## 11. Deployment

### Client (`client/vercel.json`)

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

React Router handles client-side routing. Without this catch-all, navigating directly to `/movies/123` returns 404 from Vercel.

### Server (`server/vercel.json`)

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }] }
```

All requests route to `api/index.js`, which Vercel wraps as an AWS Lambda-compatible serverless function.

### Key Deployment Differences

| Aspect | Local (`npm run dev`) | Vercel (Serverless) |
|--------|-----------------------|---------------------|
| Entry point | `server.js` | `api/index.js` |
| DB connect | Once at startup | Per-request middleware (cached) |
| Redis/Queue | Persistent connection | Redis: per-request; Queue: skipped |
| Port | 3000 | N/A |
| Hot reload | nodemon | Redeploy on push |

> **Note**: RabbitMQ is omitted from `api/index.js` — serverless functions are stateless and cannot maintain long-lived AMQP connections.

---

## 12. Testing

```bash
cd server

npm test          # run all tests (vitest run)
npm run test:watch # watch mode
```

**Test results**: 35/35 tests pass ✅

| File | Tests | Covers |
|------|-------|--------|
| `tests/cache.test.js` | 13 | Cache HIT/MISS, Redis unavailable fallback, TTL, key helpers |
| `tests/transport.test.js` | 15 | Fare calculation formula, Google API success/error/timeout, dev fallback |
| `tests/booking.test.js` | 7 | Event publishing, queue fallback, concurrent seat claim, validation |

**Manual verification**:

```bash
# Test Redis caching
curl http://localhost:3000/api/movies/now-playing
# → Watch for [Cache] MISS then [Cache] HIT on second call

# Test concurrent booking (requires two terminals or k6)
# Both requests booking seat A1 at the same time
# Expected: one 200 OK, one 409 Conflict

# Test RabbitMQ
# 1. Complete a Stripe test payment
# 2. Check worker output for [Worker] ▶ Processing booking.confirmed
```

---

## 13. Admin Dashboard

All admin pages at `/admin/*` are **static mockups** reading from `dummyDashboardData` in `assets.js`. They demonstrate the UI/UX design and are not connected to the live API.

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/admin` | 4 stats cards (bookings, revenue, shows, users) + show gallery |
| Add Shows | `/admin/add-shows` | Movie selector, price input, datetime picker |
| List Shows | `/admin/list-shows` | Table: movie, showtime, bookings, earnings |
| List Bookings | `/admin/list-bookings` | Table: user, movie, showtime, seats, amount |

**To wire to live API**: Replace dummy data fetches with calls to `/api/bookings/stats`, `/api/shows/all`, `/api/bookings/all`. Add admin auth middleware to restrict access.

---

## 14. User Flows

### Flow 1: New User Books a Ticket

1. Visit `/` → HeroSection "Explore Movies" CTA
2. Navigate to `/movies` → filter by language (All / English / Hindi / Telugu / Tamil)
3. Click "Buy Tickets" → `/movies/:id` (MovieDetails)
4. Review cast, rating, overview → DateSelect picks a date → "Book Now"
5. Not logged in → redirected to `/login` or `/register`
6. After login → `/movies/:id/:date` (SeatLayout)
7. Select showtime → backend fetches seat status
8. Seat grid: available (outlined), locked (amber), occupied (red)
9. Click up to 10 seats → turn pink → "Proceed to Checkout"
10. Backend: validate → atomic seat claim → Stripe session → return URL
11. User pays on Stripe (`4242 4242 4242 4242` for test)
12. Redirect to `/my-bookings?success=true&bookingId=X`
13. Frontend calls `/verify/:bookingId` → `isPaid = true`
14. Booking shows green "Paid ✓" badge + "Book Cab to Theatre" button

### Flow 2: Concurrent Booking Prevention

1. User A selects A1, A2 → clicks checkout → seats LOCKED (10 min)
2. User B opens same show → seat-status shows A1, A2 as amber (disabled)
3. If User B had already selected A1 (race condition) → checkout returns 409
4. Frontend clears selection, re-fetches status, shows toast "seats already locked"

### Flow 3: Lock Expiry

1. User A locks seats but doesn't pay within 10 minutes
2. `createdAt` becomes older than `Date.now() - 10 * 60 * 1000`
3. Next `/seats-status` call passively ignores these bookings
4. Seats become available again — no cron job, no cleanup needed

### Flow 4: Transport Booking

1. Click "Book Cab to Theatre" → `/transport`
2. Browser requests geolocation (or user enters address manually)
3. GET `/api/transport/theatres` → theatre list with coordinates
4. User selects a theatre → map marker or sidebar click
5. POST `/api/transport/route` → server calls Google Maps Routes API
6. Response: `{ distanceKm, durationText, fares: { auto, mini, sedan }, fareDisclaimer }`
7. Route drawn on Leaflet map (straight line visual guide)
8. User selects cab type → simulated booking with OTP, driver name, ETA

---

## 15. Interview Q&A

### Project Overview

**Q: What is QuickShow? Give a brief overview.**
QuickShow is a full-stack movie ticket booking web application — React 19 + Vite frontend, Express.js + MongoDB backend. Features: real-time TMDB movie listings, interactive seat selection with 10-minute locking to prevent double-booking, Stripe payments, custom JWT+bcrypt auth, Redis caching, RabbitMQ async notifications, and a backend-proxied Google Maps transport feature.

**Q: What is the most important feature to understand?**
The seat-locking and concurrency prevention mechanism. When two users try to book the same seat simultaneously, the atomic `findOneAndUpdate` with conditional query (`$exists: false` per seat) ensures only one succeeds. The losing request gets `null` back and returns 409.

**Q: What are the three architectural tiers?**
1. **Fully integrated live flows** — auth, TMDB proxy, seat locks, Stripe, Redis, RabbitMQ
2. **Backend-proxied external APIs** — Google Maps (key hidden server-side), TMDB (key hidden server-side)
3. **Static admin mockups** — Dashboard, AddShows, ListShows use dummy data, not wired to backend

### Seat Locking & Concurrency

**Q: How do you prevent double-booking?**
Two-layer defence: (1) Check `Booking` collection for locked/occupied seats and return 409 if any conflict found. (2) `findOneAndUpdate` with `$exists: false` conditional query on the `Show` document — MongoDB's document-level atomicity guarantees only one concurrent request can set the seat keys.

**Q: Why 10 minutes for lock duration?**
Long enough for Stripe checkout (entering card, 3D Secure OTP). Short enough that abandoned locks don't block seats too long. Configurable via env variable in production.

**Q: How does the lock expire? Is there a cron job?**
No cron job needed. Expiry is computed at read-time: `const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)`. Unpaid bookings older than this are simply ignored. Passive/lazy expiry — zero infrastructure.

**Q: Why use the Booking record as a lock instead of a separate Lock collection?**
The booking is dual-purpose: lock when `isPaid: false`, permanent ticket when `isPaid: true`. No data migration needed — a single `findByIdAndUpdate(id, {isPaid: true})` finalises it. Simpler schema, fewer collections.

### Redis

**Q: Why was Redis added?**
The app fetches movie data from TMDB on every request (~200-500ms per call). Movie metadata is stable and identical for all users. Redis serves the first cached response in <5ms, reducing TMDB load and improving UX.

**Q: Why is seat availability never cached?**
If User A and User B both see "seat A1 is available" from a stale cache, both might select it and fail at checkout. Seat status must always come from the primary database — it's the single source of truth.

**Q: What happens if Redis goes down?**
`getCache()` returns `null`, `setCache()` and `deleteCache()` no-op silently. All requests fall back to direct DB/TMDB reads. Application is fully functional, just slower. `[Cache] SKIP (Redis not ready)` appears in logs.

### RabbitMQ

**Q: Why use a message queue for notifications?**
Post-booking tasks (email, analytics) shouldn't block the HTTP response. If the email server is slow, the booking response would be delayed. With RabbitMQ, the booking confirms instantly; notifications happen asynchronously.

**Q: What happens if RabbitMQ is unavailable?**
`publishEvent` logs a warning and returns. The booking HTTP response is unaffected. Notifications are simply not sent for that booking. `[Queue] SKIP publish — not connected` in logs.

### Authentication

**Q: How are passwords stored?**
Hashed with bcrypt — `bcrypt.genSalt(10)` + `bcrypt.hash(password, salt)`. Never stored or logged as plaintext. Verified with `bcrypt.compare()` on login.

**Q: Why JWT in localStorage instead of httpOnly cookies?**
JWT is stateless — no server-side session store needed. Easy to attach as `Authorization: Bearer` header for the decoupled frontend/backend architecture. Trade-off: XSS risk (localStorage is JavaScript-accessible). Production improvement: use httpOnly cookies with CSRF protection.

### Transport / Maps

**Q: Why proxy Google Maps through the backend?**
The API key must never be exposed in frontend code — it would be visible in browser DevTools and network requests. All Maps API calls go through `mapsService.js` server-side.

**Q: How is distance converted to fare?**
`estimatedFare = baseFare + (distanceKm × perKmRate)`. Example for Mini with 8km: `40 + (8 × 14) = ₹152`. Rates are env-var configurable. Always displayed with a disclaimer: "ESTIMATE ONLY — actual fare may vary."

### Scalability & Production

**Q: How would you make seat locking fully atomic?**
MongoDB transactions (`session.startTransaction()`) or a unique compound index on `{movie, showDateTime, bookedSeats}` to prevent duplicate inserts. Current approach uses document-level atomicity via `findOneAndUpdate` conditional queries, which is sufficient for this scale.

**Q: How would you add real-time seat updates?**
Integrate Socket.IO — broadcast updated seat status to all clients viewing the same show when a seat is locked/booked. For serverless, use Pusher or Ably (managed WebSocket services).

**Q: What security improvements for production?**
1. Rate limiting (`express-rate-limit`)
2. Stripe webhook signature verification (`stripe.webhooks.constructEvent`)
3. Input validation (`express-validator`)
4. Admin route RBAC (role-based access)
5. httpOnly cookies + CSRF protection
6. Helmet.js for security headers
7. MongoDB TTL index for expired lock cleanup

**Q: How would you handle expired lock cleanup at scale?**
MongoDB TTL index: `bookingSchema.index({createdAt: 1}, {expireAfterSeconds: 600, partialFilterExpression: {isPaid: false}})`. This auto-deletes unpaid bookings after 10 minutes without any application-level code.

**Q: What design patterns are used?**
1. **Singleton** — `db.js` (MongoDB) and `redis.js` (Redis) connection caching
2. **Proxy** — Backend proxies TMDB and Google Maps API calls (key hidden)
3. **Cache-Aside** — `cacheService.js` get/set/delete helpers
4. **Pending-Lock** — Unpaid bookings as temporary seat locks
5. **Observer / Event-Driven** — RabbitMQ publish/consume for async notifications
6. **Strategy** — Cab fare calculation with interchangeable cab types (auto/mini/sedan)

---

## Stripe Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | ✅ Payment success |
| `4000 0000 0000 0002` | ❌ Card declined |
| `4000 0025 0000 3155` | 🔐 3D Secure required |

Use any future expiry date and any 3-digit CVV.
