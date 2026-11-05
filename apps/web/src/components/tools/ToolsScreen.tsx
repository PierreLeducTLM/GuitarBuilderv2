import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { entryIcons } from "@/components/shell/navigation";
import { PageBar } from "@/components/shell/PageBar";
import { destinations } from "@/lib/routes";

const [, tools] = destinations;

/** app-shell: Tools Page. Each tool with its icon, name and one-line description. */
export function ToolsScreen() {
  const t = useTranslations();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageBar title={t("tools.title")} />
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {tools.sections.map((tool) => {
          const Icon = entryIcons[tool.id];
          return (
            <li key={tool.id}>
              <Link
                href={tool.href as Route}
                className="flex min-h-16 items-center gap-4 rounded-lg px-1 py-3.5 transition-colors duration-150 hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <Icon aria-hidden="true" className="size-6 shrink-0 text-amber-ink" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-semibold text-fg">{t(`nav.${tool.id}`)}</span>
                  <span className="text-sm text-fg-dim">{t(`tools.${tool.id}`)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
