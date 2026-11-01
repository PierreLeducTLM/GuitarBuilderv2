import type { Database } from "@gb/db";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../env";

/** Browser client; the session lives in cookies so the server can render the shell. */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
