"use client";

import type { CSSProperties, PropsWithChildren } from "react";
import { useState } from "react";

type StatWindow = {
  visits: number;
  avgScore: number | null;
};

type HoverStatPanelProps = PropsWithChildren<{
  label: string;
  mtd: StatWindow;
  ytd: StatWindow;
}>;

const panelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  zIndex: 40,
  minWidth: 240,
  background: "#ffffff",
  border: "1px solid #d8dde6",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
  padding: 12,
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  marginBottom: 8,
  color: "#0f172a",
};

const lineStyle: CSSProperties = {
  margin: "4px 0",
  color: "#334155",
  fontSize: 14,
};

const formatAvgScore = (score: number | null) =>
  score == null ? "—" : score.toFixed(1);

export default function HoverStatPanel({
  label,
  mtd,
  ytd,
  children,
}: HoverStatPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span role="dialog" aria-live="polite" style={panelStyle}>
          <span style={titleStyle}>{label}</span>
          <span style={lineStyle}>
            Month to date — Visits: {mtd.visits} · Avg Score: {formatAvgScore(mtd.avgScore)}
          </span>
          <span style={lineStyle}>
            Year to date — Visits: {ytd.visits} · Avg Score: {formatAvgScore(ytd.avgScore)}
          </span>
        </span>
      ) : null}
    </span>
  );
}
