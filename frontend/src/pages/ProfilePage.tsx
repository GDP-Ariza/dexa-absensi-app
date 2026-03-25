import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import * as api from '../api/client';
import type { UserProfile } from '../api/client';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMe()
      .then(setProfile)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <div className="container page">
        <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 className="mb-2">My Profile</h2>

          {loading && <p className="loading">Loading…</p>}
          {error && <div className="alert alert-error">{error}</div>}

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
                <span>
                  <span className={`badge badge-${profile.role}`}>{profile.role}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
