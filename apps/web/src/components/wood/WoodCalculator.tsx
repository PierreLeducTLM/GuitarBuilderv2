"use client";

import { Panel } from "@gb/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { WoodPanelSummary } from "@/lib/wood/types";
import { WoodLibrary } from "./WoodLibrary";

function Area({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <Panel padding="lg" className="flex flex-col gap-5">
        <h2 id={id} className="text-xl font-semibold text-fg">
          {title}
        </h2>
        {children}
      </Panel>
    </section>
  );
}

/** wood-panel-properties: the calculator page with its three areas. */
export function WoodCalculator({ panels }: { panels: WoodPanelSummary[] | null }) {
  const t = useTranslations("wood");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">{t("title")}</h1>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Area id="wood-inputs-title" title={t("areas.inputs")} />
        <Area id="wood-results-title" title={t("areas.results")} className="lg:sticky lg:top-6" />
      </div>
      <Area id="wood-library-title" title={t("areas.library")}>
        <WoodLibrary panels={panels} />
      </Area>
    </div>
  );
}
