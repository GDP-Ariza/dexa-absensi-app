const BASE = '/api/v1';

function getToken(): string {
  return localStorage.getItem('token') ?? '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message ?? `HTTP ${res.status}`;
    throw { status: res.status, message: Array.isArray(message) ? message.join(', ') : message };
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────
export function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return request<{ message: string }>('/auth/logout', { method: 'POST' });
}

// ── Me ────────────────────────────────────────────────────────────────
export function getMe() {
  return request<UserProfile>('/me');
}

// ── Attendance ────────────────────────────────────────────────────────
export function checkIn(payload: LocationPayload) {
  return request<AttendanceRecord>('/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function checkOut(payload: LocationPayload) {
  return request<AttendanceRecord>('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAttendanceSummary(month?: number, year?: number) {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  const qs = params.toString();
  return request<AttendanceSummary>(`/attendance/summary${qs ? '?' + qs : ''}`);
}

// ── Admin ─────────────────────────────────────────────────────────────
export function adminListEmployees(page = 1, limit = 20) {
  return request<PagedResult<UserProfile>>(`/admin/employees?page=${page}&limit=${limit}`);
}

export function adminGetEmployee(id: string) {
  return request<UserProfile>(`/admin/employees/${id}`);
}

export function adminUpdateEmployee(id: string, data: Partial<UserProfile>) {
  return request<UserProfile>(`/admin/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function adminGetAttendance(filters: AdminAttendanceFilter) {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', String(filters.month));
  if (filters.year) params.set('year', String(filters.year));
  if (filters.employee_id) params.set('employee_id', filters.employee_id);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  return request<PagedResult<AdminAttendanceRow>>(`/admin/attendance?${params.toString()}`);
}

// ── Types ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  name: string;
  role: 'employee' | 'admin';
}

export interface UserProfile extends User {
  email: string;
  department: string;
  position: string;
  created_at: string;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  location_name?: string;
}

export interface CheckInOut {
  time: string;
  latitude: number;
  longitude: number;
  location_name: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  check_in: CheckInOut | null;
  check_out: CheckInOut | null;
  status: 'checked_in' | 'completed';
  total_hours: number | null;
}

export interface AttendanceSummary {
  month: number;
  year: number;
  total_working_days: number;
  present: number;
  absent: number;
  records: AttendanceRecord[];
}

export interface AdminAttendanceRow {
  employee: { id: string; name: string; department: string };
  date: string;
  check_in: CheckInOut | null;
  check_out: CheckInOut | null;
  status: string;
  total_hours: number | null;
}

export interface AdminAttendanceFilter {
  month?: number;
  year?: number;
  employee_id?: string;
  page?: number;
  limit?: number;
}

export interface PagedResult<T> {
  page: number;
  limit: number;
  total: number;
  data: T[];
}
