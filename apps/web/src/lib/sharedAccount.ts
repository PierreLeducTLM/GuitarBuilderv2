/**
 * The shared account every visitor is signed in to while the sign-in screen is set
 * aside (user-auth: Authentication Configuration). Server-side only: these variables
 * must never get a NEXT_PUBLIC_ prefix.
 */

export interface SharedAccount {
  email: string;
  password: string;
}

export interface SharedAccountInput {
  SHARED_ACCOUNT_EMAIL?: string | undefined;
  SHARED_ACCOUNT_PASSWORD?: string | undefined;
}

/** The shared account, or null unless both its email and its password are set. */
export function parseSharedAccount(input: SharedAccountInput): SharedAccount | null {
  const email = input.SHARED_ACCOUNT_EMAIL?.trim() ?? "";
  const password = input.SHARED_ACCOUNT_PASSWORD ?? "";
  return email && password ? { email, password } : null;
}

export function sharedAccount(): SharedAccount | null {
  return parseSharedAccount({
    SHARED_ACCOUNT_EMAIL: process.env.SHARED_ACCOUNT_EMAIL,
    SHARED_ACCOUNT_PASSWORD: process.env.SHARED_ACCOUNT_PASSWORD,
  });
}
