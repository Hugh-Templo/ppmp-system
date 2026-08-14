import React, { useEffect, useState } from "react";
import { apiFetch } from "./api";

const formatWhen = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

function SuperadminMonitor({ token }) {
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [logins, setLogins] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ovRes, actRes, loginRes, errRes] = await Promise.all([
        apiFetch("/api/superadmin/overview", { headers }),
        apiFetch("/api/superadmin/activity?limit=50", { headers }),
        apiFetch("/api/superadmin/logins?limit=50", { headers }),
        apiFetch("/api/superadmin/errors", { headers }),
      ]);

      if (!ovRes.ok) {
        const body = await ovRes.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to load overview");
      }

      setOverview(await ovRes.json());
      if (actRes.ok) {
        const data = await actRes.json();
        setActivity(data.items || []);
      }
      if (loginRes.ok) {
        const data = await loginRes.json();
        setLogins(data.items || []);
      }
      if (errRes.ok) {
        const data = await errRes.json();
        setErrors(data.lines || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const counts = overview?.counts || {};
  const roles = counts.users_by_role || {};
  const ppmps = counts.ppmps_by_status || {};

  return (
    <div className="superadmin-monitor">
      <div className="superadmin-toolbar">
        <div>
          <h2 className="superadmin-heading">System Monitor</h2>
          <p className="superadmin-sub">
            Live overview of users, PPMP status, login attempts, and API activity.
            Hostinger network traffic is outside this panel — use Hostinger analytics for that.
          </p>
        </div>
        <button type="button" className="btn" onClick={loadAll} disabled={loading}>
          <i className={`fas ${loading ? "fa-spinner fa-spin" : "fa-sync"}`} aria-hidden="true"></i>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading && !overview ? (
        <div className="dashboard-card superadmin-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading monitoring data…
        </div>
      ) : (
        <>
          <section className="superadmin-kpis" aria-label="System counts">
            <div className="dashboard-card superadmin-kpi">
              <span>Active users</span>
              <strong>{counts.users_active ?? 0}</strong>
              <em>of {counts.users_total ?? 0} total</em>
            </div>
            <div className="dashboard-card superadmin-kpi">
              <span>Active offices</span>
              <strong>{counts.offices_active ?? 0}</strong>
              <em>of {counts.offices_total ?? 0} total</em>
            </div>
            <div className="dashboard-card superadmin-kpi">
              <span>Logins (24h)</span>
              <strong>{counts.logins_24h ?? 0}</strong>
              <em>{counts.logins_failed_24h ?? 0} failed</em>
            </div>
            <div className="dashboard-card superadmin-kpi">
              <span>API hits (24h)</span>
              <strong>{counts.api_hits_24h ?? 0}</strong>
              <em>authenticated requests</em>
            </div>
          </section>

          <section className="superadmin-split">
            <div className="dashboard-card">
              <h3 className="card-title">Users by role</h3>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Total</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(roles).length === 0 ? (
                      <tr>
                        <td colSpan="3">No users found.</td>
                      </tr>
                    ) : (
                      Object.entries(roles).map(([role, row]) => (
                        <tr key={role}>
                          <td>{role}</td>
                          <td>{row.total}</td>
                          <td>{row.active}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="card-title">PPMPs by status</h3>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(ppmps).length === 0 ? (
                      <tr>
                        <td colSpan="2">No PPMPs found.</td>
                      </tr>
                    ) : (
                      Object.entries(ppmps).map(([status, total]) => (
                        <tr key={status}>
                          <td>{status}</td>
                          <td>{total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="dashboard-card">
            <h3 className="card-title">Recent failed logins</h3>
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Username</th>
                    <th>IP</th>
                    <th>User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.failed_logins || []).length === 0 ? (
                    <tr>
                      <td colSpan="4">No failed logins recorded yet.</td>
                    </tr>
                  ) : (
                    overview.failed_logins.map((row) => (
                      <tr key={row.id}>
                        <td>{formatWhen(row.created_at)}</td>
                        <td>{row.username || "—"}</td>
                        <td>{row.ip_address || "—"}</td>
                        <td className="superadmin-ua">{row.user_agent || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="superadmin-split">
            <div className="dashboard-card">
              <h3 className="card-title">Recent login attempts</h3>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>User</th>
                      <th>Result</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logins.length === 0 ? (
                      <tr>
                        <td colSpan="4">No login attempts yet.</td>
                      </tr>
                    ) : (
                      logins.map((row) => (
                        <tr key={row.id}>
                          <td>{formatWhen(row.created_at)}</td>
                          <td>{row.username || "—"}</td>
                          <td>
                            <span className={`badge ${row.success ? "badge-success" : "badge-danger"}`}>
                              {row.success ? "OK" : "Failed"}
                            </span>
                          </td>
                          <td>{row.ip_address || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-card">
              <h3 className="card-title">Recent API activity</h3>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>User</th>
                      <th>Request</th>
                      <th>Status</th>
                      <th>ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.length === 0 ? (
                      <tr>
                        <td colSpan="5">No API activity yet.</td>
                      </tr>
                    ) : (
                      activity.map((row) => (
                        <tr key={row.id}>
                          <td>{formatWhen(row.created_at)}</td>
                          <td>{row.username || "—"}</td>
                          <td>
                            <code>
                              {row.method} {row.path}
                            </code>
                          </td>
                          <td>{row.status_code ?? "—"}</td>
                          <td>{row.duration_ms ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="dashboard-card">
            <h3 className="card-title">Recent Laravel errors</h3>
            {errors.length === 0 ? (
              <p className="superadmin-empty">No recent error lines in laravel.log.</p>
            ) : (
              <pre className="superadmin-errors">{errors.join("\n")}</pre>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default SuperadminMonitor;
