"use client";

import { cx } from "@gb/ui";
import { useTranslations } from "next-intl";

/** The three step states, named under the diagram (build-sequence: Ready Steps). */
export function SequenceLegend() {
  const t = useTranslations("sequence.legend");
  const items = [
    { key: "completed", swatch: "border-teal-line bg-teal-soft" },
    { key: "ready", swatch: "border-amber bg-amber-soft" },
    { key: "notStarted", swatch: "border-line bg-panel" },
  ] as const;
  return (
    <ul aria-label={t("label")} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-dim">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cx("inline-block h-3.5 w-6 rounded border", item.swatch)}
          />
          {t(item.key)}
        </li>
      ))}
    </ul>
  );
}
