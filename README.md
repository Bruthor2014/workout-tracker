# Workout Tracker

## Overview

Workout Tracker is a multi-tenant gym management platform. Members track their own workouts, nutrition and body composition; gyms use it to manage members, staff and subscriptions; personal trainers and nutritionists manage the clients assigned to them. Built as a full-stack portfolio project.

## Architecture

### Technology Stack

- **Backend**: Node.js + Express 5
- **Database**: PostgreSQL (via `pg`, raw parameterized SQL — no ORM)
- **Auth**: JSON Web Tokens (`jsonwebtoken`) + `bcrypt` password hashing
- **File uploads**: `multer` (avatar images, served statically)
- **Frontend**: React 19 + Vite, React Router 7
- **Styling**: hand-written CSS (glassmorphism design system), no UI framework

### Project Structure

```
AppGym/
├── backend/
│   ├── controllers/   # Request handlers + SQL queries
│   ├── routes/        # Express routers (one per resource)
│   ├── middleware/     # requireAuth / requireRole, multer upload config
│   ├── db/             # Postgres pool + schema.sql (source of truth)
│   ├── uploads/         # User-uploaded avatars (gitignored, kept via .gitkeep)
│   └── server.js
└── frontend/
    ├── src/
    │   ├── api/         # fetch wrapper (client.js)
    │   ├── components/  # Shared UI (forms, cards, modals, charts)
    │   ├── context/     # AuthContext (JWT in localStorage)
    │   └── pages/       # One component per route
    └── vite.config.js
```

## Required Dependencies

Install with `npm install` inside each of `backend/` and `frontend/`.

**Backend**: `express`, `pg`, `jsonwebtoken`, `bcrypt`, `multer`, `cors`, `dotenv` (dev: `nodemon`)
**Frontend**: `react`, `react-dom`, `react-router-dom` (dev: `vite`, `@vitejs/plugin-react`, `oxlint`)

## Features

### Everyone

- Register / log in (JWT-based sessions)
- Profile page: avatar upload, own subscriptions summary

### Member (self-service)

- Workout plans (multi-day, per-exercise sets/reps/target load) — create, edit, delete
- Nutrition plans (meals → multiple options → itemized foods with quantity) — create, edit, delete
- Live or manual workout session logging, with a running timer
- Body composition history (weight, body fat %, lean/muscle/bone mass, body water %) with evolution charts
- Dashboard: weekly attendance calendar, weekly training volume/time comparison
- Direct messaging with gym staff

### Staff (gym owner / personal trainer / nutritionist / receptionist)

- Member directory: search, filter inactive members (30+ days), photo, last weight, last workout
- Create/edit workout and nutrition plans on behalf of a member
- Record body composition measurements for a member
- Manage a member's subscriptions (gym membership / personal training / nutrition plan), each with its own assigned staff member
- Broadcast messaging: send to a named audience (all members, nutrition/PT subscribers, "my clients", inactive members) or to an explicit filtered list, with a `{nome}` placeholder personalized per recipient

## User Roles

| Role | Scope |
|---|---|
| `member` | Own data only |
| `personal_trainer` / `nutritionist` | Assigned members' plans, metrics, and messaging |
| `receptionist` | Member directory, subscription management |
| `gym_owner` | Full gym management (members, staff, subscriptions, broadcasts) |
| `intern` | Supervised staff (reserved, no dedicated permissions yet) |
| `admin` | Reserved for future platform-level administration (not gym-scoped) |

## Security Features

### Implemented

- Password hashing with `bcrypt`
- JWT-based authentication, role embedded in the token
- Role-based authorization middleware (`requireAuth`, `requireRole`) on every protected route
- Parameterized SQL everywhere (no string-built queries)
- Ownership checks on top of role checks (e.g. editing a plan requires being its owner or staff of the same gym)

### To Be Implemented

- Password complexity requirements
- Account lockout after failed login attempts
- Email confirmation for new accounts
- Rate limiting
- HTTPS enforcement (deployment-dependent)

## Development Guidelines

### Code Organization

- Controllers hold both the HTTP handling and the SQL — no separate repository/service layer (deliberately simple for this project's size)
- Shared query/insert logic factored into helper functions within a controller (e.g. `fetchPlansForMember`, `insertDaysAndExercises`) rather than duplicated between self-service and staff endpoints
- Multi-table writes use an explicit `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` transaction

### Naming Conventions

- Controllers: `[resource]Controller.js` (e.g. `planController.js`)
- Routes: `[resource]Routes.js`, mounted under `/api/[resource]`
- Frontend pages: `[Feature]Page.jsx`; shared UI pieces live in `components/`

### Best Practices

- `async`/`await` throughout, no callback-style DB code
- Every write validates the request body before touching the database
- Frontend components favor small, composable pieces (e.g. `Modal`, `GlassCard`) reused across pages

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Database Setup

1. Create a database (default name: `workout_tracker`)
2. Run the schema: `psql -U <user> -d workout_tracker -f backend/db/schema.sql`

### Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install` in both `backend/` and `frontend/`
3. Configure `backend/.env` (see below)
4. Configure `frontend/.env` (see below)
5. Start the backend: `npm run dev` (in `backend/`)
6. Start the frontend: `npm run dev` (in `frontend/`)
7. Open the URL Vite prints (default `http://localhost:5173`)

## Environment Configuration

**`backend/.env`**

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=workout_tracker
DB_USER=postgres
DB_PASSWORD=your_password_here

# Registration always assigns new users to this gym until self-service
# gym creation exists.
DEFAULT_GYM_ID=1

JWT_SECRET=replace_with_a_long_random_value_before_deploying
```

**`frontend/.env`**

```
VITE_API_URL=http://localhost:3000/api
```
