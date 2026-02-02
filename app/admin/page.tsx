"use client";

import * as React from "react";

// ---------- OSA Standards status types ----------
type OsaStatusRow = {
  store: string;
  walkthrough_type: "pre_open" | "handover";
  completed_at: string;
  completed_by: string;
  is_admin_override?: boolean;
};
type OsaStatusResponse = {
  ok: boolean;
  data: OsaStatusRow[];
  error?: string;
};

// ---------- STORES (includes Ballynahinch) ----------
const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"] as const;
type Store = (typeof STORES)[number];
const STORE_OPTIONS: Array<"All" | Store> = ["All", ...STORES];

// ---------- Date range modes ----------
type RangeMode = "today" | "previous_day" | "this_week" | "custom";

// ---------- Helpers ----------
function typeLabel(t: OsaStatusRow["walkthrough_type"]) {
  return t === "pre_open" ? "Pre-Open" : "Handover";
}

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sortDescByCompletedAt(a: OsaStatusRow, b: OsaStatusRow) {
  return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
}

function toYYYYMMDDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// Monday is start of week
function startOfThisWeekLocal(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function fmtShortDateLabel(yyyyMMdd: string) {
  try {
    const d = new Date(`${yyyyMMdd}T00:00:00`);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return yyyyMMdd;
  }
}

export default function AdminPage() {
  // Filters
  const todayISO = React.useMemo(() => toYYYYMMDDLocal(new Date()), []);
  const thirtyAgoISO = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toYYYYMMDDLocal(d);
  }, []);

  const [storeFilter, setStoreFilter] = React.useState<"All" | Store>("All");

  // ✅ NEW: range chips + custom dates
  const [rangeMode, setRangeMode] = React.useState<RangeMode>("this_week");
  const [customFrom, setCustomFrom] = React.useState<string>(thirtyAgoISO);
  const [customTo, setCustomTo] = React.useState<string>(todayISO);

  // Data state
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<OsaStatusRow[]>([]);

  // ✅ Compute From/To used in API query (YYYY-MM-DD strings)
  const computedWindow = React.useMemo(() => {
    const now = new Date();
    const today = toYYYYMMDDLocal(now);

    if (rangeMode === "today") {
      return {
        from: today,
        to: today,
        label: "Today",
      };
    }

    if (rangeMode === "previous_day") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yISO = toYYYYMMDDLocal(y);
      return {
        from: yISO,
        to: yISO,
        label: "Previous day",
      };
    }

    if (rangeMode === "this_week") {
      const start = startOfThisWeekLocal(now);
      const from = toYYYYMMDDLocal(start);
      const to = today; // inclusive to today
      return {
        from,
        to,
        label: `This week (${fmtShortDateLabel(from)} → ${fmtShortDateLabel(to)})`,
      };
    }

    // custom
    return {
      from: customFrom,
      to: customTo,
      label: `Custom (${fmtShortDateLabel(customFrom)} → ${fmtShortDateLabel(customTo)})`,
    };
  }, [rangeMode, customFrom, customTo]);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      const qs = new URLSearchParams({
        from: computedWindow.from,
        to: computedWindow.to,
        store: storeFilter,
      });

      const res = await fetch(`/api/osa-standards/status?${qs.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || res.statusText);
      }

      const json = (await res.json()) as OsaStatusResponse;
      if (!json.ok) throw new Error(json.error || "Failed to load completion log");

      const data = Array.isArray(json.data) ? json.data : [];
      setRows(data.sort(sortDescByCompletedAt));
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Load whenever filters change
  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedWindow.from, computedWindow.to, storeFilter]);

  // Optional auto-refresh every 60s
  React.useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedWindow.from, computedWindow.to, storeFilter]);

  return (
    <main className="wrap">
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="shell">
        {/* Top bar */}
        <div className="topbar">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => (window.location.href = "/")}
          >
            ← Back to Home
          </button>

          <div className="topbar-title">
            <h1>Admin — OSA Standards Completion</h1>
            <p>Completion log for Pre-Open and Handover walkthroughs.</p>
          </div>

          <button type="button" className="btn btn--brand" onClick={load}>
            Refresh
          </button>
        </div>

        {/* Filters panel (dashboard-style) */}
        <section className="filters-card">
          <div className="filters-block">
            <div className="filters-title">Date range</div>
            <div className="chips">
              <button
                type="button"
                className={`chip ${rangeMode === "today" ? "chip--active" : ""}`}
                onClick={() => setRangeMode("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`chip ${rangeMode === "previous_day" ? "chip--active" : ""}`}
                onClick={() => setRangeMode("previous_day")}
              >
                Previous day
              </button>
              <button
                type="button"
                className={`chip ${rangeMode === "this_week" ? "chip--active" : ""}`}
                onClick={() => setRangeMode("this_week")}
              >
                This week
              </button>
              <button
                type="button"
                className={`chip ${rangeMode === "custom" ? "chip--active" : ""}`}
                onClick={() => setRangeMode("custom")}
              >
                Custom
              </button>
            </div>

            <div className="range-label">{computedWindow.label}</div>

            {rangeMode === "custom" && (
              <div className="custom-row">
                <label className="field">
                  <span>From</span>
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>To</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    max={todayISO}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </label>

                <button className="btn btn--ghost" type="button" onClick={load}>
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="filters-block">
            <div className="filters-title">Store</div>
            <select
              className="select"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value as "All" | Store)}
            >
              {STORE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="range-label">
              Showing: <b>{storeFilter}</b>
            </div>
          </div>
        </section>

        {loading && <div className="alert muted">Loading…</div>}
        {err && <div className="alert error">❌ {err}</div>}

        {/* Completion log */}
        <section className="card">
          <header className="card-head">
            <div>
              <div className="card-title">Completion Log ({rows.length})</div>
              <div className="card-sub">
                Records whether the Pre-Open and Handover walkthroughs were completed, by whom, and when.
              </div>
            </div>
          </header>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Type</th>
                  <th>Completed at</th>
                  <th>Completed by</th>
                  <th>Override</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.store}-${r.walkthrough_type}-${r.completed_at}-${idx}`}>
                    <td className="strong">{r.store}</td>
                    <td>{typeLabel(r.walkthrough_type)}</td>
                    <td>{fmtDateTime(r.completed_at)}</td>
                    <td>{r.completed_by || "—"}</td>
                    <td>{r.is_admin_override ? "Yes" : "No"}</td>
                  </tr>
                ))}

                {!loading && !err && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No completions found for the selected range / store.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --brand: #006491;
          --brand-dark: #004b75;
          --border: rgba(15, 23, 42, 0.08);
          --shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
        }

        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 40px;
          color: var(--text);
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: 0 12px 35px rgba(2, 6, 23, 0.08);
          width: 100%;
        }

        .banner img {
          max-width: min(1160px, 92%);
          height: auto;
          display: block;
        }

        .shell {
          width: min(1100px, 94vw);
          margin-top: 18px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 1.5rem;
          box-shadow: var(--shadow);
          padding: 18px 22px 26px;
        }

        .topbar {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .topbar-title h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .topbar-title p {
          margin: 4px 0 0;
          color: var(--muted);
          font-weight: 700;
          font-size: 13px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
          border: 2px solid transparent;
          transition: transform 0.1s ease, background 0.15s ease, color 0.15s ease, border 0.15s ease;
          white-space: nowrap;
        }

        .btn--brand {
          background: var(--brand);
          border-color: var(--brand-dark);
          color: #fff;
          box-shadow: 0 8px 18px rgba(0, 100, 145, 0.18);
        }

        .btn--brand:hover {
          background: var(--brand-dark);
          transform: translateY(-1px);
        }

        .btn--ghost {
          background: #fff;
          border-color: rgba(15, 23, 42, 0.08);
          color: var(--text);
          box-shadow: 0 8px 18px rgba(2, 6, 23, 0.04);
        }

        .btn--ghost:hover {
          border-color: rgba(0, 100, 145, 0.25);
          transform: translateY(-1px);
        }

        .filters-card {
          display: grid;
          grid-template-columns: 1fr 260px;
          gap: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          margin-bottom: 12px;
        }

        .filters-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .filters-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #334155;
        }

        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip {
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 13px;
          font-weight: 900;
          color: var(--text);
          cursor: pointer;
          transition: transform 0.12s ease, border 0.12s ease, background 0.12s ease;
        }

        .chip:hover {
          transform: translateY(-1px);
          border-color: rgba(0, 100, 145, 0.25);
        }

        .chip--active {
          background: rgba(0, 100, 145, 0.1);
          border-color: rgba(0, 100, 145, 0.25);
          color: var(--brand-dark);
        }

        .range-label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .custom-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }

        input[type="date"] {
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          padding: 9px 10px;
          font-weight: 900;
          background: #fff;
        }

        .select {
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          background: #fff;
          font-weight: 900;
          color: var(--text);
        }

        .alert {
          padding: 10px 12px;
          border-radius: 14px;
          font-weight: 900;
          margin-bottom: 12px;
        }

        .alert.muted {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
        }

        .alert.error {
          background: rgba(254, 242, 242, 0.92);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #7f1d1d;
        }

        .card {
          background: #fff;
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          overflow: hidden;
        }

        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
          padding: 14px 14px 10px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        .card-title {
          font-size: 18px;
          font-weight: 900;
        }

        .card-sub {
          margin-top: 4px;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 12px 12px;
          text-align: left;
          font-size: 13px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        th {
          background: rgba(0, 100, 145, 0.08);
          font-weight: 900;
          letter-spacing: 0.02em;
          color: #334155;
          white-space: nowrap;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        .strong {
          font-weight: 900;
        }

        .empty {
          color: #334155;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .filters-card {
            grid-template-columns: 1fr;
          }
          .topbar {
            grid-template-columns: 1fr;
          }
          .btn {
            width: fit-content;
          }
        }
      `}</style>
    </main>
  );
}
