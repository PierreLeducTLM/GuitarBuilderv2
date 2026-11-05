"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { StepDialog } from "@/components/sequence/StepDialog";
import type { StepKey } from "@/lib/sequence/template";
import { useBuild } from "./BuildProvider";
import { StepsView } from "./StepsView";

/** A step's own URL. */
export function StepRoute({ stepKey }: { stepKey: StepKey }) {
  const router = useRouter();
  const { build, canEdit, states, store } = useBuild();
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
