import { useTranslations } from "next-intl";

export default function BuildLoading() {
  const t = useTranslations("builds.detail");
  return (
    <p role="status" className="py-12 text-center text-fg-dim">
      {t("loading")}
    </p>
  );
}
