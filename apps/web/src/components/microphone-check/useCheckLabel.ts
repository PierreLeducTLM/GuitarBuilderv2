"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { RememberedCheck } from "@/lib/microphone-check/memory";

/** The date and verdict of a remembered check, as both dialogs show them. */
export function useCheckLabel() {
  const t = useTranslations("microphoneCheck");
  const format = useFormatter();
  return (check: RememberedCheck) => ({
    date: format.dateTime(new Date(check.checkedAt), "short"),
    verdict:
      check.rate === "corrected"
        ? t("verdict.corrected", { rate: check.trueRate ?? check.measuredRate })
        : t(`verdict.${check.rate}`),
  });
}
