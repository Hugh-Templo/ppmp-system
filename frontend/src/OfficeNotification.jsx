import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";

const defaultFiscalYear = () => new Date().getFullYear() + 1;

const emptyForm = () => ({
  fiscal_year: String(defaultFiscalYear()),
  title: "",
  message: "",
  deadline_at: "",
});

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(value);
  }
};

const formatDateTime = (value) => {
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

function OfficeNotificationPanel({ token, showNotification, showConfirm }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [mailQuota, setMailQuota] = useState(null);
  const [maintenance, setMaintenance] = useState({ is_enabled: false, message: "" });
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const yearOptions = useMemo(() => {
    const base = defaultFiscalYear();
    return [base - 1, base, base + 1, base + 2];
  }, []);

  const emailBlockedByQuota = Boolean(
    mailQuota && !mailQuota.can_email_all_recipients && (mailQuota.active_end_user_recipients || 0) > 0
  );

  const loadMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await apiFetch("/api/bac/maintenance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMaintenance({
          is_enabled: Boolean(data.is_enabled),
          message: data.message || "",
        });
      }
    } catch {
      // non-fatal
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const saveMaintenance = async (next) => {
    setMaintenanceSaving(true);
    try {
      const res = await apiFetch("/api/bac/maintenance", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_enabled: Boolean(next.is_enabled),
          message: (next.message || "").trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotification(data.detail || data.message || "Failed to update maintenance mode", "error");
        return false;
      }
      setMaintenance({
        is_enabled: Boolean(data.is_enabled),
        message: data.message || "",
      });
      showNotification(
        data.is_enabled ? "Maintenance mode enabled" : "Maintenance mode disabled",
        "success"
      );
      return true;
    } catch {
      showNotification("Failed to update maintenance mode", "error");
      return false;
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    await saveMaintenance({
      is_enabled: maintenance.is_enabled,
      message: maintenance.message,
    });
  };

  const handleToggleMaintenance = () => {
    if (maintenance.is_enabled) {
      saveMaintenance({
        is_enabled: false,
        message: maintenance.message,
      });
      return;
    }

    showConfirm({
      title: "Enable maintenance mode?",
      message:
        "End users and Budget Office will be signed out and cannot log in. BAC Admin can still sign in to turn this off.",
      confirmLabel: "Enable",
      onConfirm: async () => {
        await saveMaintenance({
          is_enabled: true,
          message: maintenance.message,
        });
      },
    });
  };

  const loadMailQuota = async () => {
    try {
      const res = await apiFetch("/api/bac/office-notifications/mail-quota", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMailQuota(await res.json());
      }
    } catch {
      // non-fatal
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/bac/office-notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotification(err.detail || "Failed to load office notifications", "error");
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      await loadMailQuota();
    } catch {
      showNotification("Failed to load office notifications", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    loadMaintenance();
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      fiscal_year: String(row.fiscal_year ?? defaultFiscalYear()),
      title: row.title || "",
      message: row.message || "",
      deadline_at: row.deadline_at || "",
    });
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const buildPayload = () => ({
    fiscal_year: parseInt(form.fiscal_year, 10),
    title: form.title.trim(),
    message: form.message.trim(),
    deadline_at: form.deadline_at || null,
  });

  const publishNotification = async (id, { sendEmail = true } = {}) => {
    const res = await apiFetch(`/api/bac/office-notifications/${id}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ send_email: sendEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.mail_quota) setMailQuota(data.mail_quota);
    return { res, data };
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload.title || !payload.message || !payload.fiscal_year) {
      showNotification("Please fill in title, message, and fiscal year.", "error");
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/bac/office-notifications/${editingId}`
        : "/api/bac/office-notifications";
      const method = editingId ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotification(data.detail || "Failed to save notification", "error");
        return;
      }
      showNotification(data.message || "Notification saved");
      resetForm();
      await loadItems();
    } catch {
      showNotification("Failed to save notification", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmPublish = ({ title, message, confirmLabel, sendEmail, prepareId }) => {
    showConfirm({
      title,
      message,
      confirmLabel,
      onConfirm: async () => {
        setSaving(true);
        setPublishingId("pending");
        try {
          const id = await prepareId();
          if (!id) return;
          setPublishingId(id);
          const { res, data } = await publishNotification(id, { sendEmail });
          if (!res.ok) {
            showNotification(data.detail || data.message || "Failed to publish notification", "error");
            await loadItems();
            return;
          }
          showNotification(data.message || "Notification published");
          resetForm();
          await loadItems();
        } catch {
          showNotification("Failed to publish notification", "error");
        } finally {
          setSaving(false);
          setPublishingId(null);
        }
      },
    });
  };

  const handlePublish = (row, { sendEmail = true } = {}) => {
    const isResend = row.status === "published" && sendEmail;
    const recipients = mailQuota?.active_end_user_recipients ?? "?";
    const remaining = mailQuota?.remaining ?? "?";

    if (sendEmail && emailBlockedByQuota) {
      showNotification(
        `Resend free-tier limit reached (remaining ${remaining}). Use “Publish without email” or try again tomorrow.`,
        "error"
      );
      return;
    }

    confirmPublish({
      title: !sendEmail
        ? "Publish without email?"
        : isResend
          ? "Send email again?"
          : "Publish & email?",
      message: !sendEmail
        ? `Publish "${row.title}" to end-user dashboards only (no Resend emails).`
        : isResend
          ? `Re-send "${row.title}" to ${recipients} active end user(s)? Remaining free-tier quota: ${remaining}.`
          : `Publish "${row.title}" and email ${recipients} end user(s)? Remaining free-tier quota: ${remaining}.`,
      confirmLabel: !sendEmail ? "Publish only" : isResend ? "Send again" : "Publish & email",
      sendEmail,
      prepareId: async () => {
        if (editingId === row.id) {
          const payload = buildPayload();
          const saveRes = await apiFetch(`/api/bac/office-notifications/${row.id}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!saveRes.ok) {
            const err = await saveRes.json().catch(() => ({}));
            showNotification(err.detail || "Failed to save before publish", "error");
            return null;
          }
        }
        return row.id;
      },
    });
  };

  const handleDelete = (row) => {
    showConfirm({
      title: "Delete notification?",
      message: `Delete "${row.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/bac/office-notifications/${row.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showNotification(data.detail || "Failed to delete notification", "error");
            return;
          }
          showNotification(data.message || "Notification deleted");
          if (editingId === row.id) resetForm();
          await loadItems();
        } catch {
          showNotification("Failed to delete notification", "error");
        }
      },
    });
  };

  const handlePublishFromForm = async (e, { sendEmail = true } = {}) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload.title || !payload.message || !payload.fiscal_year) {
      showNotification("Please fill in title, message, and fiscal year.", "error");
      return;
    }

    if (sendEmail && emailBlockedByQuota) {
      showNotification(
        `Resend free-tier limit reached (remaining ${mailQuota?.remaining ?? 0}). Use “Publish without email” or try again tomorrow.`,
        "error"
      );
      return;
    }

    const recipients = mailQuota?.active_end_user_recipients ?? "?";
    const remaining = mailQuota?.remaining ?? "?";

    confirmPublish({
      title: sendEmail ? (editingId ? "Save & publish?" : "Create, publish & email?") : "Publish without email?",
      message: sendEmail
        ? `This publishes the notice on all end-user dashboards and queues email to ${recipients} end user(s). Remaining Resend free-tier quota: ${remaining}.`
        : "This publishes the notice on dashboards only. No Resend emails will be sent.",
      confirmLabel: sendEmail ? "Publish & email" : "Publish only",
      sendEmail,
      prepareId: async () => {
        let id = editingId;
        if (id) {
          const saveRes = await apiFetch(`/api/bac/office-notifications/${id}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!saveRes.ok) {
            const err = await saveRes.json().catch(() => ({}));
            showNotification(err.detail || "Failed to save notification", "error");
            return null;
          }
        } else {
          const createRes = await apiFetch("/api/bac/office-notifications", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const created = await createRes.json().catch(() => ({}));
          if (!createRes.ok) {
            showNotification(created.detail || "Failed to create notification", "error");
            return null;
          }
          id = created.notification?.id;
        }
        if (!id) {
          showNotification("Could not determine notification id to publish", "error");
          return null;
        }
        return id;
      },
    });
  };

  return (
    <div className="office-notification-page">
      <div
        className={`office-maintenance-card${maintenance.is_enabled ? " is-on" : ""}`}
        role="status"
      >
        <div className="office-maintenance-card__header">
          <div className="office-maintenance-card__title">
            <i className="fas fa-tools" aria-hidden="true" />
            System Maintenance Mode
          </div>
          <span
            className={`office-maintenance-chip${maintenance.is_enabled ? " is-on" : ""}`}
          >
            {maintenanceLoading ? "…" : maintenance.is_enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="office-maintenance-card__help">
          When enabled, end users and Budget Office cannot sign in. BAC Admin and Super Admin can
          still log in to turn this off. The optional message appears on the login page.
        </p>
        <div className="form-group" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label" htmlFor="maintenance-message">
            Login banner message (optional)
          </label>
          <textarea
            id="maintenance-message"
            className="form-input"
            rows={3}
            value={maintenance.message}
            onChange={(e) =>
              setMaintenance((prev) => ({ ...prev, message: e.target.value }))
            }
            placeholder="System is under maintenance until 6:00 PM."
            disabled={maintenanceLoading || maintenanceSaving}
          />
        </div>
        <div className="office-maintenance-card__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSaveMaintenanceMessage}
            disabled={maintenanceLoading || maintenanceSaving}
          >
            {maintenanceSaving ? "Saving..." : "Save message"}
          </button>
          <button
            type="button"
            className={maintenance.is_enabled ? "btn btn-success" : "btn btn-danger"}
            onClick={handleToggleMaintenance}
            disabled={maintenanceLoading || maintenanceSaving}
          >
            {maintenance.is_enabled ? "Disable maintenance" : "Enable maintenance"}
          </button>
        </div>
      </div>

      {mailQuota && (
        <div
          className={`office-mail-quota ${emailBlockedByQuota ? "is-blocked" : ""}`}
          role="status"
        >
          <div className="office-mail-quota__title">
            <i className="fas fa-envelope" aria-hidden="true" />
            Resend free-tier quota
          </div>
          <div className="office-mail-quota__grid">
            <span>
              Today: <strong>{mailQuota.sent_today}</strong> / {mailQuota.daily_limit}
              {" "}({mailQuota.remaining_today} left)
            </span>
            <span>
              This month: <strong>{mailQuota.sent_this_month}</strong> / {mailQuota.monthly_limit}
              {" "}({mailQuota.remaining_this_month} left)
            </span>
            <span>
              Active end-user recipients: <strong>{mailQuota.active_end_user_recipients}</strong>
            </span>
          </div>
          {emailBlockedByQuota && (
            <p className="office-mail-quota__warn">
              Emailing all recipients would exceed the free tier. You can still publish the notice
              to dashboards without email, or wait until quota resets.
            </p>
          )}
        </div>
      )}

      <div className="dashboard-card">
        <h2 className="card-title">
          {editingId ? "Edit Office Notification" : "New Office Notification"}
        </h2>
        <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
          Publish a notice to all offices — PPMP deadline, maintenance schedule, or other reminders.
          Leave the deadline blank when the date/time belongs in the message (for example scheduled
          maintenance). Publishing emails every active end user and shows the notice on their dashboard.
          Email sends are capped at Resend free-tier limits (100/day, 3,000/month).
        </p>
        <form className="office-notification-form" onSubmit={handleSaveDraft}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="on-fy">
                Fiscal Year
              </label>
              <select
                id="on-fy"
                className="form-input"
                value={form.fiscal_year}
                onChange={handleChange("fiscal_year")}
                required
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="on-deadline">
                Deadline (optional)
              </label>
              <input
                id="on-deadline"
                type="date"
                className="form-input"
                value={form.deadline_at}
                onChange={handleChange("deadline_at")}
              />
              <p className="form-help" style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                Optional. Use this for PPMP due dates. For maintenance, leave this blank and type the
                schedule in the message.
              </p>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="on-title">
              Title
            </label>
            <input
              id="on-title"
              type="text"
              className="form-input"
              value={form.title}
              onChange={handleChange("title")}
              placeholder="e.g. Indicative PPMP Submission Deadline"
              maxLength={255}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="on-message">
              Message
            </label>
            <textarea
              id="on-message"
              className="form-input"
              rows={5}
              value={form.message}
              onChange={handleChange("message")}
              placeholder="e.g. Indicative PPMP due Friday, or: System maintenance on Aug 21, 8:00–10:00 PM."
              maxLength={5000}
              required
            />
          </div>
          <div className="office-notification-actions">
            <button type="submit" className="btn btn-secondary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Save as draft"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={saving || emailBlockedByQuota}
              onClick={(e) => handlePublishFromForm(e, { sendEmail: true })}
              title={emailBlockedByQuota ? "Blocked by Resend free-tier quota" : undefined}
            >
              Publish &amp; email
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={(e) => handlePublishFromForm(e, { sendEmail: false })}
            >
              Publish without email
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="dashboard-card">
        <div className="card-title-bar" style={{ marginBottom: "1rem" }}>
          <h2 className="card-title">Past Notifications</h2>
          <button type="button" className="btn btn-secondary" onClick={loadItems} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>FY</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Last emailed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan="6">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="6">No office notifications yet.</td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.title}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 4 }}>
                      {(row.message || "").slice(0, 100)}
                      {(row.message || "").length > 100 ? "…" : ""}
                    </div>
                  </td>
                  <td>{row.fiscal_year}</td>
                  <td>{row.deadline_at ? formatDate(row.deadline_at) : "—"}</td>
                  <td>
                    <span
                      className={`badge ${
                        row.status === "published" ? "badge-success" : "badge-secondary"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    {formatDateTime(row.emailed_at)}
                    {row.emails_queued > 0 ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {row.emails_queued} emailed
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={publishingId === row.id || emailBlockedByQuota}
                        onClick={() => handlePublish(row, { sendEmail: true })}
                        title={emailBlockedByQuota ? "Blocked by Resend free-tier quota" : undefined}
                      >
                        {publishingId === row.id
                          ? "Sending…"
                          : row.status === "published"
                            ? "Send again"
                            : "Publish & email"}
                      </button>
                      {row.status !== "published" && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={publishingId === row.id}
                          onClick={() => handlePublish(row, { sendEmail: false })}
                        >
                          Publish only
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDelete(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Deadline banner for the end-user dashboard */
export function OfficeDeadlineBanner({ notice }) {
  if (!notice) return null;

  const deadline = notice.deadline_at ? new Date(`${notice.deadline_at}T00:00:00`) : null;
  let daysLeft = null;
  if (deadline && !Number.isNaN(deadline.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  let urgency = "ok";
  let urgencyLabel = "";
  if (daysLeft === null) {
    urgencyLabel = "";
  } else if (daysLeft < 0) {
    urgency = "overdue";
    urgencyLabel = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"}`;
  } else if (daysLeft === 0) {
    urgency = "soon";
    urgencyLabel = "Due today";
  } else if (daysLeft <= 7) {
    urgency = "soon";
    urgencyLabel = `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
  } else {
    urgencyLabel = `${daysLeft} days remaining`;
  }

  return (
    <div className={`office-deadline-banner urgency-${urgency}`} role="status">
      <div className="office-deadline-banner__icon" aria-hidden="true">
        <i className={`fas ${urgency === "overdue" ? "fa-exclamation-triangle" : "fa-bell"}`} />
      </div>
      <div className="office-deadline-banner__body">
        <div className="office-deadline-banner__top">
          <strong>{notice.title}</strong>
          {urgencyLabel && (
            <span className={`office-deadline-banner__chip urgency-${urgency}`}>{urgencyLabel}</span>
          )}
        </div>
        <p className="office-deadline-banner__message">{notice.message}</p>
        <div className="office-deadline-banner__meta">
          <span>
            <i className="fas fa-calendar-alt" aria-hidden="true" /> Fiscal Year {notice.fiscal_year}
          </span>
          {notice.deadline_at ? (
            <span>
              <i className="fas fa-hourglass-half" aria-hidden="true" /> Deadline{" "}
              {formatDate(notice.deadline_at)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default OfficeNotificationPanel;
