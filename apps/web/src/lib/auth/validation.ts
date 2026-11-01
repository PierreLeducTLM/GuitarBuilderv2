/**
 * Sign-in / sign-up form rules (user-auth: Required Fields Validation, Password Length
 * Validation, Password Confirmation Validation). Runs before any request is sent.
 */

export type AuthMode = "signIn" | "signUp";

export interface AuthFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

/** Message keys under `auth.errors` in the message catalogs. */
export type AuthFormErrorKey =
  | "fillAllFields"
  | "invalidEmail"
  | "passwordTooShort"
  | "passwordsDoNotMatch";

export type AuthField = "email" | "password" | "confirmPassword";

export interface AuthFormError {
  key: AuthFormErrorKey;
  /** The field to flag, or null for a message about the whole form. */
  field: AuthField | null;
}

export const MIN_PASSWORD_LENGTH = 6;

// One "@", a dot in the domain, no spaces: what an address needs to be deliverable.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/**
 * Returns the first problem found, in the order the spec lists the rules, or null
 * when the form may be submitted.
 */
export function validateAuthForm(mode: AuthMode, values: AuthFormValues): AuthFormError | null {
  const email = values.email.trim();
  if (!email || !values.password) return { key: "fillAllFields", field: null };
  if (!isValidEmail(email)) return { key: "invalidEmail", field: "email" };
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return { key: "passwordTooShort", field: "password" };
  }
  if (mode === "signUp" && values.password !== values.confirmPassword) {
    return { key: "passwordsDoNotMatch", field: "confirmPassword" };
  }
  return null;
}
