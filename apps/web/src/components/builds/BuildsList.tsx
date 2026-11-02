"use client";

import { Button, Chip, Panel } from "@gb/ui";
import { CircleAlert, Guitar, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { BuildSummary } from "@/lib/builds/types";
import { AddBuildDialog } from "./AddBuildDialog";

/** guitar-builds: Builds List, Builds List Empty State and Builds List Loading and Errors. */
export function BuildsList({ builds }: { builds: BuildSummary[] | null }) {
  const t = useTranslations("builds");
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="builds-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 id="builds-title" className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          {builds ? t("title", { count: builds.length }) : t("titlePlain")}
        </h1>
        <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          {t("addNew")}
        </Button>
      </div>

      {builds === null ? (
        <Panel
          role="alert"
          className="flex items-center gap-3 border-danger-ink bg-danger-soft text-danger-ink"
        >
          <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
          <p>{t("loadFailed")}</p>
        </Panel>
      ) : builds.length === 0 ? (
        <Panel padding="lg" className="flex flex-col items-center gap-3 py-12 text-center">
          <Guitar aria-hidden="true" className="size-10 text-fg-faint" />
          <p className="text-lg font-semibold text-fg">{t("empty")}</p>
          <p className="text-fg-dim">{t("emptyHint")}</p>
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((build) => (
            <li key={build.id}>
              <Link
                href={`/builds/${build.id}` as Route}
                className="flex min-h-24 flex-col justify-between gap-3 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-line-strong hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="text-lg font-semibold break-words text-fg">{build.name}</span>
                {build.guitarType ? (
                  <span>
                    <Chip>{t(`guitarType.${build.guitarType}`)}</Chip>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AddBuildDialog open={adding} onOpenChange={setAdding} />
    </section>
  );
}
