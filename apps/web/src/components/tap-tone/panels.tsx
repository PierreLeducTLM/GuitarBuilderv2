"use client";

import { noteLabel, type TakePeak } from "@gb/dsp";
import { Button, cx } from "@gb/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PLATE_TAKES, type PlateTake, ROLE_NAMES, type RoleName } from "@/lib/tap-tone/machine";

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

export type BodyModeView = {
  readonly frequency: number;
  readonly spectralQ: number | null;
  readonly decayQ: DecayQView | "pending";
  readonly origin: "auto" | "user";
};

const VISIBLE_PEAKS = 5;

/** Colour slots shared by both modes: Air and Longitudinal, Top and Cross-grain, Back and Diagonal. */
const SLOT_COLOUR = [
  { ink: "text-mode1", dot: "bg-mode1", chosen: "border-mode1 bg-mode1-soft" },
  { ink: "text-mode2", dot: "bg-mode2", chosen: "border-mode2 bg-mode2-soft" },
  { ink: "text-mode3", dot: "bg-mode3", chosen: "border-mode3 bg-mode3-soft" },
] as const;

export const TAKE_SYMBOL: Record<PlateTake, string> = {
  longitudinal: "L",
  crossGrain: "C",
  diagonal: "LC",
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

/** One measured mode: a body mode in Instrument mode, a take in Plate mode. */
function ModeTile({
  slot,
  name,
  symbol,
  frequency,
  pressed,
  disabled = false,
  missing,
  onClick,
  children,
}: {
  slot: 0 | 1 | 2;
  name: string;
  symbol: ReactNode;
  frequency: number | null;
  pressed: boolean;
  disabled?: boolean;
  missing?: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const colour = SLOT_COLOUR[slot];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex min-h-24 min-w-0 flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        pressed
          ? colour.chosen
          : frequency !== null
            ? "border-line bg-panel enabled:hover:bg-raised"
            : "border-dashed border-line-strong enabled:hover:bg-raised",
      )}
    >
      <span
        className={cx(
          "max-w-full text-sm font-semibold leading-tight hyphens-auto break-words",
          colour.ink,
        )}
      >
        {name}
      </span>
      <span className="flex items-center gap-1.5 font-mono text-2xs text-fg-faint">
        <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", colour.dot)} />
        {symbol}
      </span>
      {frequency !== null ? (
        <>
          <span className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold leading-tight tracking-tight text-fg">
              {format.number(frequency, "decimal1")}
            </span>
            <span className="text-xs text-fg-dim">Hz</span>
          </span>
          <span className="font-mono text-xs text-fg-dim">{noteLabel(frequency)}</span>
          {children}
        </>
      ) : (
        <>
          <span className="mt-0.5 font-mono text-xl font-bold leading-tight text-fg-faint">
            {t("detected.none")}
          </span>
          {missing ? <span className="text-xs text-fg-dim">{missing}</span> : null}
        </>
      )}
    </button>
  );
}

/** tap-tone-capture: Plate Mode Takes, the take selector. */
export function PlateTakes({
  selected,
  active,
  recording,
  onSwitch,
}: {
  selected: Partial<Record<PlateTake, TakePeak>>;
  active: PlateTake;
  recording: boolean;
  onSwitch: (take: PlateTake) => void;
}) {
  const t = useTranslations("tapTone.takes");
  return (
    <fieldset className="grid grid-cols-3 gap-2">
      <legend className="sr-only">{t("label")}</legend>
      {PLATE_TAKES.map((take, i) => (
        <ModeTile
          key={take}
          slot={i === 0 ? 0 : i === 1 ? 1 : 2}
          name={t(`name.${take}`)}
          symbol={
            <>
              f<sub>{TAKE_SYMBOL[take]}</sub>
            </>
          }
          frequency={selected[take]?.frequency ?? null}
          pressed={active === take}
          disabled={recording && active !== take}
          onClick={() => onSwitch(take)}
        />
      ))}
    </fieldset>
  );
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
  const qParts = useQParts();
  const chosen = focused ? modes[focused] : null;
  const chosenName = focused ? t(`roles.${focused}`) : "";
  return (
    <section aria-label={t("bodyModes.heading")} className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {ROLE_NAMES.map((name, i) => {
          const mode = modes[name];
          return (
            <ModeTile
              key={name}
              slot={i === 0 ? 0 : i === 1 ? 1 : 2}
              name={t(`roles.${name}`)}
              symbol={t(`bodyModes.number.${name}`)}
              frequency={mode?.frequency ?? null}
              pressed={focused === name}
              missing={t("bodyModes.notIdentified")}
              onClick={() => onFocus(name)}
            >
              {mode ? (
                <>
                  <span className="font-mono text-2xs text-fg-dim">
                    {qParts(mode.spectralQ, mode.decayQ).map((part, j) => (
                      <span key={part}>
                        {j > 0 ? " · " : null}
                        <span className="whitespace-nowrap">{part}</span>
                      </span>
                    ))}
                  </span>
                  {mode.origin === "user" ? (
                    <span className="text-2xs text-fg-dim">{t("bodyModes.setByYou")}</span>
                  ) : null}
                </>
              ) : null}
            </ModeTile>
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

export type FrequencyContext =
  | { mode: "instrument"; sameAs: RoleName | null }
  | { mode: "plate"; take: PlateTake; current?: number };

/** tap-tone-capture: Selected Frequency Display and Detected Peaks List. */
export function MainFrequency({
  peak,
  decayQ,
  context,
  peaks,
  selected,
  onSelect,
}: {
  peak: TakePeak | undefined;
  decayQ: DecayQView | "pending";
  context: FrequencyContext;
  peaks: readonly TakePeak[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const qParts = useQParts();
  const heading = context.mode === "plate" ? t(`takes.${context.take}`) : t("main.heading");
  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{heading}</h3>
        <p className="font-mono text-lg font-bold text-fg">
          {peak ? format.number(peak.frequency, "decimal1") : t("detected.none")}{" "}
          <span className="text-xs font-normal text-fg-dim">Hz</span>
        </p>
      </div>
      {context.mode === "instrument" && context.sameAs ? (
        <p className="text-sm text-fg-dim">
          {t("main.sameAs", { role: t(`roles.${context.sameAs}`) })}
        </p>
      ) : null}
      {context.mode === "plate" && context.current !== undefined ? (
        <p className="text-sm text-fg-dim">
          {t("main.current", { frequency: format.number(context.current, "decimal2") })}
        </p>
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
