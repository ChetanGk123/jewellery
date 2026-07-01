import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "@/lib/env";

/**
 * Browser Supabase client (singleton). Uses the RLS-protected publishable key,
 * safe to ship to the browser. For server components / queries use `./server`.
 */
export const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
