"use client";

import { Button, TextField } from "@gb/ui";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";

export interface WoodSaveFormProps {
  name: string;
  updating: boolean;
  saving: boolean;
  onNameChange: (name: string) => void;
  onSave: () => void;
}

/** wood-panel-properties: Save a New Panel and Update a Loaded Panel. */
export function WoodSaveForm({ name, updating, saving, onNameChange, onSave }: WoodSaveFormProps) {
  const t = useTranslations("wood.save");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-5">
      <TextField
        label={t("nameLabel")}
        placeholder={t("namePlaceholder")}
        value={name}
        maxLength={200}
        onChange={(event) => onNameChange(event.target.value)}
      />
      <Button
        type="submit"
        icon={<Save className="size-4" />}
        disabled={saving || !name.trim()}
        fullWidth
      >
        {saving ? t("saving") : t(updating ? "update" : "save")}
      </Button>
    </form>
  );
}
