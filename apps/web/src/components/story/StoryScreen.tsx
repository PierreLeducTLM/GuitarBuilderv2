"use client";

import type { Story } from "@/lib/story/story";
import { StoryView } from "./StoryView";
import { useStory } from "./useStory";

export interface StoryScreenProps {
  token: string;
  initial: Story;
}

/** The public story page in the browser: the story, kept up to date. */
export function StoryScreen({ token, initial }: StoryScreenProps) {
  const { story } = useStory(token, initial);
  return <StoryView story={story} />;
}
