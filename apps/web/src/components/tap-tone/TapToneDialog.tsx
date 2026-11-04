"use client";

import {
  type DecayTarget,
  type TakeCache,
  type TakeResult,
  type TapToneRecord,
  takeDecayQ,
  takeDecaySeries,
} from "@gb/dsp";
import { Button, DialogFrame, IconButton, SelectField, Tooltip } from "@gb/ui";
import { CircleHelp, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useReducer, useRef, useState } from "react";
import {
  canConfirm,
  createDialog,
  type DialogError,
  type DialogState,
  effectiveRoles,
  instrumentResult,
  PLATE_TAKES,
  type PlateTake,
  plateResults,
  type RoleName,
  reduce,
  selectedPeak,
  type TakeAudio,
} from "@/lib/tap-tone/machine";
import {
  type DecodedAudio,
  decodeAudio,
  downloadWav,
  isMobileDevice,
  isSupportedAudioFile,
  prepareAudio,
} from "./audio";
import { MAX_RECORDING_SECONDS, useAudioInputs, usePlayback, useRecorder } from "./hooks";
import { Oscilloscope } from "./Oscilloscope";
import { PeakInspector } from "./PeakInspector";
import { DetectedFrequency, DetectedPeaks, RolesPanel } from "./panels";
import { TapToneSpectrum } from "./TapToneSpectrum";
import { TapWaveform } from "./TapWaveform";
import { useDecayQ } from "./useDecayQ";
import { useTakeAnalysis } from "./useTakeAnalysis";

export type PlateConfirm = Partial<
  Record<
    PlateTake,
    { frequency: number; spectrum: TapToneRecord; spectralQ: number | null; decayQ: number | null }
  >
>;

export type InstrumentRoleResult = {
  frequency: number;
  level: number;
  spectralQ: number | null;
  decayQ: number | null;
  origin: "auto" | "user";
};

export type InstrumentConfirm = {
  frequency: number;
  spectrum: TapToneRecord;
  roles: Partial<Record<RoleName, InstrumentRoleResult>>;
};

type CommonProps = { open: boolean; label: string; onCancel: () => void };

export type TapToneDialogProps =
  | (CommonProps & {
      mode: "plate";
      currentValues?: Partial<Record<PlateTake, number>>;
      savedRecords?: Partial<Record<PlateTake, TapToneRecord>>;
      onConfirm: (result: PlateConfirm) => void;
    })
  | (CommonProps & { mode: "instrument"; onConfirm: (result: InstrumentConfirm) => void });

const SAME_PEAK_HZ = 0.5;

const targetFor = (result: TakeResult, frequency: number, level: number): DecayTarget =>
  result.peaks.find((peak) => Math.abs(peak.frequency - frequency) <= SAME_PEAK_HZ) ?? {
    frequency,
    level,
    spectralQ: null,
  };

const decayValue = (cache: TakeCache | null, result: TakeResult, target: DecayTarget) =>
  cache ? takeDecayQ(cache, result, target).q : null;

const initialState = (props: TapToneDialogProps): DialogState =>
  props.mode === "plate"
    ? createDialog({
        mode: "plate",
        ...(props.savedRecords ? { saved: props.savedRecords } : {}),
        ...(props.currentValues ? { current: props.currentValues } : {}),
      })
    : createDialog({ mode: "instrument" });

/** tap-tone-capture: the Frequency Detector dialog in Plate or Instrument mode. */
export function TapToneDialog(props: TapToneDialogProps) {
  const t = useTranslations("tapTone");
  const tDialog = useTranslations("dialog");
  const format = useFormatter();
  const uploadId = useId();
  const [state, dispatch] = useReducer(reduce, props, initialState);
  const latest = useRef(state);
  latest.current = state;
  const [moving, setMoving] = useState<RoleName | null>(null);
  const [chosenTap, setChosenTap] = useState<number | null>(null);
  const mobile = useMemo(
    () =>
      typeof window !== "undefined" &&
      isMobileDevice({ navigator, hasTouchEvents: "ontouchstart" in window }),
    [],
  );
  const { analyse } = useTakeAnalysis(dispatch);
  const inputs = useAudioInputs();
  const playback = usePlayback();

  const analyseAudio = async (
    load: () => Promise<DecodedAudio>,
    onLoadError: (error: unknown) => void,
  ) => {
    const run = latest.current.nextRun;
    dispatch({ type: "analysisStarted" });
    setChosenTap(null);
    const decoded = await load().catch((error: unknown) => {
      onLoadError(error);
      return null;
    });
    if (!decoded) return;
    const prepared = prepareAudio(decoded);
    analyse({ run, audio: prepared, mode: props.mode, mobile });
  };

  const recorder = useRecorder({
    deviceId: inputs.selected,
    onFinished: (recording) => {
      const run = latest.current.nextRun;
      void analyseAudio(
        async () => decodeAudio(await recording.arrayBuffer(), { mixToMono: false }),
        () => dispatch({ type: "analysisFailed", run }),
      );
    },
    onError: () => dispatch({ type: "failed", error: { key: "microphone" } }),
  });

  const take = state.takes[state.active];
  const results = take?.status === "results" ? take : null;
  const peak = selectedPeak(take);
  const roles = effectiveRoles(take);
  const audio: TakeAudio | null = results?.audio ?? null;
  const recording = take?.status === "recording";
  const currentValue =
    props.mode === "plate" && state.active !== "instrument"
      ? props.currentValues?.[state.active]
      : undefined;

  const decayTargets = useMemo(() => {
    if (!results) return [];
    const roleTargets =
      props.mode === "instrument"
        ? Object.values(roles).flatMap((role) =>
            role ? [targetFor(results.result, role.frequency, role.level)] : [],
          )
        : [];
    return peak ? [peak, ...roleTargets] : roleTargets;
  }, [results, peak, roles, props.mode]);
  const decayOf = useDecayQ(take, decayTargets);
  const usedTap = results?.result.used[0] ?? null;
  const inspectedTap =
    chosenTap !== null && results?.result.used.includes(chosenTap) ? chosenTap : usedTap;
  const series = useMemo(
    () =>
      results?.cache && peak && inspectedTap !== null
        ? takeDecaySeries(results.cache, results.result, peak, inspectedTap)
        : null,
    [results, peak, inspectedTap],
  );

  const errorText = (error: DialogError) =>
    error.key === "decode"
      ? t("errors.decode", { reason: error.reason })
      : t(`errors.${error.key}`);

  const cancel = () => {
    recorder.cancel();
    playback.stop();
    props.onCancel();
  };

  const confirm = () => {
    playback.stop();
    if (props.mode === "plate") {
      const chosen = plateResults(state);
      const result = Object.fromEntries(
        PLATE_TAKES.flatMap((key) => {
          const entry = chosen[key];
          const plateTake = state.takes[key];
          const target = selectedPeak(plateTake);
          if (!entry || !target || plateTake?.status !== "results") return [];
          return [
            [
              key,
              {
                frequency: entry.frequency,
                spectrum: entry.record,
                spectralQ: entry.spectralQ,
                decayQ: decayValue(plateTake.cache, plateTake.result, target),
              },
            ],
          ];
        }),
      );
      props.onConfirm(result);
      return;
    }
    const chosen = instrumentResult(state);
    if (!chosen || !results) return;
    const confirmed = Object.fromEntries(
      Object.entries(chosen.roles).flatMap(([name, role]) =>
        role
          ? [
              [
                name,
                {
                  ...role,
                  decayQ: decayValue(
                    results.cache,
                    results.result,
                    targetFor(results.result, role.frequency, role.level),
                  ),
                },
              ],
            ]
          : [],
      ),
    );
    props.onConfirm({ frequency: chosen.frequency, spectrum: chosen.record, roles: confirmed });
  };

  const choosePeak = (index: number) => {
    if (moving) {
      dispatch({ type: "roleAssigned", role: moving, index });
      setMoving(null);
      return;
    }
    dispatch({ type: "peakSelected", index });
  };

  const helpLines =
    props.mode === "instrument"
      ? ([
          "instrument1",
          "instrument2",
          "instrument3",
          "instrument4",
          "instrument5",
          "instrument6",
        ] as const)
      : (["plate1", "plate2", "plate3", "plate4"] as const);

  const roleFrequencies = Object.fromEntries(
    Object.entries(roles).flatMap(([name, role]) => (role ? [[name, role.frequency]] : [])),
  );

  return (
    <DialogFrame
      open={props.open}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      title={t("title")}
      description={props.label}
      closeLabel={tDialog("close")}
      size="xl"
      layer="top"
      dismissOnOutsideClick={false}
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={confirm} disabled={!canConfirm(state)}>
            {t("actions.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex items-start justify-between gap-3">
        {props.mode === "plate" ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t("takes.label")}</legend>
            {PLATE_TAKES.map((key) => {
              const chosen = selectedPeak(state.takes[key]);
              const name = t(`takes.${key}`);
              return (
                <Button
                  key={key}
                  variant={state.active === key ? "primary" : "secondary"}
                  aria-pressed={state.active === key}
                  disabled={recording && state.active !== key}
                  onClick={() => dispatch({ type: "takeSwitched", take: key })}
                  className="font-mono"
                >
                  {chosen
                    ? t("takes.value", {
                        take: name,
                        frequency: format.number(chosen.frequency, "decimal1"),
                      })
                    : t("takes.empty", { take: name })}
                </Button>
              );
            })}
          </fieldset>
        ) : (
          <span />
        )}
        <Tooltip
          content={
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{t("help.heading")}</p>
              <ul className="list-disc pl-4">
                {helpLines.map((line) => (
                  <li key={line}>{t(`help.${line}`)}</li>
                ))}
              </ul>
            </div>
          }
        >
          <IconButton label={t("help.label")} variant="ghost">
            <CircleHelp className="size-4" />
          </IconButton>
        </Tooltip>
      </div>
      {state.active !== "instrument" ? (
        <p className="text-sm text-fg-dim">{t(`guidance.${state.active}`)}</p>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-ink bg-danger-soft px-3 py-2 text-sm text-danger-ink"
        >
          {errorText(state.error)}
        </p>
      ) : null}

      {take?.status === "idle" ? (
        <div className="flex flex-col items-start gap-3">
          {inputs.inputs.length > 0 ? (
            <SelectField
              label={t("capture.inputDevice")}
              value={inputs.selected ?? ""}
              onChange={(event) => inputs.select(event.target.value)}
              fieldClassName="w-full max-w-sm"
            >
              {inputs.inputs.map((input, i) => (
                <option key={input.id} value={input.id}>
                  {input.label ?? t("capture.unnamedInput", { number: i + 1 })}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={async () => {
                dispatch({ type: "recordingStarted" });
                await recorder.start();
                await inputs.refresh();
              }}
            >
              {t("capture.start")}
            </Button>
            <span className="text-sm text-fg-dim">{t("capture.maxHint")}</span>
            <span className="text-sm text-fg-dim">{t("capture.or")}</span>
            <label
              htmlFor={uploadId}
              className="cursor-pointer rounded-xl border border-line-strong px-4 py-2.5 text-[0.9375rem] font-semibold text-fg hover:bg-raised"
            >
              {t("capture.upload")}
            </label>
            <input
              id={uploadId}
              type="file"
              accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (!isSupportedAudioFile(file)) {
                  dispatch({ type: "failed", error: { key: "unsupported" } });
                  return;
                }
                void analyseAudio(
                  async () => decodeAudio(await file.arrayBuffer(), { mixToMono: true }),
                  (error) =>
                    dispatch({
                      type: "failed",
                      error: {
                        key: "decode",
                        reason: error instanceof Error ? error.message : String(error),
                      },
                    }),
                );
              }}
            />
          </div>
        </div>
      ) : null}

      {recording ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="size-3 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            <span className="font-semibold text-fg">{t("capture.recording")}</span>
            <span className="font-mono text-fg-dim">
              {t("capture.elapsed", {
                elapsed: format.number(recorder.elapsed, "decimal1"),
                max: MAX_RECORDING_SECONDS,
              })}
            </span>
            <Button variant="danger" onClick={recorder.stop} className="ml-auto">
              {t("capture.stop")}
            </Button>
          </div>
          <Oscilloscope analyser={recorder.analyser} />
        </div>
      ) : null}

      {take?.status === "analyzing" ? (
        <p className="flex items-center gap-2 text-fg-dim">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {t("capture.analyzing")}
        </p>
      ) : null}

      {results ? (
        <div className="flex flex-col gap-4">
          {audio?.filtered[0] ? (
            <TapWaveform
              signal={audio.filtered[0]}
              sampleRate={audio.sampleRate}
              taps={results.result.taps}
              excluded={results.excluded}
              onToggle={(number) => dispatch({ type: "tapToggled", number })}
            />
          ) : null}
          {results.result.points.length === 0 ? (
            <p className="rounded-xl border border-line bg-inset p-4 text-sm text-fg-dim">
              {t("taps.noneUsable")}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-fg">
                  {t("spectrum.caption")}{" "}
                  <span className="font-normal text-fg-dim">{t("spectrum.hint")}</span>
                </p>
                <TapToneSpectrum
                  points={results.result.points}
                  peaks={results.result.peaks}
                  selected={results.selected}
                  onSelect={choosePeak}
                  {...(props.mode === "instrument"
                    ? {
                        roles: roleFrequencies,
                        onAssignRole: (role: RoleName, index: number) =>
                          dispatch({ type: "roleAssigned", role, index }),
                      }
                    : {})}
                />
              </div>
              <div className="flex flex-col gap-3">
                <DetectedFrequency
                  peak={peak}
                  decayQ={peak ? decayOf(peak).view : "pending"}
                  {...(currentValue === undefined ? {} : { current: currentValue })}
                />
                {props.mode === "instrument" ? (
                  <RolesPanel
                    roles={roles}
                    moving={moving}
                    onMove={(role) => setMoving((current) => (current === role ? null : role))}
                    onClear={(role) => dispatch({ type: "roleCleared", role })}
                  />
                ) : null}
              </div>
            </div>
          )}
          <DetectedPeaks
            peaks={results.result.peaks}
            selected={results.selected}
            onSelect={choosePeak}
          />
          {peak && results.cache ? (
            <PeakInspector
              frequency={peak.frequency}
              decay={decayOf(peak).decay ?? "pending"}
              series={series}
              taps={results.result.taps}
              chosenTap={inspectedTap}
              onChooseTap={setChosenTap}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {audio ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (playback.playing) {
                      playback.stop();
                      return;
                    }
                    try {
                      playback.play({ channels: audio.filtered, sampleRate: audio.sampleRate });
                    } catch {
                      dispatch({ type: "errorShown", error: { key: "playback" } });
                    }
                  }}
                >
                  {playback.playing ? t("actions.stopPlayback") : t("actions.play")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    try {
                      downloadWav(
                        { channels: audio.filtered, sampleRate: audio.sampleRate },
                        new Date(),
                      );
                    } catch {
                      dispatch({ type: "errorShown", error: { key: "export" } });
                    }
                  }}
                >
                  {t("actions.download")}
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                playback.stop();
                setMoving(null);
                dispatch({ type: "reRecorded" });
              }}
            >
              {t("actions.rerecord")}
            </Button>
          </div>
        </div>
      ) : null}
    </DialogFrame>
  );
}
