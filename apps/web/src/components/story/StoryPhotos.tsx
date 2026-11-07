import type { StepPhoto } from "@gb/db";
import { useTranslations } from "next-intl";

export interface StoryPhotosProps {
  photos: StepPhoto[];
  /** The step's translated name, for the photos' descriptions. */
  stepLabel: string;
}

/** A story step's photos as thumbnails (build-story-sharing: Story Step Card). */
export function StoryPhotos({ photos, stepLabel }: StoryPhotosProps) {
  const t = useTranslations("sequence.photo");
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo, index) => (
        // biome-ignore lint/performance/noImgElement: user photos from public storage, shown at their own size
        <img
          key={photo.name}
          src={photo.url}
          alt={t("alt", { index: index + 1, label: stepLabel })}
          loading="lazy"
          className="aspect-square w-full rounded-lg border border-line object-cover"
        />
      ))}
    </div>
  );
}
