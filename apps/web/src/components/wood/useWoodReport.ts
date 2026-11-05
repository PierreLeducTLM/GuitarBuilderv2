"use client";

import { woodProperties } from "@gb/dsp";
import { useToast } from "@gb/ui";
import { useLocale, useMessages, useTimeZone, useTranslations } from "next-intl";
import { parseInputs, pdfFileName, validateInputs } from "@/lib/wood/calculator";
import type { CalculatorState } from "@/lib/wood/panel";
import { reportContent } from "@/lib/wood/report";
import { REPORT_FONTS } from "@/lib/wood/report-fonts";

async function fontFile(path: string) {
  const response = await fetch(path);
  return new Uint8Array(await response.arrayBuffer());
}

function download(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * wood-panel-properties: PDF Report Download. The renderer and the fonts load only when a
 * report is requested. The "AI Analysis" section arrives with `knowledge-assistant`.
 */
export function useWoodReport(state: CalculatorState) {
  const t = useTranslations("wood.report");
  const messages = useMessages();
  const locale = useLocale();
  const timeZone = useTimeZone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const toast = useToast();

  return async function downloadReport(loadedName: string) {
    toast.show({ type: "info", message: t("generating") });
    try {
      if (Object.keys(validateInputs(state.inputs)).length > 0) throw new Error("Invalid inputs");
      const inputs = parseInputs(state.inputs);
      const panelName = state.name.trim() || loadedName;
      const now = new Date();
      const [{ renderReport }, regular, bold, figures, figuresBold] = await Promise.all([
        import("@/lib/wood/render-report"),
        fontFile(REPORT_FONTS.words.regular),
        fontFile(REPORT_FONTS.words.bold),
        fontFile(REPORT_FONTS.figures.regular),
        fontFile(REPORT_FONTS.figures.bold),
      ]);
      const bytes = await renderReport(
        reportContent({
          inputs,
          properties: woodProperties(inputs),
          panelName,
          generatedAt: now,
          locale,
          timeZone,
          messages: messages.wood.report,
        }),
        { words: { regular, bold }, figures: { regular: figures, bold: figuresBold } },
      );
      download(bytes, pdfFileName({ name: panelName, date: now, timeZone }));
      toast.show({ type: "success", message: t("downloaded") });
    } catch {
      toast.show({ type: "error", message: t("failed") });
    }
  };
}
