import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export interface PageBarProps {
  title: ReactNode;
  /** The parent page, for pages below a destination. */
  back?: { href: string; label: string };
  /** The page's own actions, at the end of the bar. */
  actions?: ReactNode;
  /** Details shown under the title (chips, dates). */
  children?: ReactNode;
}

/** app-shell: Page Bar. The title, the way back to the parent page and the page's actions. */
export function PageBar({ title, back, actions, children }: PageBarProps) {
  return (
    <header className="flex flex-col gap-2">
      {back ? (
        <Link
          href={back.href as Route}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-semibold text-fg-dim hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-fg sm:text-3xl">
            {title}
          </h1>
          {children}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
