"use client";

import { ToastProvider } from "@gb/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { DialogProvider } from "./DialogProvider";
import { ThemeProvider } from "./ThemeProvider";

/** Client-side providers shared by every screen: theme, toasts and dialogs. */
export function AppProviders({ children }: { children: ReactNode }) {
  const t = useTranslations("toast");
  return (
    <ThemeProvider>
      <ToastProvider
        closeLabel={t("close")}
        regionLabel={t("region")}
        typeLabels={{
          success: t("success"),
          error: t("error"),
          warning: t("warning"),
          info: t("info"),
        }}
      >
        <DialogProvider>{children}</DialogProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
