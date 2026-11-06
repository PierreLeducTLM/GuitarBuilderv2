"use client";

import { noteLabel, type TakePeak } from "@gb/dsp";
import { Button, cx } from "@gb/ui";
import { useFormatter, useTranslations } from "next-intl";
import { ROLE_NAMES, type RoleName } from "@/lib/tap-tone/machine";

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

function PeakButtons({
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
  if (peaks.length <= 1) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-fg-dim">{t("heading")}</h3>
      <PeakButtons peaks={peaks} selected={selected} onSelect={onSelect} />
    </section>
  );
}

export type BodyModeView = {
  readonly frequency: number;
  readonly spectralQ: number | null;
  readonly decayQ: DecayQView | "pending";
  readonly origin: "auto" | "user";
};

const MODE_COLOUR: Record<RoleName, { ink: string; dot: string; chosen: string }> = {
  air: { ink: "text-mode1", dot: "bg-mode1", chosen: "border-mode1 bg-mode1-soft" },
  top: { ink: "text-mode2", dot: "bg-mode2", chosen: "border-mode2 bg-mode2-soft" },
  back: {
    ink: "text-mode3",
    dot: "bg-mode3",
    chosen: "border-mode3 bg-mode3-soft",
  },
};

function useQParts() {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const none = t("detected.none");
  return (spectralQ: number | null, decayQ: DecayQView | "pending") =>
    [
      t("bodyModes.spectralQ", {
        value: spectralQ === null ? none : format.number(Math.round(spectralQ)),
      }),
      t("bodyModes.decayQ", {
        value:
          decayQ === "pending"
            ? t("bodyModes.pending")
            : decayQ.value === null
              ? none
              : format.number(Math.round(decayQ.value)),
      }),
    ] as const;
}

/** tap-tone-capture: Body Mode Readouts, and the touch and keyboard path of Manual Role Assignment. */
export function BodyModes({
  modes,
  focused,
  moving,
  onFocus,
  onMove,
  onClear,
}: {
  modes: Record<RoleName, BodyModeView | null>;
  focused: RoleName | null;
  moving: boolean;
  onFocus: (role: RoleName) => void;
  onMove: () => void;
  onClear: (role: RoleName) => void;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const qParts = useQParts();
  const chosen = focused ? modes[focused] : null;
  const chosenName = focused ? t(`roles.${focused}`) : "";
  return (
    <section aria-label={t("bodyModes.heading")} className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {ROLE_NAMES.map((name) => {
          const mode = modes[name];
          const colour = MODE_COLOUR[name];
          return (
            <button
              key={name}
              type="button"
              aria-pressed={focused === name}
              onClick={() => onFocus(name)}
              className={cx(
                "flex min-h-28 min-w-0 flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-colors duration-150",
                focused === name
                  ? colour.chosen
                  : mode
                    ? "border-line bg-panel hover:bg-raised"
                    : "border-line-strong border-dashed hover:bg-raised",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cx("size-2 rounded-full", colour.dot)} />
                <span className={cx("text-sm font-semibold", colour.ink)}>
                  {t(`roles.${name}`)}
                </span>
              </span>
              <span className="font-mono text-2xs text-fg-faint">
                {t(`bodyModes.number.${name}`)}
              </span>
              {mode ? (
                <>
                  <span className="mt-0.5 flex items-baseline gap-1">
                    <span className="font-mono text-xl font-bold leading-tight tracking-tight text-fg">
                      {format.number(mode.frequency, "decimal1")}
                    </span>
                    <span className="text-xs text-fg-dim">Hz</span>
                  </span>
                  <span className="font-mono text-xs text-fg-dim">{noteLabel(mode.frequency)}</span>
                  <span className="font-mono text-2xs text-fg-dim">
                    {qParts(mode.spectralQ, mode.decayQ).map((part, i) => (
                      <span key={part}>
                        {i > 0 ? " · " : null}
                        <span className="whitespace-nowrap">{part}</span>
                      </span>
                    ))}
                  </span>
                  {mode.origin === "user" ? (
                    <span className="text-2xs text-fg-dim">{t("bodyModes.setByYou")}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="mt-0.5 font-mono text-xl font-bold leading-tight text-fg-faint">
                    {t("detected.none")}
                  </span>
                  <span className="text-xs text-fg-dim">{t("bodyModes.notIdentified")}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {focused ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel py-1.5 pr-1.5 pl-3">
          <p role="status" className="grow text-sm text-amber-ink">
            {moving ? t("bodyModes.moving", { role: chosenName }) : ""}
          </p>
          <Button variant="secondary" aria-pressed={moving} onClick={onMove}>
            {t(chosen ? "bodyModes.move" : "bodyModes.assign", { role: chosenName })}
          </Button>
          {chosen ? (
            <Button variant="ghost" onClick={() => onClear(focused)}>
              {t("bodyModes.clear", { role: chosenName })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** tap-tone-capture: Selected Frequency Display and Detected Peaks List, in Instrument mode. */
export function MainFrequency({
  peak,
  decayQ,
  sameAs,
  peaks,
  selected,
  onSelect,
}: {
  peak: TakePeak | undefined;
  decayQ: DecayQView | "pending";
  sameAs: RoleName | null;
  peaks: readonly TakePeak[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const qParts = useQParts();
  return (
    <section aria-label={t("main.heading")} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{t("main.heading")}</h3>
        <p className="font-mono text-lg font-bold text-fg">
          {peak ? format.number(peak.frequency, "decimal1") : t("detected.none")}{" "}
          <span className="text-xs font-normal text-fg-dim">Hz</span>
        </p>
      </div>
      {sameAs ? (
        <p className="text-sm text-fg-dim">{t("main.sameAs", { role: t(`roles.${sameAs}`) })}</p>
      ) : null}
      {peak ? (
        <p className="font-mono text-xs text-fg-dim">
          {t("main.detail", {
            level: format.number(peak.level, "decimal1"),
            note: peak.note,
            q: qParts(peak.spectralQ?.q ?? null, decayQ).join(" · "),
          })}
        </p>
      ) : null}
      {peak && !peak.spectralQ ? (
        <p className="text-xs text-fg-dim">{t("qReasons.spectral")}</p>
      ) : null}
      {peak && decayQ !== "pending" && decayQ.value === null ? (
        <p className="text-xs text-fg-dim">{t(`qReasons.${decayQ.reason}`)}</p>
      ) : null}
      <PeakButtons peaks={peaks} selected={selected} onSelect={onSelect} />
    </section>
  );
}
