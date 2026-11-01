/**
 * Turns an authentication-service error into what the form shows (user-auth:
 * Sign-In Failure, Submission In Progress). Known codes map to translated messages
 * whose English text matches the service's; unknown codes show the service's own
 * reason; network failures and errors without a reason are "unexpected".
 */

export const knownAuthErrorCodes = [
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "email_exists",
  "weak_password",
  "signup_disabled",
  "email_provider_disabled",
  "email_address_invalid",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
] as const;
export type KnownAuthErrorCode = (typeof knownAuthErrorCodes)[number];

export type AuthErrorMessage =
  | { kind: "known"; code: KnownAuthErrorCode }
  | { kind: "service"; text: string }
  | { kind: "unexpected" };

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

export function describeAuthError(error: unknown): AuthErrorMessage {
  if (!error || typeof error !== "object") return { kind: "unexpected" };
  const { name, message, code, status } = error as ErrorLike;

  // Network failures (supabase-js reports status 0) and thrown fetch errors.
  if (name === "AuthRetryableFetchError" || status === 0 || name === "TypeError") {
    return { kind: "unexpected" };
  }
  if (typeof code === "string" && (knownAuthErrorCodes as readonly string[]).includes(code)) {
    return { kind: "known", code: code as KnownAuthErrorCode };
  }
  if (typeof message === "string" && message.trim() && message !== "{}") {
    return { kind: "service", text: message.trim() };
  }
  return { kind: "unexpected" };
}
