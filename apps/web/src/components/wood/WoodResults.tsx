"use client";

import type { WoodProperties } from "@gb/dsp";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { formatValue } from "@/lib/wood/calculator";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <dl className="flex flex-col">{children}</dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-sm text-fg-dim">{label}</dt>
      <dd className="font-mono font-bold text-fg">{children}</dd>
    </div>
  );
}

/** wood-panel-properties: Results Display and Results Hidden While Invalid. */
export function WoodResults({
  properties,
  children,
}: {
  properties: WoodProperties | null;
  children?: ReactNode;
}) {
  const t = useTranslations("wood.results");
  const locale = useLocale();
  if (!properties) {
    return <p className="rounded-xl bg-inset p-4 text-fg-dim">{t("fixInputs")}</p>;
  }
  const value = (number: number, decimals: number) => formatValue(number, decimals, locale);
  return (
    <div className="flex flex-col gap-5">
      <Group title={t("density")}>
        <Row label={t("woodDensity")}>{value(properties.density, 1)} kg/m³</Row>
      </Group>
      <Group title={t("elastic")}>
        <Row label={t("eLong")}>E_L = {value(properties.eLong, 2)} GPa</Row>
        <Row label={t("eCross")}>E_C = {value(properties.eCross, 2)} GPa</Row>
        <Row label={t("shear")}>G_LC = {value(properties.gLc, 2)} GPa</Row>
      </Group>
      <Group title={t("target")}>
        <div className="mb-1 rounded-xl border border-amber-ink bg-inset p-4">
          <dt className="text-sm text-fg-dim">{t("thickness")}</dt>
          <dd className="font-mono text-4xl font-bold text-amber-ink">
            {value(properties.targetThickness, 2)} mm
          </dd>
        </div>
        <Row label={t("mass")}>{value(properties.estimatedMass, 1)} g</Row>
      </Group>
      {children}
    </div>
  );
}
