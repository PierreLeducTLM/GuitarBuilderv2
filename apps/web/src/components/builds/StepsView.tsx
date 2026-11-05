"use client";

import type { Route } from "next";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SequenceLegend } from "@/components/sequence/SequenceLegend";
import { useBuild } from "./BuildProvider";

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

/** The build's Steps view. */
export function StepsView() {
  const router = useRouter();
  const { build, graph, states } = useBuild();
  return (
    <div className="flex flex-col gap-3">
      <SequenceDiagram
        buildId={build.id}
        graph={graph}
        states={states}
        onOpenStep={(key) => router.push(`/builds/${build.id}/steps/${key}` as Route)}
      />
      <SequenceLegend />
    </div>
  );
}
