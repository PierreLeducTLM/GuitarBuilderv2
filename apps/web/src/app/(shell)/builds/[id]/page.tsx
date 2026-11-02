import { redirect } from "next/navigation";
import { BuildDetail } from "@/components/builds/BuildDetail";
import { getBuild } from "@/lib/builds/queries";
import { DEFAULT_ROUTE, SIGN_IN_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";

/**
 * guitar-builds: Build Deep Links and Inaccessible Build Links. A link to a build that
 * does not exist or that the user may not read goes back to the builds list.
 */
export default async function BuildDetailPage({ params }: PageProps<"/builds/[id]">) {
  const [{ id }, session] = await Promise.all([params, getShellSession()]);
  if (!session) redirect(SIGN_IN_ROUTE);
  const build = await getBuild(id);
  if (!build) redirect(DEFAULT_ROUTE);
  return <BuildDetail key={build.id} build={build} canEdit={build.ownerId === session.userId} />;
}
