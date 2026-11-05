"use client";

import { Panel } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useBuild } from "./BuildProvider";
import { ConstructionSection } from "./ConstructionSection";

/** guitar-builds: Build Overview Tab, shown as the build's Overview view. */
export function OverviewView() {
  const t = useTranslations("builds");
  const { build, canEdit, variant, setVariant } = useBuild();
  return (
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
  );
}
