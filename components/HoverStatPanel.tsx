"use client";

import React from "react";

type OsaCostWindow = {
  visits: number;
  avgScore: number | null;
};

type ServiceWindow = {
  dot: number | null; // 0..1
  extremes: number | null; // 0..1
  rnl: number | null; // minutes
  additionalHours: number; // sum
  shifts: number; // count
};

export type HoverWindow = OsaCostWindow | ServiceWindow;

type Props = {
  label: string;
  mtd: HoverWindow;
  ytd: HoverWindow;
};

const isOsaCost = (w: HoverWindow): w is OsaCostWindow => {
  return typeof (w as any)?.visits === "number" && "avgScore" in (w as any);
};

const pct = (v: number | null, dp = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(dp)}%`;

const mins = (v: number | null, dp = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}m`;

const hours = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}h` : "0.0h");

const score = (v: number | null, dp = 1) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(dp);

function renderWindow(title: string, w: HoverWindow) {
  if (isOsaCost(w)) {
    return (
      <div className="block">
        <div className="blockTitle">{title}</div>
        <div className="row">
          <span>Visits</span>
          <b>{w.visits}</b>
        </div>
        <div className="row">
          <span>Avg score</span>
          <b>{w.visits ? score(w.avgScore, 1) : "—"}</b>
        </div>
      </div>
    );
  }

  // Service window
  return (
    <div className="block">
      <div className="blockTitle">{title}</div>
      <div className="row">
        <span>DOT</span>
        <b>{pct(w.dot, 1)}</b>
      </div>
      <div className="row">
        <span>Extremes &gt;40</span>
        <b>{pct(w.extremes, 2)}</b>
      </div>
      <div className="row">
        <span>R&amp;L</span>
        <b>{mins(w.rnl, 1)}</b>
      </div>
      <div className="row">
        <span>Additional hours</span>
        <b>{hours(w.additionalHours)}</b>
      </div>
      <div className="row">
        <span>Shifts</span>
        <b>{w.shifts}</b>
      </div>
    </div>
  );
}

export default function HoverStatPanel({ label, mtd, ytd }: Props) {
  return (
    <div className="panel" role="tooltip" aria-label={`${label} stats`}>
      <div className="title">{label}</div>
      <div className="grid">
        {renderWindow("MTD", mtd)}
        {renderWindow("YTD", ytd)}
      </div>

      <style jsx>{`
        .panel {
          background: #0f172a;
          color: #f8fafc;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.35);
          border: 1px solid rgba(148, 163, 184, 0.18);
          min-width: 280px;
          max-width: 420px;
        }
        .title {
          font-weight: 900;
          font-size: 13px;
          margin-bottom: 8px;
          opacity: 0.95;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .block {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 10px;
          padding: 8px 9px;
        }
        .blockTitle {
          font-weight: 900;
          font-size: 12px;
          margin-bottom: 6px;
          opacity: 0.9;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          line-height: 1.4;
          padding: 2px 0;
        }
        .row span {
          opacity: 0.85;
          font-weight: 800;
        }
        .row b {
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}
