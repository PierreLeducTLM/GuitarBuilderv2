"use client";

import type { GuitarType } from "@gb/db";
import { Button, DialogFrame, TextField } from "@gb/ui";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { type NewBuildErrors, validateNewBuild } from "@/lib/builds/validation";
import { createClient } from "@/lib/supabase/client";
import { VariantFields } from "./VariantFields";

export interface AddBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * guitar-builds: Create Build Dialog and Create Build Submission. The build is created
 * as the signed-in user (the database sets the owner); on success the user is taken to
 * its detail page.
 */
export function AddBuildDialog({ open, onOpenChange }: AddBuildDialogProps) {
  const t = useTranslations("builds");
  const tDialog = useTranslations("dialog");
  const router = useRouter();
  const [name, setName] = useState("");
  const [guitarType, setGuitarType] = useState<GuitarType | null>(null);
  const [boboNeck, setBoboNeck] = useState(true);
  const [errors, setErrors] = useState<NewBuildErrors>({});
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  // Guards against a second submission before React re-renders the disabled button.
  const submitting = useRef(false);

  function reset() {
    setName("");
    setGuitarType(null);
    setBoboNeck(true);
    setErrors({});
    setFailed(false);
  }

  function changeOpen(next: boolean) {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const found = validateNewBuild({ name, guitarType });
    setErrors(found);
    setFailed(false);
    if (found.name || found.guitarType) return;

    submitting.current = true;
    setPending(true);
    const { data, error } = await createClient()
      .from("builds")
      .insert({ name: name.trim(), guitar_type: guitarType, bobo_neck: boboNeck })
      .select("id")
      .single();
    if (error || !data) {
      setFailed(true);
      setPending(false);
      submitting.current = false;
      return;
    }
    router.push(`/builds/${data.id}` as Route);
    reset();
    setPending(false);
    submitting.current = false;
    onOpenChange(false);
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={changeOpen}
      title={t("create.title")}
      closeLabel={tDialog("close")}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t("create.nameLabel")}
          placeholder={t("create.namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name ? t("create.nameRequired") : undefined}
          disabled={pending}
          autoComplete="off"
        />
        <VariantFields
          guitarType={guitarType}
          boboNeck={boboNeck}
          onGuitarTypeChange={(value) => {
            setGuitarType(value);
            setErrors((current) => ({ ...current, guitarType: undefined }));
          }}
          onBoboNeckChange={setBoboNeck}
          guitarTypeError={errors.guitarType ? t("create.typeRequired") : undefined}
          disabled={pending}
        />
        {failed ? (
          <p
            role="alert"
            className="rounded-xl border border-danger-ink bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink"
          >
            {t("create.failed")}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => changeOpen(false)} disabled={pending}>
            {tDialog("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("create.submitting") : t("create.submit")}
          </Button>
        </div>
      </form>
    </DialogFrame>
  );
}
