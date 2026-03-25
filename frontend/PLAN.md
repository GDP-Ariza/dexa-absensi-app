# Frontend Implementation Plan

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | TypeScript | Consistent with backend |
| Framework | React 18 + Vite | Fast dev setup, minimal config |
| Routing | React Router v6 | Standard SPA routing |
| HTTP client | fetch (native) | No extra dependency needed for POC |
| Auth storage | localStorage | Simple, persists across tabs |
| Styling | Plain CSS | No framework overhead; POC requirement |
| State | React Context | Auth state only; local state for the rest |

---

## Project Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
│
└── src/
    ├── main.tsx                  # Mount <App /> into #root
    ├── App.tsx                   # Router setup, all routes defined here
    │
    ├── api/
    │   └── client.ts             # Thin fetch wrapper — attaches Bearer token,
    │                             #   throws on non-2xx, exports typed helpers
    │
    ├── context/
    │   └── AuthContext.tsx       # Stores { token, user }, exposes login() /
    │                             #   logout(), reads from localStorage on load
    │
    ├── components/
    │   ├── ProtectedRoute.tsx    # Redirects to /login if no token
    │   ├── AdminRoute.tsx        # ProtectedRoute + redirects if role != admin
    │   └── Navbar.tsx            # Top nav: username, logout, back-to-home link
    │
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── HomePage.tsx
    │   ├── AttendancePage.tsx
    │   ├── AttendanceSuccessPage.tsx
    │   ├── ProfilePage.tsx
    │   ├── EmployeeListPage.tsx
    │   └── EmployeeDetailPage.tsx
    │
    └── styles/
        └── global.css            # Reset + shared variables + utility classes
```

---

## Page Inventory

### Employee Pages

| Route | Page | API calls |
|-------|------|-----------|
| `/login` | Login | `POST /auth/login` |
| `/` | Homepage | `GET /attendance/summary` |
| `/attendance` | Check-in / Check-out | `GET /attendance/summary`, `POST /attendance/check-in` or `check-out` |
| `/attendance/success` | Success confirmation | none (reads state passed via navigation) |
| `/profile` | My Profile | `GET /me` |

### Admin Pages

| Route | Page | API calls |
|-------|------|-----------|
| `/admin/employees` | Employee List | `GET /admin/employees` |
| `/admin/employees/:id` | Employee Detail | `GET /admin/employees/:id`, `GET /admin/attendance?employee_id=:id` |

---

## Page-by-Page Design

---

### 1. Login — `/login`

**Layout:** Centered card, vertically centered on screen.

**Elements:**
- App title / logo text
- Username input
- Password input
- "Login" button (disabled + shows "Logging in…" while loading)
- Error message area (e.g. "Invalid username or password")

**Behaviour:**
- On submit → `POST /api/v1/auth/login`
- On success → save token + user to `AuthContext`, redirect to `/`
- If already logged in → redirect to `/` immediately

---

### 2. Homepage — `/`

**Layout:** Centered container, card-based sections.

**Elements:**
- `Navbar` (username + logout)
- Welcome heading: "Good morning, {name}"
- **Attendance Summary card** — current month, shows:
  - Total working days
  - Present count
  - Absent count
  - Simple 3-column stat display
- **Action buttons row:**
  - "Check In / Check Out" → `/attendance`
  - "My Profile" → `/profile`
  - *(admin only)* "Employee Management" → `/admin/employees`
- Attendance records table (this month's records, compact view)

**Behaviour:**
- Fetches `GET /attendance/summary` for the current month on mount
- Shows loading skeleton while fetching
- The "Employee Management" button only renders when `user.role === 'admin'`

---

### 3. Check-in / Check-out — `/attendance`

**Layout:** Centered card.

**Elements:**
- `Navbar`
- Page heading: "Attendance"
- **Status area** — derived from today's record in the summary:
  - No record today → show "Check In" button
  - Status `checked_in` → show "Check Out" button
  - Status `completed` → show "Attendance complete for today ✓"
- Location field (pre-filled from browser Geolocation API if permission granted, otherwise a text input for manual entry)
- Latitude / Longitude shown as read-only if geolocation is available
- Submit button
- Error message area

**Behaviour:**
1. On mount, fetch `GET /attendance/summary` to determine today's status
2. Request geolocation (`navigator.geolocation.getCurrentPosition`); if denied, show text input for `location_name` only (lat/lng default to `0, 0` as POC fallback)
3. On submit → `POST /attendance/check-in` or `check-out`
4. On success → navigate to `/attendance/success` passing action + record via `state`
5. On error → show error message inline

---

### 4. Attendance Success — `/attendance/success`

**Layout:** Centered card, minimal.

**Elements:**
- Large checkmark icon (CSS-drawn or unicode ✓)
- Heading: "Checked In!" or "Checked Out!"
- Summary:
  - Date
  - Time
  - Location name
  - *(check-out only)* Total hours worked
- "Back to Home" button → `/`

**Behaviour:**
- Reads data from `location.state` (passed by `AttendancePage` after success)
- If navigated to directly (no state) → redirect to `/`

---

### 5. Profile — `/profile`

**Layout:** Centered card.

**Elements:**
- `Navbar`
- Avatar placeholder (initials from name, CSS circle)
- Profile fields in a 2-column definition-list style:
  - Full Name
  - Username
  - Email
  - Department
  - Position
  - Role (badge: "Employee" / "Admin")

**Behaviour:**
- Fetches `GET /me` on mount
- Shows loading state while fetching

---

### 6. Employee List — `/admin/employees` *(admin only)*

**Layout:** Full-width table card.

**Elements:**
- `Navbar`
- Page heading: "Employees"
- Pagination controls (prev / next, page info)
- Table columns: Name | Department | Position | Role | Action
- Each row has a "View" button → `/admin/employees/:id`

**Behaviour:**
- `AdminRoute` wrapper redirects non-admins to `/`
- Fetches `GET /admin/employees?page=N&limit=20` on mount and on page change
- Shows loading state and empty state

---

### 7. Employee Detail — `/admin/employees/:id` *(admin only)*

**Layout:** Centered container, two cards stacked.

**Elements:**
- `Navbar`
- Back link: "← Employees"
- **Profile card:** same fields as Profile page
- **Attendance History card:**
  - Month/year selector (defaults to current month)
  - Stats: present / absent / working days
  - Table: Date | Check-in Time | Check-out Time | Location | Status | Hours
  - Empty state if no records

**Behaviour:**
- Fetches `GET /admin/employees/:id` for the profile
- Fetches `GET /admin/attendance?employee_id=:id&month=M&year=Y` for the history
- Re-fetches attendance when month/year selector changes

---

## Auth & Routing Flow

```
User visits any route
       │
       ▼
  Has token in localStorage?
       │
  No ──┼──► /login
       │          │
  Yes  │          │ POST /auth/login success
       │          ▼
       │     Save to AuthContext + localStorage
       │          │
       ▼          ▼
  ProtectedRoute  /  (redirect based on role)
       │
       ├── role = employee ──► /  (Homepage)
       └── role = admin    ──► /  (Homepage with extra button)

  /admin/* wrapped in AdminRoute
       │
       └── role != admin ──► redirect to /
```

---

## API Client Design (`src/api/client.ts`)

Thin wrapper that:
1. Prepends the base URL (`http://localhost:3000/api/v1`)
2. Attaches `Authorization: Bearer <token>` from localStorage
3. Throws a structured error `{ status, message }` on non-2xx
4. Exports typed functions matching each endpoint:

```
login(username, password)
logout()
getMe()
checkIn(payload)
checkOut(payload)
getAttendanceSummary(month?, year?)
adminGetAllAttendance(filters)
adminListEmployees(page, limit)
adminGetEmployee(id)
adminUpdateEmployee(id, data)
```

---

## Styling Approach

Single `global.css` file. No CSS modules or styled-components — keep it flat for a POC.

**Design tokens (CSS variables):**
```css
--color-primary: #2563eb;
--color-bg: #f3f4f6;
--color-surface: #ffffff;
--color-text: #111827;
--color-muted: #6b7280;
--color-border: #e5e7eb;
--color-success: #16a34a;
--color-danger: #dc2626;
--radius: 8px;
--shadow: 0 1px 3px rgba(0,0,0,0.1);
```

**Shared utility classes:**
- `.container` — max-width 960px, centered, padding
- `.card` — white bg, border-radius, box-shadow, padding
- `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-danger`
- `.badge` — inline pill for role labels
- `.table` — full-width, striped rows
- `.form-group` / `.form-control` / `.form-error`
- `.stat-grid` — 3-column grid for summary numbers

---

## Implementation Steps

1. Scaffold with Vite: `npm create vite@latest . -- --template react-ts`
2. Install React Router: `npm install react-router-dom`
3. `global.css` — design tokens + utility classes
4. `api/client.ts` — fetch wrapper + all endpoint functions
5. `AuthContext.tsx` + `ProtectedRoute` + `AdminRoute`
6. `Navbar.tsx`
7. `LoginPage.tsx`
8. `HomePage.tsx`
9. `AttendancePage.tsx` + `AttendanceSuccessPage.tsx`
10. `ProfilePage.tsx`
11. `EmployeeListPage.tsx`
12. `EmployeeDetailPage.tsx`
13. Wire all routes in `App.tsx`
14. Configure Vite dev proxy → `http://localhost:3000` (avoids CORS in dev)
