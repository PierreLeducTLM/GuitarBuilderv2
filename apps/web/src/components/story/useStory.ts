"use client";

import { useCallback, useState } from "react";
import { requestStory, type StoryLoad } from "@/lib/story/load";
import type { Story } from "@/lib/story/story";
import { createClient } from "@/lib/supabase/client";

/**
 * A story kept up to date from the server (build-story-sharing: Live Story Updates).
 * A refresh that finds no story any more leaves null, for Story Not Found; a failed
 * refresh keeps what is shown.
 */
export function useStory(token: string, initial: Story) {
  const [story, setStory] = useState<Story | null>(initial);
  const refresh = useCallback(async (): Promise<StoryLoad> => {
    const load = await requestStory(token, (value) =>
      createClient().rpc("get_build_story", { p_token: value }),
    );
    if (load.kind === "story") setStory(load.story);
    if (load.kind === "notFound") setStory(null);
    return load;
  }, [token]);
  return { story, refresh };
}
