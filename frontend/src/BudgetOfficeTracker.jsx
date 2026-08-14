import React, { useMemo, useState } from "react";

const STATUS_META = [
  {
    key: "not_started",
    label: "Not started",
    color: "#94a3b8",
    icon: "fa-circle",
  },
  {
    key: "uploaded_not_submitted",
    label: "Uploaded, not submitted",
    color: "#3b82f6",
    icon: "fa-file-upload",
  },
  {
    key: "needs_revision",
    label: "Needs revision",
    color: "#ef4444",
    icon: "fa-undo",
  },
  {
    key: "submitted",
    label: "Submitted",
    color: "#f59e0b",
    icon: "fa-paper-plane",
    countKey: "pending_review",
  },
  {
    key: "verified",
    label: "Verified",
    color: "#10b981",
    icon: "fa-check-circle",
  },
];

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

const formatUpdatedAt = (value) => {
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

function DonutChart({ segments, total }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 68;
  const stroke = 22;

  if (!total) {
    return (
      <svg className="tracker-donut" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#c8ccd1"
          strokeWidth={stroke}
          opacity="0.45"
        />
      </svg>
    );
  }

  let angle = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { ...s, start, end: Math.min(end, 359.999) };
    });

  return (
    <svg className="tracker-donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Status distribution">
      {arcs.length === 1 ? (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={arcs[0].color}
          strokeWidth={stroke}
        />
      ) : (
        arcs.map((arc) => (
          <path
            key={arc.key}
            d={describeArc(cx, cy, radius, arc.start, arc.end)}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        ))
      )}
      <circle cx={cx} cy={cy} r={radius - stroke / 2 - 4} fill="var(--neuro-bg)" />
    </svg>
  );
}

function ProgressRing({ value, max }) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = c * (1 - pct);

  return (
    <svg className="tracker-progress-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#c8ccd1"
        strokeWidth={stroke}
        opacity="0.5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--primary-color)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function BudgetOfficeTracker({
  data,
  loading,
  fiscalYear,
  onFiscalYearChange,
  yearOptions = [],
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const totals = data?.totals || {
    offices: 0,
    submitted: 0,
    verified: 0,
    uploaded_not_submitted: 0,
    needs_revision: 0,
    not_started: 0,
    pending_review: 0,
  };

  const offices = data?.offices || [];
  const officeCount = totals.offices || 0;
  const submittedCount = totals.submitted || 0;
  const completionPct =
    officeCount > 0 ? Math.round((submittedCount / officeCount) * 100) : 0;

  const segments = STATUS_META.map((meta) => ({
    key: meta.key,
    label: meta.label,
    color: meta.color,
    value: Number(
      totals[meta.countKey || meta.key] ??
        (meta.key === "submitted" ? totals.pending_review : 0)
    ),
  }));

  const filteredOffices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offices.filter((row) => {
      if (statusFilter !== "all" && row.status_key !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(row.name || "").toLowerCase().includes(q) ||
        String(row.code || "").toLowerCase().includes(q) ||
        String(row.ppmp?.title || "").toLowerCase().includes(q)
      );
    });
  }, [offices, search, statusFilter]);

  const years =
    yearOptions.length > 0
      ? yearOptions
      : [fiscalYear - 1, fiscalYear, fiscalYear + 1, fiscalYear + 2];

  return (
    <div className="budget-tracker">
      <div className="budget-tracker-toolbar">
        <div>
          <h2 className="budget-tracker-heading">PPMP Compliance Overview</h2>
          <p className="budget-tracker-sub">
            Track which offices have uploaded, submitted, or still need action for the selected fiscal year.
          </p>
        </div>
        <label className="budget-tracker-fy">
          <span>Fiscal Year</span>
          <select
            value={fiscalYear}
            onChange={(e) => onFiscalYearChange(Number(e.target.value))}
            disabled={loading}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && !data ? (
        <div className="dashboard-card budget-tracker-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading office compliance…
        </div>
      ) : (
        <>
          <section className="dashboard-card budget-tracker-hero" aria-label="Submission progress">
            <div className="budget-tracker-hero__ring">
              <ProgressRing value={submittedCount} max={officeCount} />
              <div className="budget-tracker-hero__ratio">
                <strong>
                  {submittedCount}
                  <span> / {officeCount}</span>
                </strong>
                <em>{completionPct}% complete</em>
              </div>
            </div>
            <div className="budget-tracker-hero__copy">
              <h3>Offices that submitted a PPMP</h3>
              <p>
                Count of offices whose latest FY {fiscalYear} plan is{" "}
                <strong>Submitted</strong> (pending budget review) or{" "}
                <strong>Verified</strong>.
              </p>
              <div className="budget-tracker-hero__bar" role="presentation">
                <div
                  className="budget-tracker-hero__bar-fill"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <small>
                {officeCount - submittedCount} office
                {officeCount - submittedCount === 1 ? "" : "s"} still outstanding
              </small>
            </div>
          </section>

          <section className="budget-tracker-kpis" aria-label="Status summary">
            {STATUS_META.map((meta) => {
              const count =
                meta.countKey != null
                  ? Number(totals[meta.countKey] || 0)
                  : Number(totals[meta.key] || 0);
              return (
                <button
                  key={meta.key}
                  type="button"
                  className={`budget-tracker-kpi${
                    statusFilter === meta.key ? " is-active" : ""
                  }`}
                  style={{ "--kpi-accent": meta.color }}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === meta.key ? "all" : meta.key
                    )
                  }
                >
                  <span className="budget-tracker-kpi__icon">
                    <i className={`fas ${meta.icon}`} aria-hidden="true"></i>
                  </span>
                  <span className="budget-tracker-kpi__value">{count}</span>
                  <span className="budget-tracker-kpi__label">{meta.label}</span>
                </button>
              );
            })}
          </section>

          <section className="budget-tracker-charts">
            <div className="dashboard-card budget-tracker-chart-card">
              <h3 className="card-title">Status mix</h3>
              <div className="budget-tracker-donut-wrap">
                <DonutChart segments={segments} total={officeCount} />
                <ul className="budget-tracker-legend">
                  {segments.map((s) => (
                    <li key={s.key}>
                      <span style={{ background: s.color }} />
                      <em>{s.label}</em>
                      <strong>{s.value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="dashboard-card budget-tracker-chart-card">
              <h3 className="card-title">Completion by status</h3>
              <div className="budget-tracker-bars">
                {segments.map((s) => {
                  const pct =
                    officeCount > 0
                      ? Math.round((s.value / officeCount) * 100)
                      : 0;
                  return (
                    <div key={s.key} className="budget-tracker-bar-row">
                      <div className="budget-tracker-bar-row__label">
                        <span>{s.label}</span>
                        <strong>
                          {s.value} ({pct}%)
                        </strong>
                      </div>
                      <div className="budget-tracker-bar-track">
                        <div
                          className="budget-tracker-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: s.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="dashboard-card budget-tracker-table-card">
            <div className="budget-tracker-table-head">
              <h3 className="card-title">Offices</h3>
              <div className="budget-tracker-table-tools">
                <div className="budget-tracker-search">
                  <i className="fas fa-search" aria-hidden="true"></i>
                  <input
                    type="search"
                    placeholder="Search office, code, or PPMP…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search offices"
                  />
                </div>
                <div className="budget-tracker-chips" role="group" aria-label="Filter by status">
                  <button
                    type="button"
                    className={`budget-tracker-chip${
                      statusFilter === "all" ? " is-active" : ""
                    }`}
                    onClick={() => setStatusFilter("all")}
                  >
                    All
                  </button>
                  {STATUS_META.map((meta) => (
                    <button
                      key={meta.key}
                      type="button"
                      className={`budget-tracker-chip${
                        statusFilter === meta.key ? " is-active" : ""
                      }`}
                      style={{ "--chip-accent": meta.color }}
                      onClick={() => setStatusFilter(meta.key)}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Office</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>PPMP Title</th>
                    <th>Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffices.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        No offices match the current filters for FY {fiscalYear}.
                      </td>
                    </tr>
                  ) : (
                    filteredOffices.map((row) => {
                      const meta =
                        STATUS_META.find((m) => m.key === row.status_key) ||
                        STATUS_META[0];
                      return (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>
                            <code className="budget-tracker-code">{row.code}</code>
                          </td>
                          <td>
                            <span
                              className="budget-tracker-status"
                              style={{ "--status-accent": meta.color }}
                            >
                              {row.status_label}
                            </span>
                          </td>
                          <td>{row.ppmp?.title || "—"}</td>
                          <td>{formatUpdatedAt(row.ppmp?.updated_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="budget-tracker-table-note">
              Showing {filteredOffices.length} of {offices.length} active office
              {offices.length === 1 ? "" : "s"} · FY {fiscalYear}
              {loading ? " · Refreshing…" : ""}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default BudgetOfficeTracker;
