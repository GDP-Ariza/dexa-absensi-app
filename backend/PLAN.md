# Backend Implementation Plan

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js | Widely used, fast for POC |
| Language | TypeScript | Type safety, better DX |
| Framework | NestJS | Structured, decorator-based, built-in DI |
| Auth | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | NestJS-native JWT support |
| Password hashing | bcrypt | Industry standard |
| CSV parsing | csv-parse / csv-stringify | Lightweight file-based storage |

---

## Project Structure

```
backend/
├── src/
│   ├── main.ts                          # Bootstrap NestJS app, set global prefix /api/v1
│   ├── app.module.ts                    # Root module, imports all feature modules
│   │
│   ├── data/                            # CSV files (acts as the "database")
│   │   ├── users.csv
│   │   └── attendance.csv
│   │
│   ├── auth/                            # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts           # POST /auth/login, POST /auth/logout
│   │   ├── auth.service.ts              # login() — bcrypt compare, sign JWT
│   │   ├── jwt.strategy.ts              # passport-jwt strategy, validates token
│   │   ├── jwt-auth.guard.ts            # Guard applied to all protected routes
│   │   └── roles.guard.ts               # Guard: checks role from JWT payload
│   │
│   ├── me/                              # Profile module
│   │   ├── me.module.ts
│   │   └── me.controller.ts             # GET /me — reads req.user from JWT
│   │
│   ├── attendance/                      # Attendance module
│   │   ├── attendance.module.ts
│   │   ├── attendance.controller.ts     # POST /check-in, POST /check-out, GET /summary
│   │   ├── attendance.service.ts        # Business logic
│   │   └── dto/
│   │       ├── check-in.dto.ts
│   │       └── attendance-query.dto.ts
│   │
│   ├── admin/                           # Admin module
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts          # GET /attendance, GET/PATCH /employees/:id
│   │   ├── admin.service.ts             # Business logic
│   │   └── dto/
│   │       ├── update-employee.dto.ts
│   │       └── attendance-filter.dto.ts
│   │
│   ├── users/                           # Shared user repository
│   │   ├── users.module.ts
│   │   └── users.repository.ts          # All CSV read/write for users.csv
│   │
│   └── common/
│       ├── decorators/
│       │   └── roles.decorator.ts       # @Roles('admin') decorator
│       └── csv/
│           └── csv.repository.ts        # Generic CSV read/write helper
│
├── package.json
├── tsconfig.json
└── .env.example
```

**Why this structure?**
NestJS modules map 1-to-1 with domains. The `users.repository.ts` and `csv.repository.ts` are the only places that touch CSV files — when migrating to Postgres, only those files change. Services and controllers stay the same.

---

## Database Schema

### Table: `users`

CSV file: `data/users.csv`

| Column | CSV type | Postgres type | Notes |
|--------|----------|---------------|-------|
| `id` | string | `UUID PRIMARY KEY` | Generate with `uuid` library |
| `username` | string | `VARCHAR(100) UNIQUE NOT NULL` | Used for login |
| `password_hash` | string | `TEXT NOT NULL` | bcrypt hash |
| `name` | string | `VARCHAR(255) NOT NULL` | Full name |
| `email` | string | `VARCHAR(255) UNIQUE NOT NULL` | |
| `department` | string | `VARCHAR(100)` | |
| `position` | string | `VARCHAR(100)` | Job title |
| `role` | string | `VARCHAR(20) NOT NULL` | `employee` or `admin` |
| `created_at` | ISO 8601 string | `TIMESTAMPTZ NOT NULL` | |

CSV example:
```
id,username,password_hash,name,email,department,position,role,created_at
u001,admin,$2b$10$...,Admin User,admin@company.com,IT,System Admin,admin,2026-01-01T00:00:00Z
u002,john.doe,$2b$10$...,John Doe,john@company.com,Engineering,Software Engineer,employee,2026-01-15T00:00:00Z
```

---

### Table: `attendance`

CSV file: `data/attendance.csv`

| Column | CSV type | Postgres type | Notes |
|--------|----------|---------------|-------|
| `id` | string | `UUID PRIMARY KEY` | |
| `user_id` | string | `UUID NOT NULL REFERENCES users(id)` | FK to users |
| `date` | string | `DATE NOT NULL` | `YYYY-MM-DD` |
| `check_in_time` | ISO 8601 string | `TIMESTAMPTZ` | |
| `check_in_lat` | float string | `NUMERIC(9,6)` | |
| `check_in_lng` | float string | `NUMERIC(9,6)` | |
| `check_in_location` | string | `TEXT` | Human-readable label |
| `check_out_time` | ISO 8601 string | `TIMESTAMPTZ` | Nullable |
| `check_out_lat` | float string | `NUMERIC(9,6)` | Nullable |
| `check_out_lng` | float string | `NUMERIC(9,6)` | Nullable |
| `check_out_location` | string | `TEXT` | Nullable |
| `status` | string | `VARCHAR(20) NOT NULL` | `checked_in`, `completed` |
| `total_hours` | float string | `NUMERIC(5,2)` | Nullable, filled on check-out |

CSV example:
```
id,user_id,date,check_in_time,check_in_lat,check_in_lng,check_in_location,check_out_time,check_out_lat,check_out_lng,check_out_location,status,total_hours
att001,u002,2026-03-25,2026-03-25T08:30:00+07:00,-6.2088,106.8456,Office - Jakarta HQ,2026-03-25T17:15:00+07:00,-6.2088,106.8456,Office - Jakarta HQ,completed,8.75
att002,u002,2026-03-26,2026-03-26T09:00:00+07:00,-6.2088,106.8456,Office - Jakarta HQ,,,,,,checked_in,
```

---

## Endpoint → Implementation Mapping

### Auth Routes (`/api/v1/auth`)

| Endpoint | Controller | Service call | Notes |
|----------|-----------|-------------|-------|
| `POST /login` | `AuthController` | `authService.login(username, password)` | Find user by username, bcrypt compare, sign JWT |
| `POST /logout` | `AuthController` | stateless | JWT is stateless; return 200 (no blacklist for POC) |

### Me Route (`/api/v1/me`)

| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /me` | `MeController` | `@UseGuards(JwtAuthGuard)` — `req.user` already populated by passport |

### Attendance Routes (`/api/v1/attendance`)

| Endpoint | Controller | Service call | Notes |
|----------|-----------|-------------|-------|
| `POST /check-in` | `AttendanceController` | `attendanceService.checkIn(userId, dto)` | Guard: no existing `checked_in` row for today |
| `POST /check-out` | `AttendanceController` | `attendanceService.checkOut(userId, dto)` | Find today's `checked_in` row, update it |
| `GET /summary` | `AttendanceController` | `attendanceService.getSummary(userId, query)` | Filter by user + month/year |

### Admin Routes (`/api/v1/admin`) — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` on controller

| Endpoint | Controller | Service call | Notes |
|----------|-----------|-------------|-------|
| `GET /attendance` | `AdminController` | `adminService.getAllAttendance(filters)` | In-memory join of attendance + users |
| `GET /employees` | `AdminController` | `adminService.listEmployees(page, limit)` | Read users CSV, paginate |
| `GET /employees/:id` | `AdminController` | `adminService.getEmployee(id)` | Find by id |
| `PATCH /employees/:id` | `AdminController` | `adminService.updateEmployee(id, dto)` | Read CSV, update row, write back |

---

## Guard & Auth Flow (NestJS way)

```
Request
  │
  ├─ [public] POST /auth/login  ──────────────────────────► AuthController
  │
  └─ [protected] all other routes
       │
       ▼
  JwtAuthGuard (extends AuthGuard('jwt'))
  passport validates token → populates req.user
       │
       ├─ /me, /attendance/*  ──────────────────────────────► Controller
       │
       └─ /admin/*
            │
            ▼
       RolesGuard
       (@Roles('admin') on controller, checks req.user.role)
            │
            ▼
           Controller
```

---

## CSV Read/Write Strategy

Since CSV files are flat files with no transactions, we use a simple in-memory approach:

1. **Read**: Load entire CSV into array of objects on each request
2. **Write**: Modify array, serialize back to CSV, overwrite file

This is acceptable for a POC. For Postgres migration, replace repository functions with SQL queries — no other code changes needed.

> **Note on concurrency**: For POC, single-process Node.js is assumed. Concurrent writes would be a concern in production (solved by Postgres).

---

## Implementation Steps

1. Scaffold NestJS app (`nest new backend --package-manager npm`)
2. Install dependencies: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `csv-parse`, `csv-stringify`, and their `@types/*`
3. Seed `data/users.csv` with one admin + one employee (pre-hashed passwords)
4. `CsvRepository` generic helper (read/write CSV)
5. `UsersRepository` (wraps CsvRepository for users)
6. `AttendanceRepository` (wraps CsvRepository for attendance)
7. `AuthModule`: `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `@Roles` decorator, `AuthService`, `AuthController`
8. `MeModule`: `MeController`
9. `AttendanceModule`: `AttendanceService`, `AttendanceController`, DTOs
10. `AdminModule`: `AdminService`, `AdminController`, DTOs
11. Wire all modules in `AppModule`, set global prefix `/api/v1`
12. Smoke test all endpoints (curl / Postman)
