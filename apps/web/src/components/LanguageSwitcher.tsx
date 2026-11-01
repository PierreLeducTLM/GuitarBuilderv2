"use client";

import { SegmentedControl } from "@gb/ui";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { type AppLocale, LOCALE_COOKIE, PREFERENCE_COOKIE_MAX_AGE } from "@/i18n/config";

/**
 * EN/FR switch (app-shell: Language Switching). Stores the choice in a cookie and
 * re-renders the server components in the new language without reloading the page.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState<AppLocale | null>(null);

  function change(next: AppLocale) {
    setRequested(next);
    // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read by the server
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <SegmentedControl
      label={t("label")}
      value={pending && requested ? requested : locale}
      onChange={change}
      mono
      className={className}
      options={[
        { value: "en", label: t("en"), ariaLabel: t("enName"), title: t("enName") },
        { value: "fr", label: t("fr"), ariaLabel: t("frName"), title: t("frName") },
      ]}
    />
  );
}
