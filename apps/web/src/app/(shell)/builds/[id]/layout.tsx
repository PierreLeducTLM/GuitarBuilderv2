import { redirect } from "next/navigation";
import { BuildFrame } from "@/components/builds/BuildFrame";
import { BuildProvider } from "@/components/builds/BuildProvider";
import { getBuild } from "@/lib/builds/queries";
import { DEFAULT_ROUTE, SIGN_IN_ROUTE } from "@/lib/routes";
import { getShellSession } from "@/lib/session";

/**
 * guitar-builds: Build Deep Links and Inaccessible Build Links. Loads the build once for
 * all its views, part flows and steps; a build that does not exist or that the user may
 * not read sends the user back to the builds list.
 */
export default async function BuildLayout({ params, children }: LayoutProps<"/builds/[id]">) {
  const [{ id }, session] = await Promise.all([params, getShellSession()]);
  if (!session) redirect(SIGN_IN_ROUTE);
  const build = await getBuild(id);
  if (!build) redirect(DEFAULT_ROUTE);
  return (
    <BuildProvider key={build.id} build={build} canEdit={build.ownerId === session.userId}>
      <BuildFrame>{children}</BuildFrame>
    </BuildProvider>
  );
}
