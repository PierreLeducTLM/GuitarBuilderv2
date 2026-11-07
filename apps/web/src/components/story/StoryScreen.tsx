"use client";

import type { Story } from "@/lib/story/story";
import { StoryUpdates } from "./StoryUpdates";
import { StoryView } from "./StoryView";
import { useStory } from "./useStory";

export interface StoryScreenProps {
  token: string;
  initial: Story;
}

/** The public story page in the browser: the story, kept up to date, and its updates switch. */
export function StoryScreen({ token, initial }: StoryScreenProps) {
  const { story } = useStory(token, initial);
  return (
    <StoryView story={story} headerAction={<StoryUpdates token={token} onChange={() => {}} />} />
  );
}
