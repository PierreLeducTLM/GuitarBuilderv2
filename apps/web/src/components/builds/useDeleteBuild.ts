"use client";

import { STEP_PHOTOS_BUCKET } from "@gb/db";
import { useToast } from "@gb/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/DialogProvider";
import { createClient } from "@/lib/supabase/client";

const REMOVE_BATCH = 1000;

/**
 * Deletes a build's photo files, then the build itself (guitar-builds: Delete Build
 * Confirmation, Delete Build Cascade). Files go first so a deleted build never leaves
 * public files behind. Storage answers a refused delete with an empty list, so every
 * path must come back as removed.
 */
async function deleteBuildAndPhotos(buildId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: paths, error } = await supabase.rpc("build_photo_paths", { p_build_id: buildId });
  if (error || !paths) return false;
  for (let start = 0; start < paths.length; start += REMOVE_BATCH) {
    const batch = paths.slice(start, start + REMOVE_BATCH);
    const removed = await supabase.storage.from(STEP_PHOTOS_BUCKET).remove(batch);
    if (removed.error || (removed.data?.length ?? 0) !== batch.length) return false;
  }
  const { data, error: deleteError } = await supabase
    .from("builds")
    .delete()
    .eq("id", buildId)
    .select("id");
  return !deleteError && (data?.length ?? 0) === 1;
}

export function useDeleteBuild(buildId: string) {
  const t = useTranslations("builds.deleteDialog");
  const tDialog = useTranslations("dialog");
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function requestDelete() {
    const confirmed = await confirm({
      title: t("title"),
      message: t("message"),
      confirmLabel: t("confirm"),
      cancelLabel: tDialog("cancel"),
      variant: "danger",
    });
    if (!confirmed) return;
    setDeleting(true);
    if (await deleteBuildAndPhotos(buildId)) {
      router.replace("/builds");
      router.refresh();
      return;
    }
    setDeleting(false);
    toast.show({ type: "error", message: t("failed") });
  }

  return { requestDelete, deleting };
}
