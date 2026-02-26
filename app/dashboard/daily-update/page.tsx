import { Suspense } from "react";
import DailyUpdateClient from "./DailyUpdateClient";

export default function DailyUpdatePage() {
  return (
    <Suspense fallback={<div className="wrap"><p>Loading…</p></div>}>
      <DailyUpdateClient />
    </Suspense>
  );
}
