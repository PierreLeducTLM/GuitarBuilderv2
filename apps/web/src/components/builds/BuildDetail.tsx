"use client";

import { Panel } from "@gb/ui";
import { Eye } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SequenceLegend } from "@/components/sequence/SequenceLegend";
import { StepDialog } from "@/components/sequence/StepDialog";
import { useStepStore } from "@/components/sequence/useStepStore";
import type { BuildDetailData } from "@/lib/builds/types";
import type { StepKey } from "@/lib/sequence/template";
import { type BuildVariant, displayGraph } from "@/lib/sequence/variant";
import { BuildHeader } from "./BuildHeader";
import { BuildTabs } from "./BuildTabs";
import { ConstructionSection } from "./ConstructionSection";
import { SummaryStrip } from "./SummaryStrip";
import { useDeleteBuild } from "./useDeleteBuild";

function DiagramLoading() {
  const t = useTranslations("sequence");
  return (
    <p role="status" className="py-16 text-center text-fg-dim">
      {t("loading")}
    </p>
  );
}

const SequenceDiagram = dynamic(() => import("@/components/sequence/SequenceDiagram"), {
  ssr: false,
  loading: DiagramLoading,
});

type Tab = "overview" | "sequence";

export interface BuildDetailProps {
  build: BuildDetailData;
  /** False for an administrator viewing another user's build (read-only). */
  canEdit: boolean;
}

/**
 * guitar-builds: the build detail page. The selected tab and open step live only in
 * this page's state, so a reload starts on Overview (Build Detail Tabs).
 */
export function BuildDetail({ build, canEdit }: BuildDetailProps) {
  const t = useTranslations("builds");
  const [variant, setVariant] = useState<BuildVariant>({
    guitarType: build.guitarType,
    boboNeck: build.boboNeck,
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [openStep, setOpenStep] = useState<StepKey | null>(null);
  const { store, states } = useStepStore(build.id, build.sequenceState);
  const { requestDelete, deleting } = useDeleteBuild(build.id);
  const graph = displayGraph(variant);

  function showStep(key: StepKey) {
    setTab("sequence");
    setOpenStep(key);
  }

  return (
    <div className="flex flex-col gap-6">
      <BuildHeader
        name={build.name}
        createdAt={build.createdAt}
        variant={variant}
        canEdit={canEdit}
        deleting={deleting}
        onDelete={requestDelete}
      />
      {canEdit ? null : (
        <p className="flex items-center gap-2 rounded-xl border border-admin-ink bg-admin-soft px-3.5 py-2.5 text-sm text-admin-ink">
          <Eye aria-hidden="true" className="size-4 shrink-0" />
          {t("detail.readOnly")}
        </p>
      )}
      <SummaryStrip graph={graph} states={states} onOpenStep={showStep} />
      <BuildTabs
        label={t("detail.tabsLabel")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: t("detail.tabOverview") },
          { value: "sequence", label: t("detail.tabSequence") },
        ]}
      >
        {tab === "overview" ? (
          <div className="flex flex-col gap-4">
            <ConstructionSection
              buildId={build.id}
              variant={variant}
              canEdit={canEdit}
              onChanged={setVariant}
            />
            <Panel as="section" aria-labelledby="acoustics-title" className="flex flex-col gap-2">
              <h2 id="acoustics-title" className="text-xl font-semibold text-fg">
                {t("acoustics.title")}
              </h2>
              <p className="text-fg-dim">{t("acoustics.placeholder")}</p>
            </Panel>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SequenceDiagram
              buildId={build.id}
              graph={graph}
              states={states}
              onOpenStep={setOpenStep}
            />
            <SequenceLegend />
          </div>
        )}
      </BuildTabs>
      <StepDialog
        buildId={build.id}
        stepKey={openStep}
        states={states}
        store={store}
        canEdit={canEdit}
        onClose={() => setOpenStep(null)}
      />
    </div>
  );
}
