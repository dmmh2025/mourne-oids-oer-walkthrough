"use client";

import * as React from "react";

type Row = {
  store: string;
  walkthrough_type: "pre_open" | "handover";
  completed_at: string;
  completed_by: string;
  is_admin_override?: boolean;
};

type StatusResponse = {
  ok: boolean;
  data: Row[];
};

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"] as const;

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function OsaStandardsCompletionPanel() {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string>("");

  async function load() {
    try {
      setError("");
      setLoading(true);

      const res = await fetch("/api/osa-standards/status", { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || res.statusText);
      }

      const json = (await res.json()) as StatusResponse;
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(t);
  }, []);

  // Build per-store status (latest entry today for each type)
  const byStore = React.useMemo(() => {
    const map: Record<
      string,
      {
        pre_open?: Row;
        handover?: Row;
        last?: Row;
      }
    > = {};

    for (const s of STORES) map[s] = {};

    for (const r of rows) {
      if (!map[r.store]) map[r.store] = {};
      const slot = r.walkthrough_type === "pre_open" ? "pre_open" : "handover";

      // rows come ordered desc in API (we asked for it), so first hit is latest
      if (!map[r.store][slot]) map[r.store][slot] = r;
      if (!map[r.store].last) map[r.store].last = r;
    }

    return map;
  }, [rows]);

  const badge = (ok: boolean) => (ok ? "🟢 Complete" : "🔴 Missing");

  return (
    <div className="osaCard">
      <div className="osaHeader">
        <div>
          <div className="osaTitle">OSA Standards Walkthrough — Today</div>
          <div className="osaSub">
            Completion tracker for <b>Pre-Open</b> and <b>Handover</b>.
          </div>
        </div>
        <button className="osaBtn" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="osaError">Error: {error}</div>}

      {loading ? (
        <div className="osaLoading">Loading…</div>
      ) : (
        <div className="osaGrid">
          {STORES.map((s) => {
            const pre = byStore[s]?.pre_open;
            const han = byStore[s]?.handover;
            const last = byStore[s]?.last;

            return (
              <div key={s} className="osaTile">
                <div className="osaStore">{s}</div>

                <div className="osaRow">
                  <div className="osaKey">Pre-Open</div>
                  <div className="osaVal">{badge(!!pre)}</div>
                  <div className="osaMeta">
                    {pre ? `${fmtTime(pre.completed_at)} · ${pre.completed_by}` : ""}
                  </div>
                </div>

                <div className="osaRow">
                  <div className="osaKey">Handover</div>
                  <div className="osaVal">{badge(!!han)}</div>
                  <div className="osaMeta">
                    {han ? `${fmtTime(han.completed_at)} · ${han.completed_by}` : ""}
                  </div>
                </div>

                <div className="osaFooter">
                  <span className="osaFootKey">Last:</span>{" "}
                  <span className="osaFootVal">
                    {last
                      ? `${last.walkthrough_type === "pre_open" ? "Pre-Open" : "Handover"} · ${fmtTime(
                          last.completed_at
                        )} · ${last.completed_by}${last.is_admin_override ? " (override)" : ""}`
                      : "No submissions today"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .osaCard {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          background: #fff;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.06), 0 1px 3px rgba(2, 6, 23, 0.06);
          margin: 14px 0;
        }
        .osaHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .osaTitle {
          font-weight: 900;
          font-size: 16px;
          color: #0e1116;
        }
        .osaSub {
          margin-top: 2px;
          font-size: 13px;
          color: #4b5563;
        }
        .osaBtn {
          background: #fff;
          border: 2px solid #d7dbe3;
          padding: 8px 12px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .osaError {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 700;
          margin: 8px 0;
        }
        .osaLoading {
          color: #4b5563;
          padding: 10px 2px;
          font-weight: 700;
        }
        .osaGrid {
          display: grid;
          gap: 12px;
        }
        @media (min-width: 700px) {
          .osaGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1000px) {
          .osaGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .osaTile {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
        }
        .osaStore {
          font-weight: 900;
          margin-bottom: 8px;
          color: #0e1116;
        }
        .osaRow {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 6px 10px;
          align-items: center;
          padding: 8px 0;
          border-top: 1px solid #edf0f5;
        }
        .osaRow:first-of-type {
          border-top: none;
          padding-top: 0;
        }
        .osaKey {
          font-weight: 800;
          color: #0e1116;
        }
        .osaVal {
          font-weight: 900;
          color: #0e1116;
        }
        .osaMeta {
          grid-column: 2 / 3;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
        }
        .osaFooter {
          margin-top: 10px;
          border-top: 1px solid #edf0f5;
          padding-top: 10px;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
        }
        .osaFootKey {
          font-weight: 900;
          color: #0e1116;
        }
        .osaFootVal {
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}
