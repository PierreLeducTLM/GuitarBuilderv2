import type { Route } from "next";
import { redirect } from "next/navigation";
import { StepRoute } from "@/components/builds/StepRoute";
import { getBuild } from "@/lib/builds/queries";
import { DEFAULT_ROUTE } from "@/lib/routes";
import { groupByKey } from "@/lib/sequence/groups";
import { displayedStepKey } from "@/lib/sequence/variant";

/**
 * guitar-builds: Inaccessible Build Links. A step key that does not exist, or names a
 * step the build's variant hides, leads to the build's Steps view.
 */
export default async function BuildStepPage({
  params,
  searchParams,
}: PageProps<"/builds/[id]/steps/[key]">) {
  const [{ id, key }, { from }] = await Promise.all([params, searchParams]);
  const build = await getBuild(id);
  if (!build) redirect(DEFAULT_ROUTE);
  const stepKey = displayedStepKey(build, key);
  if (!stepKey) redirect(`/builds/${build.id}` as Route);
  const origin = typeof from === "string" ? (groupByKey(from)?.key ?? null) : null;
  return <StepRoute stepKey={stepKey} from={origin} />;
}
