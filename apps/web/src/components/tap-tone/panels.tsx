"use client";

import type { TakePeak } from "@gb/dsp";
import { Button } from "@gb/ui";
import { useFormatter, useTranslations } from "next-intl";
import { ROLE_NAMES, type RoleName, type RoleView } from "@/lib/tap-tone/machine";

export type DecayReason =
  | "noRecording"
  | "MODE_NOT_ISOLATED"
  | "NO_QUIET_REFERENCE"
  | "NOT_ENOUGH_DECAY"
  | "DECAY_CUT_OFF"
  | "NO_DECAY"
  | "NOT_EXPONENTIAL"
  | "TOO_FEW_VALID_TAPS"
  | "TAPS_INCONSISTENT";

export type DecayQView =
  | { value: number; reason?: undefined }
  | { value: null; reason: DecayReason };

const VISIBLE_PEAKS = 5;

/** tap-tone-capture: Selected Frequency Display. */
export function DetectedFrequency({
  peak,
  decayQ,
  current,
}: {
  peak: TakePeak | undefined;
  decayQ: DecayQView | "pending";
  current?: number;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const none = t("detected.none");
  const spectral = peak?.spectralQ ? format.number(Math.round(peak.spectralQ.q)) : none;
  const decay =
    decayQ === "pending"
      ? t("detected.pending")
      : decayQ.value === null
        ? none
        : format.number(Math.round(decayQ.value));
  return (
    <div className="flex flex-col gap-3">
      <section
        aria-label={t("detected.heading")}
        className="flex flex-col gap-1 rounded-xl border border-line bg-panel p-3"
      >
        <h3 className="text-sm font-semibold text-fg-dim">{t("detected.heading")}</h3>
        <p className="font-mono text-2xl font-bold text-amber-ink">
          {peak ? format.number(peak.frequency, "decimal1") : none}{" "}
          <span className="text-base">Hz</span>
        </p>
        {peak ? (
          <p className="font-mono text-sm text-fg-dim">
            {t("detected.level")}{" "}
            {t("detected.db", { level: format.number(peak.level, "decimal1") })} · {peak.note}
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-fg-dim">{t("detected.spectralQ")}</dt>
          <dd className="font-mono font-bold text-fg">{peak ? spectral : none}</dd>
          <dt className="text-fg-dim">{t("detected.decayQ")}</dt>
          <dd className="font-mono font-bold text-fg">{peak ? decay : none}</dd>
        </dl>
        {peak && !peak.spectralQ ? (
          <p className="text-xs text-fg-dim">{t("qReasons.spectral")}</p>
        ) : null}
        {peak && decayQ !== "pending" && decayQ.value === null ? (
          <p className="text-xs text-fg-dim">{t(`qReasons.${decayQ.reason}`)}</p>
        ) : null}
      </section>
      {typeof current === "number" ? (
        <section
          aria-label={t("detected.current")}
          className="flex flex-col gap-1 rounded-xl border border-line bg-panel p-3"
        >
          <h3 className="text-sm font-semibold text-fg-dim">{t("detected.current")}</h3>
          <p className="font-mono text-lg font-bold text-fg">
            {t("detected.hz", { frequency: format.number(current, "decimal2") })}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** tap-tone-capture: Detected Peaks List. */
export function DetectedPeaks({
  peaks,
  selected,
  onSelect,
}: {
  peaks: readonly TakePeak[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations("tapTone.peaks");
  const format = useFormatter();
  if (peaks.length <= 1) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-fg-dim">{t("heading")}</h3>
      <div className="flex flex-wrap gap-2">
        {peaks.slice(0, VISIBLE_PEAKS).map((peak, i) => {
          const frequency = format.number(peak.frequency, "decimal1");
          return (
            <Button
              key={peak.frequency}
              variant={i === selected ? "primary" : "secondary"}
              aria-pressed={i === selected}
              onClick={() => onSelect(i)}
              className="font-mono"
            >
              {i === 0 ? t("highest", { frequency }) : t("item", { frequency })}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/** tap-tone-capture: Manual Role Assignment (the keyboard and touch path). */
export function RolesPanel({
  roles,
  moving,
  onMove,
  onClear,
}: {
  roles: Record<RoleName, RoleView | null>;
  moving: RoleName | null;
  onMove: (role: RoleName) => void;
  onClear: (role: RoleName) => void;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3">
      <h3 className="text-sm font-semibold text-fg-dim">{t("rolesPanel.heading")}</h3>
      <ul className="flex flex-col gap-1.5">
        {ROLE_NAMES.map((name) => {
          const role = roles[name];
          const label = t(`roles.${name}`);
          return (
            <li key={name} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-12 font-semibold text-teal-ink">{label}</span>
              <span className="font-mono text-fg">
                {role
                  ? t("rolesPanel.value", { frequency: format.number(role.frequency, "decimal1") })
                  : t("rolesPanel.notIdentified")}
              </span>
              {role?.origin === "user" ? (
                <span className="text-xs text-fg-dim">{t("rolesPanel.setByYou")}</span>
              ) : null}
              <span className="ml-auto flex gap-1">
                <Button variant="ghost" aria-pressed={moving === name} onClick={() => onMove(name)}>
                  {t("rolesPanel.move", { role: label })}
                </Button>
                {role ? (
                  <Button variant="ghost" onClick={() => onClear(name)}>
                    {t("rolesPanel.clear", { role: label })}
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <p role="status" className="text-xs text-amber-ink">
        {moving ? t("rolesPanel.moving", { role: t(`roles.${moving}`) }) : ""}
      </p>
    </section>
  );
}
