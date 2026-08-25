# Transjakarta/JakLingko Transit Navigation App

A public transit navigation web application for the Transjakarta ecosystem (BRT, Angkutan Umum Integrasi, Royaltrans, Mikrotrans/JakLingko). Users can input an origin and destination to receive ordered route itineraries with estimated travel times, fare costs, and a step-by-step journey view rendered on an interactive Leaflet map.

This project solves the problem of finding optimal public transit routes in a frequency-based bus network (no fixed departure timetables) involving multi-mode transfers, walking, and dynamic headway-based waiting times.

## 🚀 Key Features

- **Frequency-Based RAPTOR Routing Engine:** Handles up to 3 transfers with dynamic headway calculation.
- **Real Walking Distances:** Integrates with OSRM Table API for accurate pedestrian network distance/duration (with Haversine fallback).
- **Behavioral Penalty System:** Includes Walk Psychological Penalty (1.5× + 180s) and Transfer Penalty (15 min per transfer) for realistic route suggestions.
- **Fare Post-processing:** Calculates fares with JakLingko integration logic (3-hour window).
- **Interactive Map:** Visualizes OSRM route geometry for walking legs and GTFS shapes for transit legs.
- **Search & Filters:** Search by stop name or map click. Filter by vehicle type (BRT, Royaltrans, Mikrotrans), transit type (direct, 1-3 transfers), and maximum walking distance.
- **User Authentication & Bookmarks:** JWT-based auth to save and manage favorite routes.

## 🛠️ Technology Stack

- **Frontend:** React 19, Vite 8, react-router-dom, TailwindCSS v4, Leaflet/React-Leaflet, Lucide React
- **Backend:** Node.js, Express 5.2
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** `jose` (JWT), `bcryptjs`
- **External Services:** OSRM (Walking Distances), Nominatim OSM (Geocoding)

## 📂 Project Structure

- `backend/`: Express API server (`server.js`), Prisma schema, routing logic (`lib/routing`), and GTFS importer script.
- `frontend/`: React SPA built with Vite. Core views include `Home.jsx`, `RoutesPage.jsx`, `Bookmarks.jsx`, and `Login.jsx`.

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL

### 1. Database Setup
1. Create a PostgreSQL database.
2. Navigate to the `backend` directory.
3. Copy `.env.example` to `.env` (if available) and configure your `DATABASE_URL` and `JWT_SECRET`.
4. Run Prisma migrations: `npx prisma db push` or `npx prisma migrate dev`.

### 2. GTFS Data Import
The application relies on GTFS data (routes, stops, trips, stop_times, frequencies, shapes, fare_attributes, fare_rules).
1. Place the GTFS files in `../../temp_gtfs` (relative to the `backend/scripts` folder).
2. Run the importer: `node scripts/import-gtfs.js`.
*(Note: This clears existing data and performs a full import).*

### 3. Run the Backend
```bash
cd backend
npm install
npm run dev # or node server.js
```

### 4. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🧠 Core Algorithm: Frequency-Based RAPTOR
The application uses a custom variant of the RAPTOR algorithm optimized for frequency-based networks rather than strict timetables:
- **Candidate Selection:** Uses Haversine + OSRM.
- **Boarding Logic:** `boardTime = Ti + ceil((tUser - Ti) / headway) * headway`
- **Footpath Relaxation:** Applies a psychological penalty (`ceil(t * 1.5) + 180`).
- **Fare Processing:** Calculates total cost based on JakLingko's session model after journey reconstruction.

## ⚠️ Known Limitations
- **Headways:** Assumes uniform headways all day based on the first trip in a pattern.
- **Calendar Data:** Does not filter by service dates/weekends (assumes service runs every day).
- **Cold Starts:** Boot-time footpath generation (O(N²)) can be slow on server cold starts without precomputed `osrm_transfers.json`.

---
*Refer to the detailed technical documentation (`new_deep_codebase_learning_3.md`) for full architectural insights, API contracts, and routing engine internals.*
