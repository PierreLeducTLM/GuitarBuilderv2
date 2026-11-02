import { useTranslations } from "next-intl";

export default function BuildsLoading() {
  const t = useTranslations("builds");
  return (
    <p role="status" className="py-12 text-center text-fg-dim">
      {t("loading")}
    </p>
  );
}
