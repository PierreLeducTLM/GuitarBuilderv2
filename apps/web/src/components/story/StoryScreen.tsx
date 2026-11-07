"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { displayGraph } from "@/lib/sequence/variant";
import { type Story, storyTimeline } from "@/lib/story/story";
import { shouldNotify } from "@/lib/story/updates";
import { registerStoryWorker } from "@/lib/story/worker";
import { StoryUpdates } from "./StoryUpdates";
import { StoryView } from "./StoryView";
import { useStory } from "./useStory";
import { useStorySignals } from "./useStorySignals";

export interface StoryScreenProps {
  token: string;
  initial: Story;
}

/** Number of steps in a story's timeline. */
const timelineLength = (story: Story) =>
  storyTimeline(displayGraph(story.variant), story.states).length;

/** What the page needs from the story worker's registration. */
type NotificationRegistration = Pick<ServiceWorkerRegistration, "showNotification">;

/**
 * The public story page in the browser (build-story-sharing: Live Story Updates, Story
 * Update Notifications). While updates are on, each change to the build refreshes the
 * story; a refresh that adds timeline steps shows a notification, and clicking one
 * brings the latest step into view.
 */
export function StoryScreen({ token, initial }: StoryScreenProps) {
  const t = useTranslations("story.updates.notification");
  const { story, refresh } = useStory(token, initial);
  const [updatesOn, setUpdatesOn] = useState(false);
  const worker = useRef<NotificationRegistration | null>(null);
  const shownSteps = useRef(timelineLength(initial));

  useEffect(() => {
    if (!updatesOn) return;
    registerStoryWorker(navigator.serviceWorker).then((registration) => {
      worker.current = registration;
    });
  }, [updatesOn]);

  useEffect(() => {
    const container = navigator.serviceWorker;
    if (!container) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "story-notification-click") return;
      document.querySelector("[data-latest-step]")?.scrollIntoView({ behavior: "smooth" });
    };
    container.addEventListener("message", onMessage);
    return () => container.removeEventListener("message", onMessage);
  }, []);

  useStorySignals(token, updatesOn, async () => {
    const load = await refresh();
    if (load.kind !== "story") return;
    const previous = shownSteps.current;
    shownSteps.current = timelineLength(load.story);
    if (!shouldNotify(previous, shownSteps.current)) return;
    void worker.current?.showNotification(t("title", { name: load.story.name }), {
      body: t("body"),
      tag: `story-${token}`,
      data: { url: window.location.href },
    });
  });

  return (
    <StoryView
      story={story}
      headerAction={<StoryUpdates token={token} onChange={setUpdatesOn} />}
    />
  );
}
