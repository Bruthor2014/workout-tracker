# Workout Tracker — Gym Management System

## Overview

Workout Tracker is a multi-user web application for gym workout management. It allows **members** to log and track their own training progress, and — in a later phase — allows **administrators/personal trainers** to manage members and assign workout plans. This project is being built as a backend development portfolio project.

## Architecture

### Technology Stack

* **Backend:** Node.js, Express
* **Frontend:** React
* **Database:** PostgreSQL, schema and queries under `/backend/db`
* **Authentication:** JWT, with role-based access control (planned)

### Project Structure

```
workout-tracker/
├── backend/
│   ├── db/            # Database connection and queries
│   ├── controllers/   # Route logic (business logic per endpoint)
│   ├── routes/        # Endpoint definitions
│   ├── .env            # Environment variables (excluded from version control)
│   └── index.js        # Application entry point
└── frontend/
    └── src/            # React application source
```

## Features

### Body Metrics Tracking

* Members can log body metrics (weight, date) over time
* Metrics are retrieved per user, ordered chronologically

### Workout & Set Logging

* [add specifics once implemented — exercises, sets, reps, load]

### Planned: Role-Based Management

* Admin/personal trainer role, separate from regular members
* Admins can create and assign workout plans to members
* Admins can view member progress

## Security Features to be Implemented

* Authentication and role-based access control (member vs. admin)
* Input validation and sanitization
* CSRF protection
* HTTPS enforcement

## Development Guidelines

### Code Organization

* Keep backend logic in `controllers/` separated from route definitions (`routes/`)
* Centralize the database connection in `db/` rather than duplicating it across controllers
* Keep configuration (database credentials, JWT secret) in `.env`, excluded from version control

### Best Practices

* Validate all user input before it reaches the database
* Use parameterized queries (`$1`, `$2`, ...) for all database access — never string-concatenate SQL
* Keep controller functions focused on a single responsibility (one route, one action)

## Getting Started

### Prerequisites

* Node.js (LTS)
* PostgreSQL instance running locally

### Setup Instructions

1. Clone the repository
2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file in `backend/` with your configuration:

```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/workout_tracker
JWT_SECRET=your_secret_key
PORT=3000
```

4. Import the schema into your PostgreSQL instance (see `/backend/db`)
5. Start the backend server:

```bash
node index.js
```

6. Install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

7. Access the application at `http://localhost:[port]`

## Roadmap

* Add member-facing workout and set logging
* Add authentication and role-based access control
* Add admin role: workout plan creation and assignment
* Add admin view of member progress
* Add automated tests for controllers

## Author

Bruthor2014
