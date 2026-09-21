"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client-side Supabase client — used inside "use client" components
// (POS screen, KDS, admin forms). Reads the public env vars only.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
