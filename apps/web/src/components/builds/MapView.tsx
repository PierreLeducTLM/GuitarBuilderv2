"use client";

import { BuildMap } from "./BuildMap";
import { useBuild } from "./BuildProvider";

/** The build's Map view (build-sequence: Build Map). */
export function MapView() {
  const { build, graph, states } = useBuild();
  return <BuildMap buildId={build.id} graph={graph} states={states} />;
}
