"use client";

import { useEffect } from "react";
import DailyUpdateClient from "../DailyUpdateClient";

const PRINT_DELAY_MS = 900;

function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), PRINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

export default function DailyUpdateExportPage() {
  return (
    <>
      <PrintTrigger />
      <DailyUpdateClient exportMode />
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
      `}</style>
    </>
  );
}
