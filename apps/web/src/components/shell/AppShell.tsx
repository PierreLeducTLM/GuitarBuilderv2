"use client";

import type { AppRole } from "@gb/db";
import { Button, IconButton, Sheet, TraceMark } from "@gb/ui";
import { LogOut, Menu as MenuIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSelector } from "@/components/ThemeSelector";
import { DEFAULT_ROUTE, sectionsFor } from "@/lib/routes";
import { AuthListener } from "./AuthListener";
import { NavEntries } from "./NavEntries";
import { UserMenu } from "./UserMenu";
import { useSignOut } from "./useSignOut";

export interface AppShellProps {
  email: string;
  role: AppRole;
  children: ReactNode;
}

function AppTitle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("app");
  return (
    <Link
      href={DEFAULT_ROUTE}
      className="-m-1 flex min-h-11 min-w-0 items-center gap-3 rounded-xl p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <TraceMark size={compact ? 32 : 40} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-lg leading-tight font-semibold tracking-tight text-fg">
          {t("title")}
        </span>
        {compact ? null : <span className="truncate text-xs text-fg-dim">{t("subtitle")}</span>}
      </span>
    </Link>
  );
}

/**
 * The signed-in frame: desktop header (≥ 1024 px), or a top bar with a slide-out menu
 * and a bottom tab bar on narrower viewports.
 */
export function AppShell({ email, role, children }: AppShellProps) {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut, pending } = useSignOut();
  const sections = sectionsFor(role);

  return (
    <div className="min-h-dvh bg-ground">
      <AuthListener />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-amber focus:px-4 focus:py-3 focus:font-bold focus:text-on-amber"
      >
        {t("shell.skipToContent")}
      </a>

      {/* Desktop header */}
      <header className="sticky top-0 z-20 hidden border-b border-line bg-ground/95 backdrop-blur lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-7 py-3">
          <AppTitle />
          <NavEntries sections={sections} variant="bar" label={t("nav.label")} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSelector />
            <UserMenu email={email} />
          </div>
        </div>
      </header>

      {/* Mobile top bar and slide-out menu */}
      <header className="sticky top-0 z-20 border-b border-line bg-ground/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <AppTitle compact />
          <IconButton label={t("shell.openMenu")} onClick={() => setMenuOpen(true)}>
            <MenuIcon className="size-5" />
          </IconButton>
        </div>
      </header>
      <Sheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t("shell.menuTitle")}
        closeLabel={t("shell.closeMenu")}
      >
        <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-inset px-3 py-2.5">
          <span className="text-2xs text-fg-dim">{t("shell.signedInAs")}</span>
          <span className="truncate text-sm font-semibold text-fg">{email}</span>
        </div>
        <NavEntries
          sections={sections}
          variant="list"
          label={t("nav.label")}
          onNavigate={() => setMenuOpen(false)}
        />
        <section
          aria-label={t("shell.preferences")}
          className="flex flex-col gap-2 border-t border-line pt-4"
        >
          <LanguageSwitcher className="w-full" />
          <ThemeSelector className="w-full" />
        </section>
        <Button
          variant="secondary"
          icon={<LogOut className="size-4" />}
          disabled={pending}
          onClick={() => void signOut()}
          className="mt-auto"
        >
          {t("shell.signOut")}
        </Button>
      </Sheet>

      <main
        id="main"
        className="mx-auto w-full max-w-7xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-7 lg:pt-8 lg:pb-12"
      >
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <NavEntries sections={sections} variant="tabs" label={t("nav.label")} />
      </div>
    </div>
  );
}
