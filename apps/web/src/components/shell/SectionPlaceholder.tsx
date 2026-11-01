import { Panel } from "@gb/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SectionId } from "@/lib/routes";

/** Stand-in page for a section whose features arrive in a later change. */
export function SectionPlaceholder({ id, children }: { id: SectionId; children?: ReactNode }) {
  const t = useTranslations();
  return (
    <section aria-labelledby="section-title" className="flex flex-col gap-6">
      <h1 id="section-title" className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
        {t(`nav.${id}`)}
      </h1>
      {children}
      <Panel padding="none" className="overflow-hidden">
        <div
          aria-hidden="true"
          className="relative h-40 bg-inset [background-image:linear-gradient(var(--gb-grid)_1px,transparent_1px),linear-gradient(90deg,var(--gb-grid)_1px,transparent_1px)] [background-size:32px_32px]"
        >
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-amber-ink opacity-80 shadow-glow-amber" />
        </div>
        <p className="border-t border-line px-4 py-3 text-[0.9375rem] text-fg-dim">
          {t("sections.placeholder")}
        </p>
      </Panel>
    </section>
  );
}
