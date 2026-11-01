import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DEFAULT_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";

// app-shell: Admin-Only Sections, Admin Deep Links Wait For Role. The role is read on
// the server before deciding, so administrators can reload /admin and /references,
// and everyone else is sent to /builds. Data access is enforced by the database.
export default async function AdminSectionsLayout({ children }: { children: ReactNode }) {
  const session = await getShellSession();
  if (session?.role !== "admin") redirect(DEFAULT_ROUTE);
  return children;
}
