import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { listRecentBuilds } from "@/lib/builds/queries";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";

const RECENT_BUILDS = 5;

// The proxy already sends visitors without a session to the sign-in screen; this
// check keeps the shell from ever rendering without one.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const session = await getShellSession();
  if (!session) redirect(SIGN_IN_ROUTE);
  const recentBuilds = await listRecentBuilds(session.userId, RECENT_BUILDS);
  return (
    <AppShell email={session.email} role={session.role} recentBuilds={recentBuilds}>
      {children}
    </AppShell>
  );
}
