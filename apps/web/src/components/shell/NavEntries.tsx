"use client";

import { cx } from "@gb/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActive, type Section } from "@/lib/routes";
import { sectionIcons } from "./navigation";

type Variant = "bar" | "list" | "tabs";

const containerClasses: Record<Variant, string> = {
  bar: "inline-flex gap-0.5 rounded-xl border border-line bg-panel p-1",
  list: "flex flex-col gap-1",
  tabs: "grid auto-cols-fr grid-flow-col",
};

const entryClasses: Record<Variant, string> = {
  bar: "min-h-11 gap-2 rounded-lg px-3.5 text-sm",
  list: "min-h-12 gap-3 rounded-xl px-3 text-base",
  tabs: "min-h-14 flex-col justify-center gap-0.5 rounded-xl px-1 text-2xs",
};

/**
 * The section entries in one of the three navigation forms (desktop bar, mobile
 * slide-out list, mobile bottom tabs). Admin-only entries use the admin accent in
 * every state (app-shell: Admin Entries Visually Distinguished).
 */
export function NavEntries({
  sections,
  variant,
  label,
  onNavigate,
}: {
  sections: readonly Section[];
  variant: Variant;
  label: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className={containerClasses[variant]}>
        {sections.map((section) => {
          const active = isActive(pathname, section.href);
          const Icon = sectionIcons[section.id];
          const text = variant === "tabs" ? t(`short.${section.id}`) : t(section.id);
          return (
            <li key={section.id} className="flex">
              <Link
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                data-admin={section.adminOnly || undefined}
                aria-label={variant === "tabs" ? t(section.id) : undefined}
                className={cx(
                  "flex flex-1 items-center whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                  entryClasses[variant],
                  active ? "bg-selected font-semibold" : "font-medium hover:bg-raised",
                  section.adminOnly
                    ? "text-admin-ink"
                    : active
                      ? "text-fg"
                      : "text-fg-dim hover:text-fg",
                )}
              >
                <Icon aria-hidden="true" className={variant === "tabs" ? "size-5" : "size-4"} />
                <span className={variant === "tabs" ? "max-w-full truncate" : undefined}>
                  {text}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
