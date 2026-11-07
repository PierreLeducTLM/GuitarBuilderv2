// Loading a story by its token, on the server for the first render and in the browser for
// live refreshes (build-story-sharing: Public Story Route, Story Not Found).
import { isUuid } from "@/lib/builds/validation";
import { parseStory, type Story } from "./story";

export type StoryLoad = { kind: "story"; story: Story } | { kind: "notFound" } | { kind: "error" };

/** Calls get_build_story with a token; resolves with the function's answer. */
export type FetchStory = (token: string) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * The story a token opens. A malformed token is not found without asking the server, a
 * token that opens nothing is not found, and every other failure is a loading error.
 */
export async function requestStory(token: string, fetchStory: FetchStory): Promise<StoryLoad> {
  if (!isUuid(token)) return { kind: "notFound" };
  try {
    const { data, error } = await fetchStory(token);
    if (error) return { kind: "error" };
    if (data === null) return { kind: "notFound" };
    const story = parseStory(data);
    return story ? { kind: "story", story } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
