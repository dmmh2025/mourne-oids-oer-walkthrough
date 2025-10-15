"use client";
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url, anon);

export default function LogoutPage() {
  async function doLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return (
    <main>
      <h1>Logout</h1>
      <button onClick={doLogout} style={{ padding: "10px 14px" }}>
        Sign out
      </button>
    </main>
  );
}
