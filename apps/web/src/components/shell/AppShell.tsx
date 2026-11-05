"use client";

import type { AppRole } from "@gb/db";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { RecentBuild } from "@/lib/builds/types";
import { AuthListener } from "./AuthListener";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export interface AppShellProps {
  email: string;
  role: AppRole;
  recentBuilds: readonly RecentBuild[];
  children: ReactNode;
}

/**
 * The signed-in frame: a sidebar from 1024 px, a bottom tab bar below. Each page draws
 * its own page bar, so there is no global header.
 */
export function AppShell({ email, role, recentBuilds, children }: AppShellProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-ground">
      <AuthListener />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-amber focus:px-4 focus:py-3 focus:font-bold focus:text-on-amber"
      >
        {t("skipToContent")}
      </a>
      <Sidebar pathname={pathname} userRole={role} email={email} recentBuilds={recentBuilds} />
      <main
        id="main"
        className="mx-auto w-full max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pr-8 lg:pb-12 lg:pl-72"
      >
        {children}
      </main>
      <TabBar pathname={pathname} />
    </div>
  );
}
