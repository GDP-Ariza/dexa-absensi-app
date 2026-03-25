import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import * as api from '../api/client';
import type { AttendanceRecord, LocationPayload } from '../api/client';

type TodayStatus = 'none' | 'checked_in' | 'completed';

function getTodayStatus(records: AttendanceRecord[]): TodayStatus {
  const today = new Date().toISOString().split('T')[0];
  const rec = records.find(r => r.date === today);
  if (!rec) return 'none';
  return rec.status as TodayStatus;
}

export function AttendancePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load today's status
  useEffect(() => {
    const now = new Date();
    api.getAttendanceSummary(now.getMonth() + 1, now.getFullYear())
      .then(s => setStatus(getTodayStatus(s.records)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Request geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported. Enter location name manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Location permission denied. Enter location name manually.'),
    );
  }, []);

  async function handleSubmit() {
    setError('');
    setSubmitting(true);

    const payload: LocationPayload = {
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
      location_name: locationName || 'Unknown',
    };

    try {
      let record: AttendanceRecord;
      if (status === 'none') {
        record = await api.checkIn(payload);
      } else {
        record = await api.checkOut(payload);
      }
      navigate('/attendance/success', { state: { record, action: status === 'none' ? 'check-in' : 'check-out' } });
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <div className="container page"><p className="loading">Loading…</p></div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="container page">
        <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <h2 className="mb-2">Attendance</h2>

          {error && <div className="alert alert-error">{error}</div>}
          {geoError && <div className="alert alert-info">{geoError}</div>}

          {status === 'completed' ? (
            <div className="alert alert-success">
              ✓ You have completed attendance for today.
            </div>
          ) : (
            <>
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                {status === 'none'
                  ? 'You have not checked in today.'
                  : 'You are currently checked in. Ready to check out?'}
              </div>

              {coords ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Latitude</label>
                    <input className="form-control" readOnly value={coords.lat.toFixed(6)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude</label>
                    <input className="form-control" readOnly value={coords.lng.toFixed(6)} />
                  </div>
                </>
              ) : null}

              <div className="form-group">
                <label className="form-label" htmlFor="loc">Location Name</label>
                <input
                  id="loc"
                  className="form-control"
                  placeholder="e.g. Office - Jakarta HQ"
                  value={locationName}
                  onChange={e => setLocationName(e.target.value)}
                />
              </div>

              <button
                className={`btn btn-full btn-lg ${status === 'none' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? 'Please wait…'
                  : status === 'none' ? 'Check In' : 'Check Out'}
              </button>
            </>
          )}

          <button className="btn btn-secondary btn-full mt-2" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    </>
  );
}
