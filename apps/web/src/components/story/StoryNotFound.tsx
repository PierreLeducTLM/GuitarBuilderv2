import { TraceMark } from "@gb/ui";
import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

export interface StoryNotFoundProps {
  /** `notFound`: no story behind the link; `error`: the story could not be loaded. */
  reason: "notFound" | "error";
}

/** build-story-sharing: Story Not Found. Public, so it offers no way into the app. */
export function StoryNotFound({ reason }: StoryNotFoundProps) {
  const t = useTranslations("story.notFound");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-4 py-10 text-center">
      <TraceMark size={48} />
      <SearchX aria-hidden="true" className="size-8 text-fg-dim" />
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("title")}</h1>
      <p className="text-fg">{t(reason === "error" ? "error" : "message")}</p>
      <p className="text-sm text-fg-dim">{t("hint")}</p>
    </main>
  );
}
