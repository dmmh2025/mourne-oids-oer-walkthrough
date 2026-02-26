"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function DailyUpdatePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-100 to-indigo-200 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/50 bg-white/65 p-5 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="overflow-hidden rounded-xl border border-slate-200/60">
          <Image
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne OIDS dashboard header"
            width={1600}
            height={400}
            className="h-auto w-full object-cover"
            priority
          />
        </div>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Daily Update</h1>
            <p className="mt-2 text-base text-slate-600">Daily operational summary</p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}
