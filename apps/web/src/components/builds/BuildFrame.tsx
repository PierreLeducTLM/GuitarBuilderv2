"use client";

import { Eye } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BuildHeader } from "./BuildHeader";
import { useBuild } from "./BuildProvider";
import { SummaryStrip } from "./SummaryStrip";
import { useDeleteBuild } from "./useDeleteBuild";

/** The parts of a build's page shared by all its views: header and summary strip. */
export function BuildFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("builds");
  const router = useRouter();
  const { build, canEdit, variant, graph, states } = useBuild();
  const { requestDelete, deleting } = useDeleteBuild(build.id);
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
      <SummaryStrip
        graph={graph}
        states={states}
        onOpenStep={(key) => router.push(`/builds/${build.id}/steps/${key}` as Route)}
      />
      {children}
    </div>
  );
}
