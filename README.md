<p align="center">
  <img src="https://img.icons8.com/3d-fluency/94/clapperboard.png" alt="QuickShow Logo" width="80"/>
</p>

<h1 align="center">QuickShow 🎬</h1>

<p align="center">
  <b>A full-stack movie ticket booking platform with real-time seat selection, secure payments, and transit integration.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=for-the-badge" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white&style=for-the-badge" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white&style=for-the-badge" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white&style=for-the-badge" alt="Stripe"/>
  <img src="https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white&style=for-the-badge" alt="JWT"/>
  <img src="https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white&style=for-the-badge" alt="Vite"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=for-the-badge" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel&logoColor=white&style=for-the-badge" alt="Vercel"/>
</p>

---

## ✨ Highlights

| | Feature | Description |
|---|---------|-------------|
| 🎥 | **Live Movie Explorer** | Real-time now-playing listings from TMDB API with ratings, runtime, genres, cast, and trailers |
| 💺 | **Interactive Seat Selection** | Dynamic seat grid with real-time status — available, selected, temporarily locked, and booked |
| 🔒 | **Seat Locking System** | 10-minute temporary locks via pending booking records to prevent double-booking |
| 💳 | **Stripe Checkout** | Secure payment flow with webhook-based verification and automatic booking confirmation |
| 🔐 | **Custom JWT + Bcrypt Auth** | Token-based authentication with hashed passwords — no third-party auth dependency |
| 🗺️ | **Transit & Cab Booking** | Integrated OpenStreetMap + Leaflet maps to book rides directly to the theater |
| 🛠️ | **Admin Dashboard** | Manage movies, showtimes, and bookings (UI-ready, mock data) |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                     │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Home /   │  │  Seat    │  │  My       │  │  Login /      │  │
│  │  Movies   │  │  Layout  │  │  Bookings │  │  Register     │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──────┬────────┘  │
│       │              │              │               │            │
│       └──────────────┴──────────────┴───────────────┘            │
│                          │  AuthContext (JWT)                     │
│                          │  localStorage token                   │
└──────────────────────────┼───────────────────────────────────────┘
                           │  REST API + Bearer Token
┌──────────────────────────┼───────────────────────────────────────┐
│                    SERVER (Express 5 + Node.js)                  │
│                          │                                       │
│  ┌───────────┐  ┌───────┴──────┐  ┌──────────┐  ┌───────────┐  │
│  │  Auth     │  │  Booking     │  │  Movie   │  │  Show     │  │
│  │  Routes   │  │  Routes      │  │  Routes  │  │  Routes   │  │
│  │  (JWT)    │  │  (Stripe)    │  │  (TMDB)  │  │           │  │
│  └─────┬─────┘  └──────┬──────┘  └────┬─────┘  └─────┬─────┘  │
│        │               │              │               │         │
│        └───────────────┴──────────────┴───────────────┘         │
│                          │  authMiddleware (JWT verify)           │
│                          │                                       │
│                   ┌──────┴──────┐                                │
│                   │   MongoDB   │                                │
│                   │  (Mongoose) │                                │
│                   └─────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔍 How It Works

### 🔐 Authentication Flow
1. User registers with **name, email, and password** → password is hashed using **bcryptjs** and stored in MongoDB
2. On login, credentials are verified and a **JSON Web Token (JWT)** is issued (24h expiry)
3. Token is stored in `localStorage` and sent as `Authorization: Bearer <token>` on every protected request
4. Server-side `authMiddleware` verifies the token and attaches `req.user` to the request

### 💺 Seat Booking Flow
1. User selects seats on the interactive grid → clicks **Proceed to Checkout**
2. Backend validates seat availability and creates a **pending booking** (acts as a 10-minute lock)
3. If another user tries to book the same seats, the backend **rejects** the request
4. On successful **Stripe payment**, the booking status flips to `isPaid: true` and seats become permanently occupied

### 🗺️ Transit Integration
- Nearby theaters discovered via **OSM Nominatim API** with a **Haversine distance filter** (20km radius)
- Driving routes rendered on **Leaflet maps** using the **OSRM Route API**
- Simulated cab booking with mock drivers, ETAs, and OTP verification

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **Tailwind CSS 4** | Utility-first styling |
| **React Router DOM 7** | Client-side routing |
| **Stripe.js** | Payment integration |
| **Leaflet + React Leaflet** | Maps & geolocation |
| **Lucide React** | Icon library |
| **React Hot Toast** | Toast notifications |

### Backend
| Technology | Purpose |
|------------|---------|
| **Express 5** | REST API framework |
| **MongoDB + Mongoose** | Database & ODM |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT token signing & verification |
| **Stripe SDK** | Payment processing & webhooks |
| **Axios** | HTTP client for TMDB API |

---

## 📁 Project Structure

```
QuickShow/
├── client/                          # React Frontend
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── Navbar.jsx           # Navigation with auth-aware dropdown
│   │   │   ├── Footer.jsx           # Site footer
│   │   │   └── DateSelect.jsx       # Showtime date picker
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # JWT auth state management
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Landing page
│   │   │   ├── Movies.jsx           # Movie listings
│   │   │   ├── MovieDetails.jsx     # Movie info + trailers
│   │   │   ├── SeatLayout.jsx       # Interactive seat selection
│   │   │   ├── MyBookings.jsx       # Booking history
│   │   │   ├── Transport.jsx        # Transit/cab booking
│   │   │   ├── Login.jsx            # Login page
│   │   │   ├── Register.jsx         # Registration page
│   │   │   └── admin/               # Admin dashboard (mock)
│   │   ├── App.jsx                  # Route configuration
│   │   └── main.jsx                 # Entry point
│   └── .env                         # Client environment variables
│
├── server/                          # Express Backend
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT verification middleware
│   ├── models/
│   │   ├── User.js                  # User schema (name, email, password)
│   │   ├── Booking.js               # Booking schema (seats, payment status)
│   │   └── Show.js                  # Show schema (movie, date, time, seats)
│   ├── routes/
│   │   ├── authRoutes.js            # Register, Login, Get Profile
│   │   ├── bookingRoutes.js         # Seat status, checkout, verification
│   │   ├── movieRoutes.js           # TMDB API proxy
│   │   └── showRoutes.js            # Showtime management
│   ├── configs/
│   │   └── db.js                    # MongoDB connection
│   ├── server.js                    # Main server entry
│   ├── api/index.js                 # Vercel serverless entry
│   └── .env                         # Server environment variables
│
└── README.md
```

---

## ⚙️ Environment Variables

### Server (`server/.env`)
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
TMDB_API_KEY=your_tmdb_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

### Client (`client/.env`)
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_CURRENCY=₹
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local instance or [Atlas](https://www.mongodb.com/atlas))
- **Stripe** account for payment testing
- **TMDB** API key ([get one here](https://www.themoviedb.org/settings/api))

### Installation

```bash
# Clone the repository
git clone https://github.com/Adityajakkula7/QUICKSHOW.git
cd QUICKSHOW

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Running Locally

```bash
# Terminal 1 — Start Backend (port 3000)
cd server
npm run dev

# Terminal 2 — Start Frontend (port 5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛰️ API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Create a new account (name, email, password) |
| `POST` | `/login` | Authenticate and receive JWT token |
| `GET` | `/me` | Get current user profile (requires token) |

### Movies (`/api/movies`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/now-playing` | Fetch currently showing movies from TMDB |
| `GET` | `/:id` | Get detailed movie info (cast, trailers, etc.) |

### Bookings (`/api/bookings`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/seats-status` | Get occupied + locked seat IDs for a show |
| `POST` | `/create-checkout-session` | Lock seats & create Stripe checkout |
| `GET` | `/verify/:bookingId` | Confirm payment and finalize booking |
| `GET` | `/user/:userId` | Get all bookings for a user |

### Shows (`/api/shows`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/:movieId` | Get available showtimes for a movie |
| `POST` | `/add` | Create a new showtime (admin) |

---

## 📄 License

This project is open source and available under the [ISC License](https://opensource.org/licenses/ISC).

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Adityajakkula7">Aditya Jakkula</a>
</p>
