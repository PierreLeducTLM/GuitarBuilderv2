"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StepDialog } from "@/components/sequence/StepDialog";
import type { StepKey } from "@/lib/sequence/template";
import { useBuild } from "./BuildProvider";
import { StepsView } from "./StepsView";

/** A step's own URL. */
export function StepRoute({ stepKey }: { stepKey: StepKey }) {
  const router = useRouter();
  const { build, canEdit, graph, states, store } = useBuild();
  const shown = graph.steps.some((step) => step.key === stepKey);

  // The variant can change while the step is open (Change construction): a step it hides
  // is left for the Steps view, as a link to it would be.
  useEffect(() => {
    if (!shown) router.replace(`/builds/${build.id}` as Route);
  }, [shown, router, build.id]);

  if (!shown) return null;
  return (
    <>
      <StepsView />
      <StepDialog
        buildId={build.id}
        stepKey={stepKey}
        states={states}
        store={store}
        canEdit={canEdit}
        onClose={() => router.push(`/builds/${build.id}` as Route)}
      />
    </>
  );
}
