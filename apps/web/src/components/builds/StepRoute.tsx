"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StepScreen } from "@/components/steps/StepScreen";
import type { GroupKey } from "@/lib/sequence/groups";
import type { StepKey } from "@/lib/sequence/template";
import { useBuild } from "./BuildProvider";
import { StepsView } from "./StepsView";

/**
 * A step's own URL (build-sequence: Step Screen). Below 1024 px the step fills the
 * screen; from 1024 px it sits beside the Steps checklist. Moving between steps replaces
 * the history entry, so Back leaves the steps for where they were opened from.
 */
export function StepRoute({ stepKey, from }: { stepKey: StepKey; from: GroupKey | null }) {
  const router = useRouter();
  const { build, canEdit, graph, states, store } = useBuild();
  const shown = graph.steps.some((step) => step.key === stepKey);
  const stepsView = `/builds/${build.id}` as Route;

  // The variant can change while the step is open (Change construction): a step it hides
  // is left for the Steps view, as a link to it would be.
  useEffect(() => {
    if (!shown) router.replace(stepsView);
  }, [shown, router, stepsView]);

  if (!shown) return null;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start lg:gap-8">
      <div className="hidden lg:block">
        <StepsView currentKey={stepKey} />
      </div>
      <div className="lg:sticky lg:top-6">
        <StepScreen
          buildId={build.id}
          stepKey={stepKey}
          graph={graph}
          states={states}
          store={store}
          canEdit={canEdit}
          from={from}
          onNavigate={(key) =>
            router.replace(
              key
                ? (`/builds/${build.id}/steps/${key}${from ? `?from=${from}` : ""}` as Route)
                : stepsView,
            )
          }
        />
      </div>
    </div>
  );
}
