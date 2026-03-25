# Dexa Absensi — Employee Attendance System (POC)

A full-stack attendance system with a NestJS REST API backend and a React frontend.

---

## Project Structure

```
dexa-absensi-app/
├── API_CONTRACT.md      # REST API specification
├── backend/             # NestJS API (port 3000)
│   ├── PLAN.md
│   ├── README.md
│   └── src/
└── frontend/            # React + Vite SPA (port 5173)
    ├── PLAN.md
    └── src/
```

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

---

## Running Locally

### 1 — Backend

```bash
cd backend
npm install
cp .env.example .env
npm run seed        # creates data/users.csv and data/attendance.csv
npm run start:dev   # starts on http://localhost:3000
```

Seed credentials:

| Role     | Username  | Password     |
|----------|-----------|--------------|
| Admin    | `admin`   | `admin123`   |
| Employee | `john.doe`| `employee123`|

### 2 — Frontend

Open a **second terminal**:

```bash
cd frontend
npm install
npm run dev         # starts on http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

> The frontend Vite dev server proxies all `/api/*` requests to `http://localhost:3000`, so no CORS setup is needed.

---

## Pages

| Path | Role | Description |
|------|------|-------------|
| `/login` | all | Login with username + password |
| `/` | all | Homepage — attendance summary + quick actions |
| `/attendance` | all | Check in or check out (uses device location) |
| `/attendance/success` | all | Confirmation after check-in/out |
| `/profile` | all | Own profile |
| `/admin/employees` | admin | List all employees |
| `/admin/employees/:id` | admin | Employee detail + attendance history |

---

## API

Full contract: [`API_CONTRACT.md`](./API_CONTRACT.md)

Base URL (backend): `http://localhost:3000/api/v1`

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | NestJS + TypeScript |
| Auth | JWT (passport-jwt) |
| Storage | CSV files (Postgres-compatible schema) |
| Frontend | React 18 + Vite + TypeScript |
| Routing | React Router v6 |
| Styling | Plain CSS |

---

## Migrating to Postgres

Only the backend repository layer needs updating. See [`backend/PLAN.md`](./backend/PLAN.md) for the column → Postgres type mapping.
