"use client";

import type { StepPhoto } from "@gb/db";
import { IconButton, Lightbox } from "@gb/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export interface StoryPhotosProps {
  photos: StepPhoto[];
  /** The step's translated name, for the photos' descriptions. */
  stepLabel: string;
}

/**
 * A story step's photos as thumbnails, each opening full size (build-story-sharing: Story
 * Step Card, Story Photo Lightbox). With several photos, previous and next go round the
 * step's photos and a counter shows the position.
 */
export function StoryPhotos({ photos, stepLabel }: StoryPhotosProps) {
  const t = useTranslations("sequence.photo");
  const tStory = useTranslations("story");
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = viewing === null ? undefined : photos[viewing];
  const position = (viewing ?? 0) + 1;
  const count = photos.length;
  const step = (offset: number) => setViewing((index) => ((index ?? 0) + offset + count) % count);
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.name} className="aspect-square">
            <button
              type="button"
              onClick={() => setViewing(index)}
              aria-label={t("open", { index: index + 1 })}
              className="block size-full cursor-zoom-in overflow-hidden rounded-lg border border-line bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {/* biome-ignore lint/performance/noImgElement: user photos from public storage */}
              <img
                src={photo.url}
                alt={t("alt", { index: index + 1, label: stepLabel })}
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {shown ? (
        <Lightbox
          open
          onOpenChange={(open) => !open && setViewing(null)}
          src={shown.url}
          alt={t("alt", { index: position, label: stepLabel })}
          closeLabel={t("closeViewer")}
        >
          {count > 1 ? (
            <>
              <IconButton
                label={tStory("previousPhoto")}
                variant="secondary"
                onClick={() => step(-1)}
                className="absolute top-1/2 left-3 -translate-y-1/2"
              >
                <ChevronLeft className="size-5" />
              </IconButton>
              <IconButton
                label={tStory("nextPhoto")}
                variant="secondary"
                onClick={() => step(1)}
                className="absolute top-1/2 right-3 -translate-y-1/2"
              >
                <ChevronRight className="size-5" />
              </IconButton>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-panel px-3 py-1 font-mono text-sm text-fg">
                {tStory("photoPosition", { index: position, count })}
              </span>
            </>
          ) : null}
        </Lightbox>
      ) : null}
    </>
  );
}
