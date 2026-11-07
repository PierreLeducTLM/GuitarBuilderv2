import { TraceMark } from "@gb/ui";
import { getTranslations } from "next-intl/server";

// build-story-sharing: Public Story Route, "Loading build story...".
export default async function StoryLoading() {
  const t = await getTranslations("story");
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-ground"
    >
      <TraceMark size={56} animated />
      <p className="font-mono text-sm tracking-wider text-fg-dim">{t("loading")}</p>
    </div>
  );
}
