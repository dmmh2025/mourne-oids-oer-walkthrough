"use client";

export default function DailyUpdateAdminPanel() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Daily Update Admin</h2>
      <p className="mt-1 text-sm text-slate-600">Inputs + Tasks + Area Message</p>
      <p className="mt-4 text-sm text-slate-700">
        Coming next: form fields wired to Supabase tables daily_update_area_message,
        daily_update_store_inputs, daily_update_store_tasks
      </p>
    </section>
  );
}
