# Attendance System API Contract

Base URL: `/api/v1`

All protected endpoints require `Authorization: Bearer <token>` header.

---

## Authentication

### POST /auth/login
Login with username and password.

**Request**
```json
{
  "username": "john.doe",
  "password": "secret"
}
```

**Response 200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "u001",
    "username": "john.doe",
    "name": "John Doe",
    "role": "employee"
  }
}
```

**Response 401**
```json
{ "error": "Invalid username or password" }
```

---

### POST /auth/logout
Invalidate the current token.

**Response 200**
```json
{ "message": "Logged out successfully" }
```

---

## Profile

### GET /me
Get the authenticated user's own profile.

**Response 200**
```json
{
  "id": "u001",
  "username": "john.doe",
  "name": "John Doe",
  "email": "john.doe@company.com",
  "department": "Engineering",
  "position": "Software Engineer",
  "role": "employee"
}
```

---

## Attendance

### POST /attendance/check-in
Record a check-in. Fails if already checked in today without checking out.

**Request**
```json
{
  "latitude": -6.2088,
  "longitude": 106.8456,
  "location_name": "Office - Jakarta HQ"
}
```

**Response 201**
```json
{
  "id": "att001",
  "date": "2026-03-25",
  "check_in": {
    "time": "2026-03-25T08:30:00+07:00",
    "latitude": -6.2088,
    "longitude": 106.8456,
    "location_name": "Office - Jakarta HQ"
  },
  "check_out": null,
  "status": "checked_in"
}
```

**Response 409**
```json
{ "error": "Already checked in today" }
```

---

### POST /attendance/check-out
Record a check-out. Fails if not checked in today.

**Request**
```json
{
  "latitude": -6.2088,
  "longitude": 106.8456,
  "location_name": "Office - Jakarta HQ"
}
```

**Response 200**
```json
{
  "id": "att001",
  "date": "2026-03-25",
  "check_in": {
    "time": "2026-03-25T08:30:00+07:00",
    "latitude": -6.2088,
    "longitude": 106.8456,
    "location_name": "Office - Jakarta HQ"
  },
  "check_out": {
    "time": "2026-03-25T17:15:00+07:00",
    "latitude": -6.2088,
    "longitude": 106.8456,
    "location_name": "Office - Jakarta HQ"
  },
  "status": "completed",
  "total_hours": 8.75
}
```

**Response 400**
```json
{ "error": "No active check-in found for today" }
```

---

### GET /attendance/summary
Get the authenticated employee's attendance summary.

**Query Parameters**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | integer | current month | Month (1–12) |
| `year` | integer | current year | Year |

**Response 200**
```json
{
  "month": 3,
  "year": 2026,
  "total_working_days": 21,
  "present": 18,
  "absent": 3,
  "records": [
    {
      "id": "att001",
      "date": "2026-03-25",
      "check_in": {
        "time": "2026-03-25T08:30:00+07:00",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "location_name": "Office - Jakarta HQ"
      },
      "check_out": {
        "time": "2026-03-25T17:15:00+07:00",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "location_name": "Office - Jakarta HQ"
      },
      "status": "completed",
      "total_hours": 8.75
    }
  ]
}
```

---

## Admin

> All endpoints in this section require `role: admin`.

**Response 403** (when accessed by non-admin)
```json
{ "error": "Forbidden" }
```

---

### GET /admin/attendance
Get attendance records for all employees.

**Query Parameters**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | integer | current month | Month (1–12) |
| `year` | integer | current year | Year |
| `employee_id` | string | — | Filter by specific employee |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page |

**Response 200**
```json
{
  "page": 1,
  "limit": 20,
  "total": 45,
  "data": [
    {
      "employee": {
        "id": "u001",
        "name": "John Doe",
        "department": "Engineering"
      },
      "date": "2026-03-25",
      "check_in": {
        "time": "2026-03-25T08:30:00+07:00",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "location_name": "Office - Jakarta HQ"
      },
      "check_out": {
        "time": "2026-03-25T17:15:00+07:00",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "location_name": "Office - Jakarta HQ"
      },
      "status": "completed",
      "total_hours": 8.75
    }
  ]
}
```

---

### GET /admin/employees
List all employees.

**Query Parameters**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page |

**Response 200**
```json
{
  "page": 1,
  "limit": 20,
  "total": 10,
  "data": [
    {
      "id": "u001",
      "username": "john.doe",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "department": "Engineering",
      "position": "Software Engineer",
      "role": "employee"
    }
  ]
}
```

---

### GET /admin/employees/:id
Get a single employee's profile.

**Response 200**
```json
{
  "id": "u001",
  "username": "john.doe",
  "name": "John Doe",
  "email": "john.doe@company.com",
  "department": "Engineering",
  "position": "Software Engineer",
  "role": "employee"
}
```

**Response 404**
```json
{ "error": "Employee not found" }
```

---

### PATCH /admin/employees/:id
Update an employee's data. Send only the fields to update.

**Request**
```json
{
  "name": "John D. Doe",
  "email": "john.d.doe@company.com",
  "department": "Product",
  "position": "Product Engineer",
  "role": "employee"
}
```

**Response 200**
```json
{
  "id": "u001",
  "username": "john.doe",
  "name": "John D. Doe",
  "email": "john.d.doe@company.com",
  "department": "Product",
  "position": "Product Engineer",
  "role": "employee"
}
```

**Response 404**
```json
{ "error": "Employee not found" }
```

---

## Common Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthenticated — missing or invalid token |
| 403 | Forbidden — insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate check-in) |
| 500 | Internal server error |

---

## Data Models

### User / Employee
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique identifier |
| `username` | string | Used for login |
| `name` | string | Full name |
| `email` | string | |
| `department` | string | |
| `position` | string | Job title |
| `role` | enum | `employee` or `admin` |

### Attendance Record
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique identifier |
| `date` | string | `YYYY-MM-DD` |
| `check_in` | object \| null | Time + location |
| `check_out` | object \| null | Time + location |
| `status` | enum | `checked_in`, `completed`, `absent` |
| `total_hours` | float \| null | Populated after check-out |

### Location Object
| Field | Type | Notes |
|-------|------|-------|
| `time` | string | ISO 8601 with timezone |
| `latitude` | float | |
| `longitude` | float | |
| `location_name` | string | Human-readable label |
