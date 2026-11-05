"use client";

import { Chip, cx, IconButton } from "@gb/ui";
import { CircleAlert, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { formatValue } from "@/lib/wood/calculator";
import type { WoodPanelSummary } from "@/lib/wood/types";

export interface WoodLibraryProps {
  panels: WoodPanelSummary[] | null;
  loadedId: string | null;
  onOpen: (panel: WoodPanelSummary) => void;
  onDelete: (panel: WoodPanelSummary) => void;
}

/** wood-panel-properties: Saved Panel Library and Library Load Failures. */
export function WoodLibrary({ panels, loadedId, onOpen, onDelete }: WoodLibraryProps) {
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
      {panels.map((panel) => {
        const loaded = panel.id === loadedId;
        return (
          <li
            key={panel.id}
            className={cx(
              "flex flex-col gap-3 rounded-2xl border bg-inset p-4",
              loaded ? "border-amber-ink shadow-[0_0_0_3px_var(--gb-glow-amber)]" : "border-line",
            )}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                aria-pressed={loaded}
                onClick={() => onOpen(panel)}
                className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
              </button>
              <IconButton
                variant="ghost"
                label={t("delete", { name: panel.name })}
                onClick={() => onDelete(panel)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
            {loaded ? (
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="signal">{t("currentlyEditing")}</Chip>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
