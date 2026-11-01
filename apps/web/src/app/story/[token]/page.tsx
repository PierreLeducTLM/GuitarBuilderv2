import { Panel, TraceMark } from "@gb/ui";
import { getTranslations } from "next-intl/server";

// app-shell: Public Build Story Route. Served to anyone, without the shell. Its
// content and access rules belong to build-story-sharing; this is the placeholder.
export default async function StoryPage({ params }: PageProps<"/story/[token]">) {
  const [{ token }, t] = await Promise.all([params, getTranslations()]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <TraceMark size={40} />
        <span className="text-lg font-semibold tracking-tight text-fg">{t("app.title")}</span>
      </header>
      <h1 className="text-4xl font-semibold tracking-tight text-fg">{t("story.title")}</h1>
      <Panel className="flex flex-col gap-2">
        <p className="text-fg-dim">{t("story.placeholder")}</p>
        <p className="flex flex-wrap items-baseline gap-2 text-sm text-fg-dim">
          <span>{t("story.shareLink")}</span>
          <span className="font-mono text-fg">{token}</span>
        </p>
      </Panel>
    </main>
  );
}
