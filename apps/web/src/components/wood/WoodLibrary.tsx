"use client";

import { CircleAlert } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { formatValue } from "@/lib/wood/calculator";
import type { WoodPanelSummary } from "@/lib/wood/types";

/** wood-panel-properties: Saved Panel Library and Library Load Failures. */
export function WoodLibrary({ panels }: { panels: WoodPanelSummary[] | null }) {
  const t = useTranslations("wood.library");
  const format = useFormatter();
  const locale = useLocale();

  if (panels === null) {
    return (
      <p
        role="alert"
        className="flex items-center gap-3 rounded-xl border border-danger-ink bg-danger-soft p-3 text-danger-ink"
      >
        <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
        {t("loadFailed")}
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map((panel) => (
        <li
          key={panel.id}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-inset p-4"
        >
          <span className="text-lg font-semibold break-words text-fg">{panel.name}</span>
          <span className="text-sm text-fg-dim">
            {format.dateTime(new Date(panel.createdAt), "short")}
          </span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {panel.targetThickness === null ? null : (
              <>
                <dt className="text-fg-dim">{t("targetThickness")}</dt>
                <dd className="font-mono text-fg">
                  {formatValue(panel.targetThickness, 2, locale)} mm
                </dd>
              </>
            )}
            {panel.estimatedMass === null ? null : (
              <>
                <dt className="text-fg-dim">{t("estimatedMass")}</dt>
                <dd className="font-mono text-fg">
                  {formatValue(panel.estimatedMass, 1, locale)} g
                </dd>
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
