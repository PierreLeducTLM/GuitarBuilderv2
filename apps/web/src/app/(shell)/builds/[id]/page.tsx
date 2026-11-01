import { getTranslations } from "next-intl/server";
import { SectionPlaceholder } from "@/components/shell/SectionPlaceholder";

export default async function BuildDetailPage({ params }: PageProps<"/builds/[id]">) {
  const [{ id }, t] = await Promise.all([params, getTranslations("sections")]);
  return (
    <SectionPlaceholder id="builds">
      <p className="flex flex-wrap items-baseline gap-2 text-fg-dim">
        <span>{t("buildId")}</span>
        <span className="font-mono text-fg">{id}</span>
      </p>
    </SectionPlaceholder>
  );
}
