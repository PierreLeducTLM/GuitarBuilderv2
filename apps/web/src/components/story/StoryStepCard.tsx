import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TimelineStep } from "@/lib/story/story";

/** build-story-sharing: Story Step Card. */
export function StoryStepCard({ step }: { step: TimelineStep }) {
  const t = useTranslations();
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-teal" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-lg font-semibold text-fg">{t(`steps.${step.key}`)}</h3>
          <span className="font-mono text-xs tracking-wider text-fg-dim uppercase">
            {t("story.stepNumber", { number: step.number })}
          </span>
        </div>
      </div>
    </article>
  );
}
