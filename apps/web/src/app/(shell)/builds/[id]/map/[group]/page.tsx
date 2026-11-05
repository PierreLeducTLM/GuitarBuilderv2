import type { Route } from "next";
import { redirect } from "next/navigation";
import { PartFlowRoute } from "@/components/builds/PartFlowRoute";
import { groupByKey } from "@/lib/sequence/groups";

/** guitar-builds: Inaccessible Build Links. An unknown group leads to the Steps view. */
export default async function BuildPartFlowPage({ params }: PageProps<"/builds/[id]/map/[group]">) {
  const { id, group } = await params;
  if (!groupByKey(group)) redirect(`/builds/${id}` as Route);
  return <PartFlowRoute groupKey={group} />;
}
