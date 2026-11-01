import { TraceMark } from "@gb/ui";
import { useTranslations } from "next-intl";

/** Full-screen indicator shown while the session is being restored. */
export function LoadingScreen() {
  const t = useTranslations("app");
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-ground"
    >
      <TraceMark size={56} animated />
      <p className="font-mono text-sm tracking-wider text-fg-dim">{t("loading")}</p>
    </div>
  );
}
