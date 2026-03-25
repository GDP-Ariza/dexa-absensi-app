import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import * as api from '../api/client';
import type { UserProfile, PagedResult } from '../api/client';

export function EmployeeListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PagedResult<UserProfile> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.adminListEmployees(page, limit)
      .then(setResult)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = result ? Math.ceil(result.total / limit) : 0;

  return (
    <>
      <Navbar />
      <div className="container page">
        <div className="flex items-center justify-between mb-2">
          <h2>Employees</h2>
          {result && <span className="text-muted">{result.total} total</span>}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          {loading ? (
            <p className="loading">Loading…</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Position</th>
                    <th>Role</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {result?.data.length === 0 && (
                    <tr><td colSpan={5} className="empty">No employees found.</td></tr>
                  )}
                  {result?.data.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div className="font-bold">{emp.name}</div>
                        <div className="text-muted" style={{ fontSize: '.8rem' }}>{emp.email}</div>
                      </td>
                      <td>{emp.department || '—'}</td>
                      <td>{emp.position || '—'}</td>
                      <td><span className={`badge badge-${emp.role}`}>{emp.role}</span></td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/admin/employees/${emp.id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className="text-muted">Page {page} of {totalPages}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
