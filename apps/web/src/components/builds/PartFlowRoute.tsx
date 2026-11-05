"use client";

import { groupByKey } from "@/lib/sequence/groups";
import { useBuild } from "./BuildProvider";
import { PartFlowView } from "./PartFlowView";

/** The part flow at `/builds/<id>/map/<group>`; the server already checked the key. */
export function PartFlowRoute({ groupKey }: { groupKey: string }) {
  const { build, graph, states } = useBuild();
  const group = groupByKey(groupKey);
  if (!group) return null;
  return <PartFlowView buildId={build.id} graph={graph} states={states} group={group} />;
}
