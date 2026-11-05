import { cx } from "@gb/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { activeTab, destinations } from "@/lib/routes";
import { entryIcons } from "./navigation";

const STEP_SCREEN = /^\/builds\/[^/]+\/steps\//;

/**
 * app-shell: Mobile Bottom Tab Bar. The only navigation below 1024 px; step screens
 * own the whole screen, so the bar is left out there.
 */
export function TabBar({ pathname }: { pathname: string }) {
  const t = useTranslations("nav");
  if (STEP_SCREEN.test(pathname)) return null;
  const active = activeTab(pathname);
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="grid grid-cols-4 gap-1">
        {destinations.map((destination) => {
          const Icon = entryIcons[destination.id];
          const current = destination.id === active;
          return (
            <li key={destination.id} className="flex">
              <Link
                href={destination.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-2xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                  current
                    ? "bg-selected font-semibold text-fg"
                    : "font-medium text-fg-dim hover:bg-raised hover:text-fg",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{t(destination.id)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
