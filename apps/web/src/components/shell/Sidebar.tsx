import type { AppRole } from "@gb/db";
import { cx, TraceMark } from "@gb/ui";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RecentBuild } from "@/lib/builds/types";
import {
  activeEntry,
  adminEntriesFor,
  DEFAULT_ROUTE,
  destinations,
  type EntryId,
  isActive,
} from "@/lib/routes";
import { entryIcons } from "./navigation";

export interface SidebarProps {
  pathname: string;
  role: AppRole;
  email: string;
  /** The user's recent builds, most recent first, listed under Builds. */
  recentBuilds: readonly RecentBuild[];
}

function Entry({
  id,
  href,
  label,
  current,
  admin = false,
  nested = false,
}: {
  id: EntryId;
  href: string;
  label: string;
  current: boolean;
  admin?: boolean;
  nested?: boolean;
}) {
  const Icon = entryIcons[id];
  return (
    <Link
      href={href as Route}
      aria-current={current ? "page" : undefined}
      data-admin={admin || undefined}
      className={cx(
        "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        nested && "ml-4",
        current ? "bg-selected font-semibold" : "font-medium hover:bg-raised",
        admin ? "text-admin-ink" : current ? "text-fg" : "text-fg-dim hover:text-fg",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * app-shell: Desktop Sidebar. From 1024 px it is the navigation: title, destinations
 * with their sections and the recent builds, admin entries, and the account entry.
 */
export function Sidebar({ pathname, role, email, recentBuilds }: SidebarProps) {
  const t = useTranslations();
  const active = activeEntry(pathname);
  const admin = adminEntriesFor(role);
  const viewedBuild = recentBuilds.find((build) => isActive(pathname, `/builds/${build.id}`));
  const [builds, tools, assistant] = destinations;
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col gap-5 border-r border-line bg-panel px-3 py-4 lg:flex">
      <Link
        href={DEFAULT_ROUTE}
        className="flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <TraceMark size={30} />
        <span className="truncate text-base font-semibold tracking-tight text-fg">
          {t("app.title")}
        </span>
      </Link>

      <nav
        aria-label={t("nav.label")}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      >
        <div className="flex flex-col gap-0.5">
          <Entry
            id={builds.id}
            href={builds.href}
            label={t("nav.builds")}
            current={active === builds.id && !viewedBuild}
          />
          {recentBuilds.length > 0 ? (
            <ul aria-label={t("nav.recentBuilds")} className="flex flex-col gap-0.5">
              {recentBuilds.map((build) => {
                const current = build === viewedBuild;
                return (
                  <li key={build.id}>
                    <Link
                      href={`/builds/${build.id}` as Route}
                      aria-current={current ? "page" : undefined}
                      className={cx(
                        "ml-4 flex min-h-9 items-center rounded-lg px-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                        current
                          ? "bg-selected font-semibold text-fg"
                          : "text-fg-dim hover:bg-raised hover:text-fg",
                      )}
                    >
                      <span className="truncate">{build.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col gap-0.5">
          <Entry
            id={tools.id}
            href={tools.href}
            label={t("nav.tools")}
            current={active === tools.id}
          />
          {tools.sections.map((section) => (
            <Entry
              key={section.id}
              id={section.id}
              href={section.href}
              label={t(`nav.${section.id}`)}
              current={active === section.id}
              nested
            />
          ))}
        </div>
        <Entry
          id={assistant.id}
          href={assistant.href}
          label={t("nav.assistant")}
          current={active === assistant.id}
        />
        {admin.length > 0 ? (
          <div
            role="group"
            aria-label={t("you.administration")}
            className="flex flex-col gap-0.5 border-t border-line pt-4"
          >
            {admin.map((entry) => (
              <Entry
                key={entry.id}
                id={entry.id}
                href={entry.href}
                label={t(`nav.${entry.id}`)}
                current={active === entry.id}
                admin
              />
            ))}
          </div>
        ) : null}
      </nav>

      <Link
        href={"/you" as Route}
        aria-current={active === "you" ? "page" : undefined}
        aria-label={email}
        title={t("nav.account")}
        className={cx(
          "flex min-h-11 items-center gap-2.5 rounded-lg border-t border-line px-2.5 pt-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
          active === "you" ? "bg-selected text-fg" : "text-fg-dim hover:text-fg",
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-selected text-xs font-bold text-fg uppercase"
        >
          {email.charAt(0)}
        </span>
        <span aria-hidden="true" className="truncate">
          {email}
        </span>
      </Link>
    </aside>
  );
}
