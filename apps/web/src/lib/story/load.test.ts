// build-story-sharing: Story Not Found, Anonymous Story Access.
import { describe, expect, it, vi } from "vitest";
import { requestStory } from "./load";

const TOKEN = "dddddddd-0000-4000-8000-00000000000d";
const STORY = {
  name: "OM #3",
  guitarType: "classical",
  boboNeck: false,
  createdAt: "2025-12-06T15:30:00+00:00",
  steps: [],
};

const answering = (answer: { data: unknown; error: unknown }) =>
  vi.fn((_token: string) => Promise.resolve(answer));

describe("requestStory", () => {
  it("opens the story of a valid token", async () => {
    const fetchStory = answering({ data: STORY, error: null });
    expect(await requestStory(TOKEN, fetchStory)).toEqual({
      kind: "story",
      story: {
        name: "OM #3",
        variant: { guitarType: "classical", boboNeck: false },
        createdAt: STORY.createdAt,
        states: {},
      },
    });
    expect(fetchStory).toHaveBeenCalledWith(TOKEN);
  });

  it("does not ask the server about a malformed token", async () => {
    const fetchStory = answering({ data: STORY, error: null });
    expect(await requestStory("abc", fetchStory)).toEqual({ kind: "notFound" });
    expect(await requestStory(`${TOKEN}x`, fetchStory)).toEqual({ kind: "notFound" });
    expect(fetchStory).not.toHaveBeenCalled();
  });

  it("finds no story when the token opens nothing", async () => {
    expect(await requestStory(TOKEN, answering({ data: null, error: null }))).toEqual({
      kind: "notFound",
    });
  });

  it("reports other failures as a loading error", async () => {
    expect(await requestStory(TOKEN, answering({ data: null, error: { code: "500" } }))).toEqual({
      kind: "error",
    });
    expect(await requestStory(TOKEN, answering({ data: { name: 3 }, error: null }))).toEqual({
      kind: "error",
    });
    expect(await requestStory(TOKEN, () => Promise.reject(new Error("offline")))).toEqual({
      kind: "error",
    });
  });
});
