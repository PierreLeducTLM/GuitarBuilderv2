/**
 * Public configuration: the only values that reach the browser (user-auth:
 * Authentication Configuration). Missing values stop `next dev`, `next build` and
 * `next start`, because next.config.ts calls `parsePublicEnv`.
 */

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface PublicEnvInput {
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  /** Supabase's current name for the public key (what its Vercel integration sets). */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
  /** The legacy name, still accepted when the publishable one is absent. */
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string | undefined;
}

export class ConfigurationError extends Error {
  override name = "ConfigurationError";
}

export function parsePublicEnv(input: PublicEnvInput): PublicEnv {
  const url = input.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key =
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    input.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  const problems: string[] = [];

  if (!url) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  } else {
    let valid = false;
    try {
      const parsed = new URL(url);
      valid = parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      valid = false;
    }
    if (!valid) problems.push(`NEXT_PUBLIC_SUPABASE_URL is not an http(s) URL: "${url}"`);
  }
  if (!key) {
    problems.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set",
    );
  }

  if (problems.length > 0) {
    throw new ConfigurationError(
      `Guitar Builder cannot start: ${problems.join("; ")}.\n` +
        "Copy apps/web/.env.example to apps/web/.env.local and fill in your Supabase project's URL and publishable (anon) key " +
        "(for the local stack, `supabase status` prints both).",
    );
  }
  return { supabaseUrl: url, supabaseAnonKey: key };
}

/**
 * Reads the public variables. The `process.env.NEXT_PUBLIC_*` references must stay
 * literal so Next.js inlines them into the browser bundle.
 */
export function publicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
