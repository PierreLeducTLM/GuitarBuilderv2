"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useStepStore } from "@/components/sequence/useStepStore";
import type { BuildDetailData } from "@/lib/builds/types";
import type { StepStates } from "@/lib/sequence/state";
import type { StepStore } from "@/lib/sequence/store";
import { type BuildVariant, type DisplayGraph, displayGraph } from "@/lib/sequence/variant";
import { forgetDiagramViewports } from "@/lib/sequence/viewports";

export interface BuildContextValue {
  build: BuildDetailData;
  /** False for an administrator viewing another user's build (read-only). */
  canEdit: boolean;
  variant: BuildVariant;
  setVariant: (variant: BuildVariant) => void;
  graph: DisplayGraph;
  store: StepStore;
  states: StepStates;
}

const BuildContext = createContext<BuildContextValue | null>(null);

/**
 * Holds one build for every page under `/builds/<id>`. It lives in the build's layout,
 * which stays mounted while the user moves between views, part flows and steps, so the
 * step store and its pending note saves survive those moves.
 */
export function BuildProvider({
  build,
  canEdit,
  children,
}: {
  build: BuildDetailData;
  canEdit: boolean;
  children: ReactNode;
}) {
  const [variant, setVariant] = useState<BuildVariant>({
    guitarType: build.guitarType,
    boboNeck: build.boboNeck,
  });
  const { store, states } = useStepStore(build.id, build.sequenceState);
  const graph = useMemo(() => displayGraph(variant), [variant]);
  useEffect(() => forgetDiagramViewports(() => window.localStorage), []);
  return (
    <BuildContext.Provider value={{ build, canEdit, variant, setVariant, graph, store, states }}>
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild(): BuildContextValue {
  const value = useContext(BuildContext);
  if (!value) throw new Error("useBuild must be used inside <BuildProvider>");
  return value;
}
