"use client";

import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { BuildPageBar } from "./BuildPageBar";
import { useBuild } from "./BuildProvider";
import { ConstructionDialog } from "./ConstructionDialog";
import { SummaryStrip } from "./SummaryStrip";
import { useDeleteBuild } from "./useDeleteBuild";
import { ViewSwitcher } from "./ViewSwitcher";

/** The parts of a build's page shared by all its views: page bar and summary strip. */
export function BuildFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("builds");
  const pathname = usePathname();
  const { build, canEdit, variant, setVariant, graph, states } = useBuild();
  const { requestDelete, deleting } = useDeleteBuild(build.id);
  const [changingConstruction, setChangingConstruction] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <BuildPageBar
        name={build.name}
        createdAt={build.createdAt}
        variant={variant}
        canEdit={canEdit}
        deleting={deleting}
        onDelete={requestDelete}
        onChangeConstruction={() => setChangingConstruction(true)}
      />
      <ConstructionDialog
        buildId={build.id}
        variant={variant}
        open={changingConstruction}
        onOpenChange={setChangingConstruction}
        onChanged={setVariant}
      />
      {canEdit ? null : (
        <p className="flex items-center gap-2 rounded-xl border border-admin-ink bg-admin-soft px-3.5 py-2.5 text-sm text-admin-ink">
          <Eye aria-hidden="true" className="size-4 shrink-0" />
          {t("detail.readOnly")}
        </p>
      )}
      <SummaryStrip buildId={build.id} graph={graph} states={states} />
      <ViewSwitcher buildId={build.id} pathname={pathname} />
      {children}
    </div>
  );
}
