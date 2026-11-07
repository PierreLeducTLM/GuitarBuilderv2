import { redirect } from "next/navigation";
import { YouScreen } from "@/components/you/YouScreen";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";
import { sharedAccount } from "@/lib/sharedAccount";

export default async function YouPage() {
  const session = await getShellSession();
  if (!session) redirect(SIGN_IN_ROUTE);
  return <YouScreen email={session.email} role={session.role} canSignOut={!sharedAccount()} />;
}
