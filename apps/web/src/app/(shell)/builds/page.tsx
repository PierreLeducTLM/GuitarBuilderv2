import { redirect } from "next/navigation";
import { BuildsList } from "@/components/builds/BuildsList";
import { listOwnBuilds } from "@/lib/builds/queries";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";

export default async function BuildsPage() {
  const session = await getShellSession();
  if (!session) redirect(SIGN_IN_ROUTE);
  return <BuildsList builds={await listOwnBuilds(session.userId)} />;
}
