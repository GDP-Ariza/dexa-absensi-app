# Dexa Absensi — Backend

REST API for the employee attendance system. Built with **NestJS + TypeScript**, using CSV files as the data store (Postgres-compatible schema).

## Prerequisites

- Node.js >= 18
- npm >= 9

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work out of the box for local development):

```
PORT=3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=8h
```

### 3. Seed the database

Creates `data/users.csv` and `data/attendance.csv` with two seed accounts.

```bash
npm run seed
```

Seed credentials:

| Role     | Username  | Password     |
|----------|-----------|--------------|
| Admin    | admin     | admin123     |
| Employee | john.doe  | employee123  |

### 4. Start the server

**Development (with hot reload):**
```bash
npm run start:dev
```

**Production:**
```bash
npm run build
npm run start:prod
```

Server starts at: `http://localhost:3000/api/v1`

---

## API Reference

Full contract: see [`../API_CONTRACT.md`](../API_CONTRACT.md)

Base URL: `http://localhost:3000/api/v1`

All protected endpoints require:
```
Authorization: Bearer <token>
```

### Quick curl examples

**Login**
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john.doe","password":"employee123"}' | jq
```

**Get own profile**
```bash
TOKEN="<paste token here>"

curl -s http://localhost:3000/api/v1/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Check in**
```bash
curl -s -X POST http://localhost:3000/api/v1/attendance/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-6.2088,"longitude":106.8456,"location_name":"Office - Jakarta HQ"}' | jq
```

**Check out**
```bash
curl -s -X POST http://localhost:3000/api/v1/attendance/check-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-6.2088,"longitude":106.8456,"location_name":"Office - Jakarta HQ"}' | jq
```

**View attendance summary**
```bash
curl -s "http://localhost:3000/api/v1/attendance/summary?month=3&year=2026" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**[Admin] View all attendance**
```bash
ADMIN_TOKEN="<paste admin token here>"

curl -s "http://localhost:3000/api/v1/admin/attendance?month=3&year=2026" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**[Admin] List employees**
```bash
curl -s "http://localhost:3000/api/v1/admin/employees" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**[Admin] Update employee**
```bash
curl -s -X PATCH http://localhost:3000/api/v1/admin/employees/u002 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"department":"Product","position":"Product Engineer"}' | jq
```

---

## Project Structure

```
src/
├── main.ts                  # App entry, global prefix /api/v1
├── app.module.ts            # Root module
├── common/
│   ├── decorators/
│   │   └── roles.decorator.ts
│   └── csv/
│       └── csv.repository.ts   # Generic CSV read/write
├── users/
│   ├── users.repository.ts     # users.csv I/O
│   └── users.module.ts
├── auth/
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── auth.module.ts
├── me/
│   └── me.controller.ts
├── attendance/
│   ├── attendance.repository.ts  # attendance.csv I/O
│   ├── attendance.service.ts
│   └── attendance.controller.ts
└── admin/
    ├── admin.service.ts
    └── admin.controller.ts
```

## Migrating to Postgres

Only the repository layer needs to change:
- Replace `CsvRepository` reads/writes in `users.repository.ts` and `attendance.repository.ts` with TypeORM / Prisma queries
- The schema is already modelled as relational tables — see `PLAN.md` for column → Postgres type mapping
