"use client";

import type { AppRole } from "@gb/db";
import { Button } from "@gb/ui";
import { LogOut, Mic } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MicrophoneCheck } from "@/components/microphone-check/MicrophoneCheck";
import { entryIcons } from "@/components/shell/navigation";
import { PageBar } from "@/components/shell/PageBar";
import { useSignOut } from "@/components/shell/useSignOut";
import { ThemeSelector } from "@/components/ThemeSelector";
import { adminEntriesFor } from "@/lib/routes";

/**
 * app-shell: You Page. The account, language and theme, the microphone check, the
 * administration areas for administrators, and sign-out, on every viewport.
 */
export function YouScreen({ email, role }: { email: string; role: AppRole }) {
  const t = useTranslations();
  const { signOut, pending } = useSignOut();
  const admin = adminEntriesFor(role);
  const [checking, setChecking] = useState(false);
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <PageBar title={t("you.title")} />

      <section className="flex flex-col gap-0.5">
        <span className="text-sm text-fg-dim">{t("shell.signedInAs")}</span>
        <span className="break-all text-lg font-semibold text-fg">{email}</span>
      </section>

      <section aria-labelledby="you-preferences" className="flex flex-col gap-3">
        <h2 id="you-preferences" className="text-base font-semibold text-fg">
          {t("you.preferences")}
        </h2>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-fg-dim">{t("you.language")}</span>
          <LanguageSwitcher className="w-full sm:w-auto" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-fg-dim">{t("you.theme")}</span>
          <ThemeSelector className="w-full sm:w-auto" />
        </div>
      </section>

      <section aria-labelledby="you-microphone" className="flex flex-col gap-3">
        <h2 id="you-microphone" className="text-base font-semibold text-fg">
          {t("you.microphone")}
        </h2>
        <div>
          <Button
            variant="secondary"
            icon={<Mic className="size-4" />}
            onClick={() => setChecking(true)}
          >
            {t("you.checkMicrophone")}
          </Button>
        </div>
        {checking ? <MicrophoneCheck open onClose={() => setChecking(false)} /> : null}
      </section>

      {admin.length > 0 ? (
        <section aria-labelledby="you-administration" className="flex flex-col gap-2">
          <h2 id="you-administration" className="text-base font-semibold text-fg">
            {t("you.administration")}
          </h2>
          {admin.map((entry) => {
            const Icon = entryIcons[entry.id];
            return (
              <Link
                key={entry.id}
                href={entry.href as Route}
                data-admin
                className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-admin-soft px-3.5 text-base font-medium text-admin-ink transition-colors duration-150 hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(`nav.${entry.id}`)}
              </Link>
            );
          })}
        </section>
      ) : null}

      <div>
        <Button
          variant="secondary"
          icon={<LogOut className="size-4" />}
          disabled={pending}
          onClick={() => void signOut()}
        >
          {t("shell.signOut")}
        </Button>
      </div>
    </div>
  );
}
