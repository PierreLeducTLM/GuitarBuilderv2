"use client";

import type { GuitarType } from "@gb/db";
import { Button, DialogFrame, Panel, useToast } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { BuildVariant } from "@/lib/sequence/variant";
import { createClient } from "@/lib/supabase/client";
import { VariantFields } from "./VariantFields";

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
  const tDialog = useTranslations("dialog");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [guitarType, setGuitarType] = useState<GuitarType | null>(variant.guitarType);
  const [boboNeck, setBoboNeck] = useState(variant.boboNeck);
  const [missingType, setMissingType] = useState(false);
  const [pending, setPending] = useState(false);

  function openDialog() {
    setGuitarType(variant.guitarType);
    setBoboNeck(variant.boboNeck);
    setMissingType(false);
    setOpen(true);
  }

  async function save() {
    if (!guitarType) {
      setMissingType(true);
      return;
    }
    setPending(true);
    const { data, error } = await createClient()
      .from("builds")
      .update({ guitar_type: guitarType, bobo_neck: boboNeck })
      .eq("id", buildId)
      .select("id");
    setPending(false);
    if (error || !data || data.length === 0) {
      toast.show({ type: "error", message: t("saveFailed") });
      return;
    }
    onChanged({ guitarType, boboNeck });
    setOpen(false);
  }

  return (
    <Panel as="section" aria-labelledby="construction-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="construction-title" className="text-xl font-semibold text-fg">
          {t("construction.title")}
        </h2>
        {canEdit ? (
          <Button variant="secondary" onClick={openDialog}>
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

      <DialogFrame
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={t("construction.title")}
        closeLabel={tDialog("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {tDialog("cancel")}
            </Button>
            <Button onClick={save} disabled={pending}>
              {tDialog("save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <VariantFields
            guitarType={guitarType}
            boboNeck={boboNeck}
            onGuitarTypeChange={(value) => {
              setGuitarType(value);
              setMissingType(false);
            }}
            onBoboNeckChange={setBoboNeck}
            guitarTypeError={missingType ? t("create.typeRequired") : undefined}
            disabled={pending}
          />
        </div>
      </DialogFrame>
    </Panel>
  );
}
