"use client";

import { LedProgress, TraceMark } from "@gb/ui";
import { Hammer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { progress } from "@/lib/sequence/state";
import { displayGraph } from "@/lib/sequence/variant";
import {
  type Story,
  type StoryEmptyState,
  storyEmptyState,
  storyTimeline,
} from "@/lib/story/story";
import { StoryNotFound } from "./StoryNotFound";
import { StoryStepCard } from "./StoryStepCard";

export interface StoryViewProps {
  /** The story, or null once its link no longer opens it. */
  story: Story | null;
  /** Shown at the end of the header: the updates switch. */
  headerAction?: ReactNode;
}

/**
 * build-story-sharing: the public story, without the app's navigation. Story Header,
 * Story Progress, the timeline (Story Timeline Filtering) or an empty state, and
 * nothing else (Story Hidden Information).
 */
export function StoryView({ story, headerAction }: StoryViewProps) {
  if (!story) return <StoryNotFound reason="notFound" />;
  return <StoryContent story={story} headerAction={headerAction} />;
}

function StoryContent({ story, headerAction }: { story: Story; headerAction?: ReactNode }) {
  const t = useTranslations("story");
  const format = useFormatter();
  const graph = displayGraph(story.variant);
  const figures = progress(graph, story.states);
  const timeline = storyTimeline(graph, story.states);
  const empty = storyEmptyState(graph, story.states);
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex items-center gap-2 font-mono text-xs tracking-widest text-amber-ink uppercase">
            <TraceMark size={20} />
            {t("title")}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            {story.name}
          </h1>
          <span className="text-sm text-fg-dim">
            {t("started", { date: format.dateTime(new Date(story.createdAt), "dateLong") })}
          </span>
        </div>
        {headerAction}
      </header>
      <main className="flex flex-col gap-6">
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <LedProgress
            value={figures.completed}
            max={figures.total}
            label={t("progress.title")}
            valueText={t("progress.steps", { completed: figures.completed, total: figures.total })}
          />
          <span className="font-mono text-sm text-amber-ink">
            {t("progress.percent", { percent: figures.percent })}
          </span>
        </section>
        {empty ? (
          <StoryEmpty kind={empty} />
        ) : (
          <ol aria-label={t("timeline")} className="flex flex-col gap-4">
            {timeline.map((step, index) => (
              <li key={step.key} data-latest-step={index === timeline.length - 1 || undefined}>
                <StoryStepCard step={step} />
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}

function StoryEmpty({ kind }: { kind: StoryEmptyState }) {
  const t = useTranslations("story.empty");
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-line border-dashed bg-inset px-6 py-10 text-center">
      <Hammer aria-hidden="true" className="size-8 text-fg-dim" />
      <h2 className="text-lg font-semibold text-fg">{t(`${kind}.title`)}</h2>
      <p className="max-w-md text-sm text-fg-dim">{t(`${kind}.message`)}</p>
    </section>
  );
}
