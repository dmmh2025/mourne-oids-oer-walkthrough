"use client";

import { useEffect } from "react";
import DailyUpdateClient from "../DailyUpdateClient";

function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 900);
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
