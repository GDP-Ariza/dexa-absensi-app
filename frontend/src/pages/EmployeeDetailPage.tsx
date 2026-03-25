import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import * as api from '../api/client';
import type { UserProfile, AdminAttendanceRow } from '../api/client';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const now = new Date();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AdminAttendanceRow[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, working_days: 0 });
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState('');

  // Load profile
  useEffect(() => {
    if (!id) return;
    setProfileLoading(true);
    api.adminGetEmployee(id)
      .then(setProfile)
      .catch(err => setProfileError(err.message))
      .finally(() => setProfileLoading(false));
  }, [id]);

  // Load attendance
  useEffect(() => {
    if (!id) return;
    setAttLoading(true);
    setAttError('');
    api.adminGetAttendance({ employee_id: id, month, year, limit: 100 })
      .then(res => {
        setRecords(res.data);
        // Calculate stats from records
        const workingDays = countWeekdays(year, month);
        setStats({ present: res.total, absent: Math.max(0, workingDays - res.total), working_days: workingDays });
      })
      .catch(err => setAttError(err.message))
      .finally(() => setAttLoading(false));
  }, [id, month, year]);

  const yearOptions = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <>
      <Navbar />
      <div className="container page">
        <Link to="/admin/employees" className="back-link">← Employees</Link>

        {/* Profile card */}
        <div className="card">
          <div className="card-title">Employee Profile</div>
          {profileLoading && <p className="loading">Loading…</p>}
          {profileError && <div className="alert alert-error">{profileError}</div>}
          {profile && (
            <>
              <div className="avatar">{initials(profile.name)}</div>
              <div className="profile-grid">
                <span className="profile-key">Full Name</span>
                <span>{profile.name}</span>

                <span className="profile-key">Username</span>
                <span>{profile.username}</span>

                <span className="profile-key">Email</span>
                <span>{profile.email}</span>

                <span className="profile-key">Department</span>
                <span>{profile.department || '—'}</span>

                <span className="profile-key">Position</span>
                <span>{profile.position || '—'}</span>

                <span className="profile-key">Role</span>
                <span><span className={`badge badge-${profile.role}`}>{profile.role}</span></span>
              </div>
            </>
          )}
        </div>

        {/* Attendance history card */}
        <div className="card">
          <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
            <div className="card-title" style={{ margin: 0 }}>Attendance History</div>
            <div className="month-selector">
              <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Stats */}
          {!attLoading && (
            <div className="stat-grid mb-2" style={{ marginBottom: '1.25rem' }}>
              <div>
                <div className="stat-value">{stats.working_days}</div>
                <div className="stat-label">Working Days</div>
              </div>
              <div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.present}</div>
                <div className="stat-label">Present</div>
              </div>
              <div>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.absent}</div>
                <div className="stat-label">Absent</div>
              </div>
            </div>
          )}

          {attError && <div className="alert alert-error">{attError}</div>}
          {attLoading && <p className="loading">Loading…</p>}

          {!attLoading && (
            records.length === 0
              ? <p className="empty">No attendance records for this period.</p>
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={i}>
                          <td>{r.date}</td>
                          <td>{r.check_in ? formatTime(r.check_in.time) : '—'}</td>
                          <td>{r.check_out ? formatTime(r.check_out.time) : '—'}</td>
                          <td>{r.check_in?.location_name || '—'}</td>
                          <td>
                            <span className={`badge badge-${r.status}`}>
                              {r.status === 'checked_in' ? 'Checked In' : 'Completed'}
                            </span>
                          </td>
                          <td>{r.total_hours != null ? `${r.total_hours}h` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </div>
      </div>
    </>
  );
}

function countWeekdays(year: number, month: number): number {
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const d = date.getDay();
    if (d !== 0 && d !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}
