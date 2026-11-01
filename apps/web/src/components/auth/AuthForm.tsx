"use client";

import { Button, TextField } from "@gb/ui";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { describeAuthError } from "@/lib/auth/errors";
import {
  type AuthField,
  type AuthFormError,
  type AuthMode,
  validateAuthForm,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

type Message = { tone: "error" | "success"; text: string } | null;

export interface AuthFormProps {
  /** Where to go after signing in (already checked to be a path on this site). */
  next: string;
  /** Shown on arrival, e.g. after an expired verification link. */
  initialError?: string | null;
  /** Lets the screen update its subtitle with the mode. */
  onModeChange?: (mode: AuthMode) => void;
}

/**
 * Email/password sign-in and sign-up (user-auth). Validation runs before any request;
 * while a request is pending every control is disabled.
 */
export function AuthForm({ next, initialError = null, onModeChange }: AuthFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<AuthFormError | null>(null);
  const [message, setMessage] = useState<Message>(
    initialError ? { tone: "error", text: initialError } : null,
  );
  const fieldRefs = {
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  } satisfies Record<AuthField, unknown>;

  const signUp = mode === "signUp";

  function errorFor(field: AuthField): string | undefined {
    return fieldError?.field === field ? t(`errors.${fieldError.key}`) : undefined;
  }

  function showServiceError(error: unknown) {
    const described = describeAuthError(error);
    const text =
      described.kind === "known"
        ? t(`errors.service.${described.code}`)
        : described.kind === "service"
          ? described.text
          : t("errors.unexpected");
    setMessage({ tone: "error", text });
  }

  function switchMode() {
    const nextMode: AuthMode = signUp ? "signIn" : "signUp";
    setMode(nextMode);
    onModeChange?.(nextMode);
    setMessage(null);
    setFieldError(null);
  }

  function goToApp() {
    router.replace(next as Route);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFieldError(null);

    const problem = validateAuthForm(mode, { email, password, confirmPassword });
    if (problem) {
      setFieldError(problem);
      if (problem.field) {
        fieldRefs[problem.field].current?.focus();
      } else {
        setMessage({ tone: "error", text: t(`errors.${problem.key}`) });
      }
      return;
    }

    setPending(true);
    let navigating = false;
    try {
      const supabase = createClient();
      if (!signUp) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return showServiceError(error);
        navigating = true;
        return goToApp();
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) return showServiceError(error);
      if (data.session) {
        // Email verification is disabled: the new account is signed in already.
        navigating = true;
        return goToApp();
      }
      setMessage({ tone: "success", text: t("signUpSuccess") });
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      showServiceError(error);
    } finally {
      if (!navigating) setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} aria-busy={pending} className="flex flex-col gap-5">
      <div aria-live="polite" className="empty:hidden">
        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={
              message.tone === "error"
                ? "rounded-xl border border-danger-ink bg-danger-soft px-3.5 py-2.5 text-[0.9375rem] text-danger-ink"
                : "rounded-xl border border-teal-line bg-teal-soft px-3.5 py-2.5 text-[0.9375rem] text-teal-ink"
            }
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <TextField
        ref={fieldRefs.email}
        label={t("email")}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errorFor("email")}
        disabled={pending}
      />
      <TextField
        ref={fieldRefs.password}
        label={t("password")}
        type="password"
        name="password"
        autoComplete={signUp ? "new-password" : "current-password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint={signUp ? t("passwordHint") : undefined}
        error={errorFor("password")}
        disabled={pending}
      />
      {signUp ? (
        <TextField
          ref={fieldRefs.confirmPassword}
          label={t("confirmPassword")}
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errorFor("confirmPassword")}
          disabled={pending}
        />
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? t("pleaseWait") : signUp ? t("signUp") : t("signIn")}
      </Button>

      <button
        type="button"
        onClick={switchMode}
        disabled={pending}
        className="mx-auto min-h-11 rounded-lg px-2 text-[0.9375rem] font-semibold text-amber-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55"
      >
        {signUp ? t("switchToSignIn") : t("switchToSignUp")}
      </button>
    </form>
  );
}
