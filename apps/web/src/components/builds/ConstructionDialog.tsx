"use client";

import type { GuitarType } from "@gb/db";
import { Button, DialogFrame, useToast } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { BuildVariant } from "@/lib/sequence/variant";
import { createClient } from "@/lib/supabase/client";
import { VariantFields } from "./VariantFields";

export interface ConstructionDialogProps {
  buildId: string;
  variant: BuildVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (variant: BuildVariant) => void;
}

/**
 * guitar-builds: Change Construction Variant. Opened from the Construction section and
 * from the build's "More actions" menu; each opening starts from the saved variant.
 */
export function ConstructionDialog(props: ConstructionDialogProps) {
  return props.open ? <OpenConstructionDialog {...props} /> : null;
}

function OpenConstructionDialog({
  buildId,
  variant,
  onOpenChange,
  onChanged,
}: ConstructionDialogProps) {
  const t = useTranslations("builds");
  const tDialog = useTranslations("dialog");
  const toast = useToast();
  const [guitarType, setGuitarType] = useState<GuitarType | null>(variant.guitarType);
  const [boboNeck, setBoboNeck] = useState(variant.boboNeck);
  const [missingType, setMissingType] = useState(false);
  const [pending, setPending] = useState(false);

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
    onOpenChange(false);
  }

  return (
    <DialogFrame
      open
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={t("construction.title")}
      closeLabel={tDialog("close")}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
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
  );
}
