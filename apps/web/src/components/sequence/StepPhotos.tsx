"use client";

import { STEP_PHOTOS_BUCKET, type StepPhoto, stepPhotoPath } from "@gb/db";
import { Button, Lightbox, useToast } from "@gb/ui";
import { Camera, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { photoFileName } from "@/lib/sequence/photos";
import type { StepStore } from "@/lib/sequence/store";
import type { StepKey } from "@/lib/sequence/template";
import { createClient } from "@/lib/supabase/client";

export interface StepPhotosProps {
  buildId: string;
  stepKey: StepKey;
  stepLabel: string;
  photos: StepPhoto[];
  store: StepStore;
  canEdit: boolean;
}

/** Whether this device reports a camera (build-sequence: the Camera button). */
function useHasCamera(): boolean {
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => {
        if (!cancelled) setHasCamera(devices.some((device) => device.kind === "videoinput"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return hasCamera;
}

/**
 * build-sequence: Step Photo Upload, Step Photo Storage, Photo Upload Failures, Step
 * Photo Gallery and Step Photo Deletion. Files go straight from the browser to Storage
 * under <build id>/<step key>/; the step then records the successful ones in order.
 */
export function StepPhotos({
  buildId,
  stepKey,
  stepLabel,
  photos,
  store,
  canEdit,
}: StepPhotosProps) {
  const t = useTranslations("sequence.photo");
  const toast = useToast();
  const hasCamera = useHasCamera();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    const bucket = supabase.storage.from(STEP_PHOTOS_BUCKET);
    const results = await Promise.all(
      files.map(async (file) => {
        const name = photoFileName(file);
        const path = stepPhotoPath(buildId, stepKey, name);
        const { error } = await bucket.upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        return error
          ? null
          : { path, photo: { url: bucket.getPublicUrl(path).data.publicUrl, name } };
      }),
    );
    const uploaded = results.filter((result) => result !== null);
    let failed = uploaded.length < files.length;
    if (uploaded.length > 0) {
      const saved = await store.change(
        stepKey,
        { op: "add_photos", photos: uploaded.map((result) => result.photo) },
        { silent: true },
      );
      if (!saved) {
        failed = true;
        await bucket.remove(uploaded.map((result) => result.path)).catch(() => {});
      }
    }
    setUploading(false);
    if (failed) toast.show({ type: "error", message: t("uploadFailed") });
  }

  async function remove(photo: StepPhoto) {
    const path = stepPhotoPath(buildId, stepKey, photo.name);
    const { data, error } = await createClient().storage.from(STEP_PHOTOS_BUCKET).remove([path]);
    let gone = !error && (data ?? []).some((object) => object.name === path);
    if (!gone && !error) {
      // Storage answers a refused delete and a missing file alike; a file that is
      // already gone (for example after a failed import) can still be detached.
      const check = await fetch(photo.url, { method: "HEAD", cache: "no-store" }).catch(() => null);
      gone = check !== null && check.status >= 400 && check.status < 500;
    }
    if (!gone) {
      toast.show({ type: "error", message: t("deleteFailed") });
      return;
    }
    await store.change(stepKey, { op: "remove_photo", name: photo.name });
  }

  const shown = viewing === null ? undefined : photos[viewing];

  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<ImagePlus className="size-4" />}
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? t("uploading") : t("add")}
          </Button>
          {hasCamera ? (
            <Button
              variant="secondary"
              icon={<Camera className="size-4" />}
              onClick={() => cameraInput.current?.click()}
              disabled={uploading}
            >
              {t("camera")}
            </Button>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            data-testid="photo-input"
            onChange={upload}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            data-testid="camera-input"
            onChange={upload}
          />
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="text-sm text-fg-dim">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.name} className="relative aspect-square">
              <button
                type="button"
                onClick={() => setViewing(index)}
                aria-label={t("open", { index: index + 1 })}
                className="block size-full overflow-hidden rounded-lg border border-line bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {/* biome-ignore lint/performance/noImgElement: user photos from public storage */}
                <img
                  src={photo.url}
                  alt={t("alt", { index: index + 1, label: stepLabel })}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  aria-label={t("delete", { index: index + 1 })}
                  className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full border border-line bg-panel text-fg shadow-panel hover:bg-danger hover:text-on-danger focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {shown ? (
        <Lightbox
          open
          onOpenChange={(open) => !open && setViewing(null)}
          src={shown.url}
          alt={t("alt", { index: (viewing ?? 0) + 1, label: stepLabel })}
          closeLabel={t("closeViewer")}
        />
      ) : null}
    </div>
  );
}
