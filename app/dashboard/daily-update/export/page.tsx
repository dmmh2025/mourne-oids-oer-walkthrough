"use client";

import { useEffect } from "react";
import DailyUpdateClient from "../DailyUpdateClient";

function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

export default function DailyUpdateExportPage() {
  return (
    <>
      <PrintTrigger />
      <DailyUpdateClient exportMode />
    </>
  );
}
