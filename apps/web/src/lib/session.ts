import "server-only";
import { type AppRole, toAppRole } from "@gb/db";
import { cache } from "react";
import { createClient } from "./supabase/server";

export interface ShellSession {
  userId: string;
  email: string;
  role: AppRole;
}

/**
 * The signed-in user and their role, read once per request (user-auth: User Roles).
 * A profile that is missing or cannot be read means role user.
 */
export const getShellSession = cache(async (): Promise<ShellSession | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== "string") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    userId: claims.sub,
    email: profile?.email ?? (typeof claims.email === "string" ? claims.email : ""),
    role: toAppRole(profile?.role),
  };
});
