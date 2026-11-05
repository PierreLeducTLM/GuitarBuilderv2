import { useTranslations } from "next-intl";

export default function WoodPropertiesLoading() {
  const t = useTranslations("wood");
  return (
    <p role="status" className="py-12 text-center text-fg-dim">
      {t("loading")}
    </p>
  );
}
