import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';
import type { AttendanceSummary, AttendanceRecord } from '../api/client';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status === 'checked_in' ? 'Checked In' : 'Completed'}</span>;
}

function RecordsTable({ records }: { records: AttendanceRecord[] }) {
  if (!records.length) return <p className="empty">No records this month.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Status</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td>{r.check_in ? formatTime(r.check_in.time) : '—'}</td>
              <td>{r.check_out ? formatTime(r.check_out.time) : '—'}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.total_hours != null ? `${r.total_hours}h` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();

  useEffect(() => {
    api.getAttendanceSummary(now.getMonth() + 1, now.getFullYear())
      .then(setSummary)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <>
      <Navbar />
      <div className="container page">
        <h2 className="mb-2">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h2>

        {/* Summary */}
        <div className="card">
          <div className="card-title">Attendance — {monthName}</div>
          {loading && <p className="loading">Loading…</p>}
          {error && <div className="alert alert-error">{error}</div>}
          {summary && (
            <div className="stat-grid">
              <div>
                <div className="stat-value">{summary.total_working_days}</div>
                <div className="stat-label">Working Days</div>
              </div>
              <div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{summary.present}</div>
                <div className="stat-label">Present</div>
              </div>
              <div>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{summary.absent}</div>
                <div className="stat-label">Absent</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card">
          <div className="card-title">Quick Actions</div>
          <div className="action-grid">
            <button className="btn btn-primary" onClick={() => navigate('/attendance')}>
              Check In / Out
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/profile')}>
              My Profile
            </button>
            {user?.role === 'admin' && (
              <button className="btn btn-secondary" onClick={() => navigate('/admin/employees')}>
                Employee Management
              </button>
            )}
          </div>
        </div>

        {/* Records */}
        {summary && (
          <div className="card">
            <div className="card-title">This Month's Records</div>
            <RecordsTable records={summary.records} />
          </div>
        )}
      </div>
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
