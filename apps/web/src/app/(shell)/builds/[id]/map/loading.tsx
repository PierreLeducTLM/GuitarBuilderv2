import { useTranslations } from "next-intl";

/** build-sequence: Sequence Diagram Display, "Loading map..." while the view loads. */
export default function BuildMapLoading() {
  const t = useTranslations("sequence.map");
  return (
    <p role="status" className="py-12 text-center text-fg-dim">
      {t("loading")}
    </p>
  );
}
