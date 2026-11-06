export type ImportConfig =
  | {
      mode: "hosted";
      accessToken: string;
      legacyProjectRef: string;
      targetProjectRef: string;
    }
  | {
      mode: "local";
      legacyDatabaseUrl: string;
      legacySupabaseUrl: string;
      targetDatabaseUrl: string;
      targetSupabaseUrl: string;
      targetServiceKey: string;
    };

export type ConfigResult = { ok: true; config: ImportConfig } | { ok: false; message: string };

type Env = Readonly<Record<string, string | undefined>>;

const HOSTED_VARIABLES = [
  "SUPABASE_ACCESS_TOKEN",
  "LEGACY_SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_REF",
] as const;

const LOCAL_VARIABLES = [
  "LEGACY_DATABASE_URL",
  "LEGACY_SUPABASE_URL",
  "TARGET_DATABASE_URL",
  "TARGET_SUPABASE_URL",
  "TARGET_SERVICE_KEY",
] as const;

const setting = (env: Env, name: string): string => env[name]?.trim() ?? "";

const missingFrom = (env: Env, names: readonly string[]): string[] =>
  names.filter((name) => setting(env, name) === "");

const missingMessage = (missing: readonly string[], purpose: string): string =>
  `Missing settings: ${missing.join(", ")}. Set them to ${purpose}.`;

const sameProjectMessage = (value: string): string =>
  `The first-version project and the target project are the same (${value}).`;

const readHosted = (env: Env): ConfigResult => {
  const missing = missingFrom(env, HOSTED_VARIABLES);
  if (missing.length > 0) {
    return {
      ok: false,
      message: missingMessage(missing, "import from the hosted first-version project"),
    };
  }
  const legacyProjectRef = setting(env, "LEGACY_SUPABASE_PROJECT_REF");
  const targetProjectRef = setting(env, "SUPABASE_PROJECT_REF");
  if (legacyProjectRef === targetProjectRef) {
    return { ok: false, message: sameProjectMessage(legacyProjectRef) };
  }
  return {
    ok: true,
    config: {
      mode: "hosted",
      accessToken: setting(env, "SUPABASE_ACCESS_TOKEN"),
      legacyProjectRef,
      targetProjectRef,
    },
  };
};

const readLocal = (env: Env): ConfigResult => {
  const missing = missingFrom(env, LOCAL_VARIABLES);
  if (missing.length > 0) {
    return { ok: false, message: missingMessage(missing, "import between local stacks") };
  }
  const config = {
    mode: "local",
    legacyDatabaseUrl: setting(env, "LEGACY_DATABASE_URL"),
    legacySupabaseUrl: setting(env, "LEGACY_SUPABASE_URL"),
    targetDatabaseUrl: setting(env, "TARGET_DATABASE_URL"),
    targetSupabaseUrl: setting(env, "TARGET_SUPABASE_URL"),
    targetServiceKey: setting(env, "TARGET_SERVICE_KEY"),
  } as const;
  if (config.legacyDatabaseUrl === config.targetDatabaseUrl) {
    return { ok: false, message: sameProjectMessage(config.legacyDatabaseUrl) };
  }
  if (config.legacySupabaseUrl === config.targetSupabaseUrl) {
    return { ok: false, message: sameProjectMessage(config.legacySupabaseUrl) };
  }
  return { ok: true, config };
};

export function readConfig(env: Env): ConfigResult {
  const usesLocalStacks = LOCAL_VARIABLES.some((name) => setting(env, name) !== "");
  return usesLocalStacks ? readLocal(env) : readHosted(env);
}
