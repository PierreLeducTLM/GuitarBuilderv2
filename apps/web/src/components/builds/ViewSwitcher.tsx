import { cx } from "@gb/ui";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { isActive } from "@/lib/routes";

const VIEWS = [
  { id: "steps", path: "" },
  { id: "map", path: "/map" },
  { id: "overview", path: "/overview" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

/** The view a build URL shows; step screens belong to the Steps view. */
function currentView(base: string, pathname: string): ViewId {
  if (isActive(pathname, `${base}/map`)) return "map";
  if (isActive(pathname, `${base}/overview`)) return "overview";
  return "steps";
}

/** guitar-builds: Build Views. Each view is its own URL, so Back and reload keep it. */
export function ViewSwitcher({ buildId, pathname }: { buildId: string; pathname: string }) {
  const t = useTranslations("builds.views");
  const base = `/builds/${buildId}`;
  const current = currentView(base, pathname);
  return (
    <nav aria-label={t("label")}>
      <ul className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1 sm:inline-grid sm:min-w-96">
        {VIEWS.map((view) => (
          <li key={view.id} className="flex">
            <Link
              href={`${base}${view.path}` as Route}
              aria-current={view.id === current ? "page" : undefined}
              className={cx(
                "flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                view.id === current
                  ? "bg-selected font-semibold text-fg"
                  : "font-medium text-fg-dim hover:bg-raised hover:text-fg",
              )}
            >
              {t(view.id)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
