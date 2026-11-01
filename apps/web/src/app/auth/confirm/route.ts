import type { EmailOtpType } from "@supabase/supabase-js";
import type { Route } from "next";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const otpTypes: readonly EmailOtpType[] = ["email", "signup"];

/**
 * Target of the verification email (user-auth: Email Verification). Accepts a token
 * hash (custom template, works on any device) or a PKCE code (default template, same
 * browser), signs the user in, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const supabase = await createClient();

  let verified = false;
  if (tokenHash && type && otpTypes.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  redirect((verified ? next : "/sign-in?error=confirmation") as Route);
}
