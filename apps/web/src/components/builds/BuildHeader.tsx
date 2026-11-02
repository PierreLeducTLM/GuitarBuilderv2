"use client";

import { Button, Chip } from "@gb/ui";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { BuildVariant } from "@/lib/sequence/variant";

export interface BuildHeaderProps {
  name: string;
  createdAt: string;
  variant: BuildVariant;
  canEdit: boolean;
  deleting: boolean;
  onDelete: () => void;
}

/** guitar-builds: Build Detail Header. The Share action arrives with build-story-sharing. */
export function BuildHeader({
  name,
  createdAt,
  variant,
  canEdit,
  deleting,
  onDelete,
}: BuildHeaderProps) {
  const t = useTranslations("builds");
  const format = useFormatter();
  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/builds"
        className="-ml-2 inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-2 font-semibold text-fg-dim hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("detail.back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight break-words text-fg sm:text-5xl">
            {name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {variant.guitarType ? (
              <Chip>{t(`guitarType.${variant.guitarType}`)}</Chip>
            ) : (
              <Chip tone="signal">{t("detail.typeNotSet")}</Chip>
            )}
            {variant.boboNeck ? <Chip>{t("detail.boboNeck")}</Chip> : null}
            <span className="text-sm text-fg-dim">
              {t("detail.created", { date: format.dateTime(new Date(createdAt), "short") })}
            </span>
          </div>
        </div>
        {canEdit ? (
          <Button
            variant="secondary"
            icon={<Trash2 className="size-4" />}
            onClick={onDelete}
            disabled={deleting}
          >
            {t("detail.delete")}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
