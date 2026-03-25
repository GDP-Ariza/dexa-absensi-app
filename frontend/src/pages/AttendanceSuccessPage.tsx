import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import type { AttendanceRecord } from '../api/client';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export function AttendanceSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { record: AttendanceRecord; action: 'check-in' | 'check-out' } | null;

  if (!state) return <Navigate to="/" replace />;

  const { record, action } = state;
  const isCheckIn = action === 'check-in';
  const eventData = isCheckIn ? record.check_in : record.check_out;

  return (
    <>
      <Navbar />
      <div className="container page">
        <div className="card text-center" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="success-icon">✓</div>
          <h2 className="mb-1">{isCheckIn ? 'Checked In!' : 'Checked Out!'}</h2>
          <p className="text-muted mb-2">{isCheckIn ? 'Your check-in has been recorded.' : 'Your check-out has been recorded.'}</p>

          <div style={{ textAlign: 'left', marginTop: '1.5rem' }}>
            <div className="profile-grid">
              <span className="profile-key">Date</span>
              <span>{record.date}</span>

              <span className="profile-key">Time</span>
              <span>{eventData ? formatDateTime(eventData.time) : '—'}</span>

              <span className="profile-key">Location</span>
              <span>{eventData?.location_name || '—'}</span>

              {!isCheckIn && record.total_hours != null && (
                <>
                  <span className="profile-key">Hours Worked</span>
                  <span>{record.total_hours}h</span>
                </>
              )}
            </div>
          </div>

          <button className="btn btn-primary btn-full mt-3" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    </>
  );
}
