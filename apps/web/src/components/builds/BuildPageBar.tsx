"use client";

import { Chip, IconButton, Menu, MenuContent, MenuItem, MenuTrigger } from "@gb/ui";
import { MoreHorizontal, Settings2, Share2, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PageBar } from "@/components/shell/PageBar";
import { DEFAULT_ROUTE } from "@/lib/routes";
import type { BuildVariant } from "@/lib/sequence/variant";

export interface BuildPageBarProps {
  name: string;
  createdAt: string;
  variant: BuildVariant;
  canEdit: boolean;
  deleting: boolean;
  onDelete: () => void;
  onChangeConstruction: () => void;
  onShare: () => void;
}

/**
 * guitar-builds: Build Detail Header, as the build's page bar. Share, Change construction
 * and Delete Build live in the "More actions" menu, which a read-only build lacks.
 */
export function BuildPageBar({
  name,
  createdAt,
  variant,
  canEdit,
  deleting,
  onDelete,
  onChangeConstruction,
  onShare,
}: BuildPageBarProps) {
  const t = useTranslations("builds");
  const tNav = useTranslations("nav");
  const format = useFormatter();
  return (
    <PageBar
      title={name}
      back={{ href: DEFAULT_ROUTE, label: tNav("builds") }}
      actions={
        canEdit ? (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label={t("actions.more")}>
                <MoreHorizontal className="size-5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={onShare}>
                <Share2 aria-hidden="true" className="size-4 text-fg-dim" />
                {t("detail.share")}
              </MenuItem>
              <MenuItem onSelect={onChangeConstruction}>
                <Settings2 aria-hidden="true" className="size-4 text-fg-dim" />
                {t("actions.changeConstruction")}
              </MenuItem>
              <MenuItem
                disabled={deleting}
                onSelect={onDelete}
                className="mt-1 border-t border-line text-danger-ink data-[highlighted]:bg-danger-soft"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {t("detail.delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null
      }
    >
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
    </PageBar>
  );
}
