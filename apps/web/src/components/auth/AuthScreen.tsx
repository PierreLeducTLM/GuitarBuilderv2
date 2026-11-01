"use client";

import { Panel, TraceMark } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSelector } from "@/components/ThemeSelector";
import { AuthForm, type AuthFormProps } from "./AuthForm";

/** user-auth: Sign-In Screen, with the theme and language controls reachable. */
export function AuthScreen(props: AuthFormProps) {
  const t = useTranslations();
  const [signUp, setSignUp] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <div className="flex flex-wrap items-center justify-end gap-2 p-4">
        <LanguageSwitcher />
        <ThemeSelector />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 sm:items-center sm:pt-0">
        <div className="flex w-full max-w-md flex-col gap-6">
          <header className="flex items-center gap-4">
            <TraceMark size={56} />
            <div className="flex flex-col gap-0.5">
              <h1 className="text-3xl font-semibold tracking-tight text-fg">{t("app.title")}</h1>
              <p className="text-[0.9375rem] text-fg-dim" data-testid="auth-subtitle">
                {signUp ? t("auth.subtitleSignUp") : t("auth.subtitleSignIn")}
              </p>
            </div>
          </header>
          <Panel padding="lg" className="shadow-panel">
            <AuthForm {...props} onModeChange={(mode) => setSignUp(mode === "signUp")} />
          </Panel>
          <p className="text-center text-sm text-fg-faint">{t("auth.note")}</p>
        </div>
      </main>
    </div>
  );
}
