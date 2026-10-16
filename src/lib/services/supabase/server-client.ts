import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase access for bookings and quote requests. The browser
 * never talks to Supabase: there is no NEXT_PUBLIC_ key, and this module
 * fails the build if a client component imports it.
 */
export interface SupabaseServerConfig {
  url: string;
  /** Secret (service) key. Bypasses Row Level Security, so it must never leave the server or be logged. */
  secretKey: string;
}

type Env = Partial<Record<string, string | undefined>>;

/** Both settings, or null when either is missing. Never returns or logs partial values. */
export function supabaseConfigFromEnv(env: Env = process.env): SupabaseServerConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  return url && secretKey ? { url, secretKey } : null;
}

export function createSupabaseServerClient(config: SupabaseServerConfig): SupabaseClient {
  return createClient(config.url, config.secretKey, {
    // A server process acting with its own key: no user sessions to store or refresh.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
