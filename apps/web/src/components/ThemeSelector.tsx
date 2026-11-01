"use client";

import { SegmentedControl } from "@gb/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "./ThemeProvider";

/** Light / System / Dark selector (app-shell: Theme Selection and Persistence). */
export function ThemeSelector({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      label={t("label")}
      value={preference}
      onChange={setPreference}
      className={className}
      options={[
        {
          value: "light",
          label: <Sun aria-hidden="true" className="size-4" />,
          ariaLabel: t("light"),
          title: t("light"),
        },
        {
          value: "system",
          label: <Monitor aria-hidden="true" className="size-4" />,
          ariaLabel: t("system"),
          title: t("system"),
        },
        {
          value: "dark",
          label: <Moon aria-hidden="true" className="size-4" />,
          ariaLabel: t("dark"),
          title: t("dark"),
        },
      ]}
    />
  );
}
