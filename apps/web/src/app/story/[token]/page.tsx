import { StoryNotFound } from "@/components/story/StoryNotFound";
import { requestStory } from "@/lib/story/load";
import { createClient } from "@/lib/supabase/server";

// build-story-sharing: Public Story Route. Served to anyone, signed in or not, without the
// shell; the token alone opens the story.
export default async function StoryPage({ params }: PageProps<"/story/[token]">) {
  const { token } = await params;
  const load = await requestStory(token, async (value) =>
    (await createClient()).rpc("get_build_story", { p_token: value }),
  );
  if (load.kind !== "story") return <StoryNotFound reason={load.kind} />;
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-4xl font-semibold tracking-tight text-fg">{load.story.name}</h1>
    </main>
  );
}
