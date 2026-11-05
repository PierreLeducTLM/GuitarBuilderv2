"use client";

import { Button, Panel } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { BuildVariant } from "@/lib/sequence/variant";
import { ConstructionDialog } from "./ConstructionDialog";

export interface ConstructionSectionProps {
  buildId: string;
  variant: BuildVariant;
  canEdit: boolean;
  onChanged: (variant: BuildVariant) => void;
}

/** guitar-builds: Build Overview Tab (construction) and Change Construction Variant. */
export function ConstructionSection({
  buildId,
  variant,
  canEdit,
  onChanged,
}: ConstructionSectionProps) {
  const t = useTranslations("builds");
  const [open, setOpen] = useState(false);

  return (
    <Panel as="section" aria-labelledby="construction-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="construction-title" className="text-xl font-semibold text-fg">
          {t("construction.title")}
        </h2>
        {canEdit ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t("construction.change")}
          </Button>
        ) : null}
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem]">
        <dt className="sr-only">{t("create.typeLabel")}</dt>
        <dd className="font-semibold text-fg">
          {variant.guitarType ? t(`guitarType.${variant.guitarType}`) : t("detail.typeNotSet")}
        </dd>
        <dt className="sr-only">{t("create.boboLabel")}</dt>
        <dd className="text-fg">
          {variant.boboNeck ? t("construction.boboYes") : t("construction.boboNo")}
        </dd>
      </dl>
      {!variant.guitarType && canEdit ? (
        <p className="text-sm text-amber-ink">{t("construction.notSetHint")}</p>
      ) : null}
      <ConstructionDialog
        buildId={buildId}
        variant={variant}
        open={open}
        onOpenChange={setOpen}
        onChanged={onChanged}
      />
    </Panel>
  );
}
