import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Server-side Supabase client (uses service key; never exposed to browser) */
export const serverSupabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
