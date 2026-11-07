"use client";

import {
  type DecayTarget,
  judgeRate,
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
  ROLE_NAMES,
  type RoleName,
  reduce,
  selectedPeak,
  type TakeAudio,
} from "@/lib/tap-tone/machine";
import {
  correctRate,
  type DecodedAudio,
  decodeAudio,
  downloadWav,
  isMobileDevice,
  isSupportedAudioFile,
  prepareAudio,
} from "./audio";
import {
  MAX_RECORDING_SECONDS,
  type Recording,
  useAudioInputs,
  useClipFlag,
  usePlayback,
  useRecorder,
} from "./hooks";
import { Oscilloscope } from "./Oscilloscope";
import { PeakInspector } from "./PeakInspector";
import { BodyModes, ClippingNotice, MainFrequency, PlateTakes, TAKE_SYMBOL } from "./panels";
import { type GraphMark, type ModeSlot, TapToneSpectrum } from "./TapToneSpectrum";
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
const MODE_SLOTS: readonly ModeSlot[] = [1, 2, 3];

const targetFor = (result: TakeResult, frequency: number, level: number): DecayTarget =>
  result.peaks.find((peak) => Math.abs(peak.frequency - frequency) <= SAME_PEAK_HZ) ?? {
    frequency,
    level,
    spectralQ: null,
  };

type Checked =
  | { readonly accepted: true; readonly audio: TakeAudio }
  | { readonly accepted: false };

const checkRecording = (decoded: DecodedAudio, recording: Recording): Checked => {
  const verdict = judgeRate({
    elapsedSeconds: recording.elapsedSeconds,
    statedRate: recording.statedRate,
    decodedSeconds: (decoded.channels[0]?.length ?? 0) / decoded.sampleRate,
    ...(recording.frames ? { frames: recording.frames } : {}),
  });
  if (verdict.verdict === "mismatch") return { accepted: false };
  if (verdict.verdict === "accurate") return { accepted: true, audio: prepareAudio(decoded) };
  const correction = { trueRate: verdict.trueRate, statedRate: recording.statedRate };
  return {
    accepted: true,
    audio: { ...prepareAudio(correctRate(decoded, correction)), correction },
  };
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
  const [focused, setFocused] = useState<RoleName | null>(null);
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
  const clip = useClipFlag();

  const analyseAudio = async (
    load: () => Promise<DecodedAudio>,
    onLoadError: (error: unknown) => void,
    check: (decoded: DecodedAudio) => Checked = (decoded) => ({
      accepted: true,
      audio: prepareAudio(decoded),
    }),
  ) => {
    const run = latest.current.nextRun;
    dispatch({ type: "analysisStarted" });
    setChosenTap(null);
    const decoded = await load().catch((error: unknown) => {
      onLoadError(error);
      return null;
    });
    if (!decoded) return;
    const checked = check(decoded);
    if (!checked.accepted) {
      dispatch({ type: "captureRejected", run });
      return;
    }
    analyse({ run, audio: checked.audio, mode: props.mode, mobile });
  };

  const recorder = useRecorder({
    deviceId: inputs.selected,
    onFinished: (recording) => {
      const run = latest.current.nextRun;
      void analyseAudio(
        async () => decodeAudio(await recording.blob.arrayBuffer(), { mixToMono: false }),
        () => dispatch({ type: "analysisFailed", run }),
        (decoded) => checkRecording(decoded, recording),
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

  const sameAs =
    ROLE_NAMES.find((name) => {
      const role = roles[name];
      return role && peak && Math.abs(role.frequency - peak.frequency) <= SAME_PEAK_HZ;
    }) ?? null;

  const bodyMode = (name: RoleName) => {
    const role = roles[name];
    return role && results
      ? {
          frequency: role.frequency,
          spectralQ: role.spectralQ,
          decayQ: decayOf(targetFor(results.result, role.frequency, role.level)).view,
          origin: role.origin,
        }
      : null;
  };
  const bodyModes = { air: bodyMode("air"), top: bodyMode("top"), back: bodyMode("back") };

  const activePlate = state.active === "instrument" ? null : state.active;
  const marks: GraphMark[] = activePlate
    ? peak
      ? [
          {
            id: activePlate,
            slot: MODE_SLOTS[PLATE_TAKES.indexOf(activePlate)] ?? 1,
            name: "f",
            sub: TAKE_SYMBOL[activePlate],
            frequency: peak.frequency,
            level: peak.level,
          },
        ]
      : []
    : ROLE_NAMES.flatMap((name, i) => {
        const role = roles[name];
        return role
          ? [
              {
                id: name,
                slot: MODE_SLOTS[i] ?? 1,
                name: t(`roles.${name}`),
                frequency: role.frequency,
                level: role.level,
              },
            ]
          : [];
      });

  const plateSelected = Object.fromEntries(
    PLATE_TAKES.flatMap((key) => {
      const chosen = selectedPeak(state.takes[key]);
      return chosen ? [[key, chosen]] : [];
    }),
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
      {activePlate ? (
        <PlateTakes
          selected={plateSelected}
          active={activePlate}
          recording={recording}
          onSwitch={(take) => dispatch({ type: "takeSwitched", take })}
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-fg-dim">{activePlate ? t(`guidance.${activePlate}`) : null}</p>
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
          <Oscilloscope analyser={recorder.analyser} onClip={clip.report} />
          <p
            data-testid="clip-indicator"
            aria-live="polite"
            className="text-sm font-semibold text-danger-ink"
          >
            {clip.clipping ? t("capture.clipping") : ""}
          </p>
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
          {audio?.correction ? (
            <p className="rounded-xl border border-line bg-inset px-3 py-2 text-sm text-fg-dim">
              {t("capture.corrected", audio.correction)}
            </p>
          ) : null}
          {audio ? <ClippingNotice taps={results.result.taps} /> : null}
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
            <>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-fg">
                  {t("spectrum.caption")}{" "}
                  <span className="font-normal text-fg-dim">
                    {activePlate ? t("spectrum.hint") : t("spectrum.instrumentHint")}
                  </span>
                </p>
                <TapToneSpectrum
                  points={results.result.points}
                  peaks={results.result.peaks}
                  selected={results.selected}
                  onSelect={choosePeak}
                  marks={marks}
                  focused={focused}
                  {...(activePlate
                    ? {}
                    : {
                        onDragMark: (id: string, index: number) => {
                          const role = ROLE_NAMES.find((name) => name === id);
                          if (role) dispatch({ type: "roleAssigned", role, index });
                        },
                      })}
                />
              </div>
              {activePlate ? null : (
                <BodyModes
                  modes={bodyModes}
                  focused={focused}
                  moving={moving !== null}
                  onFocus={(role) => {
                    setMoving(null);
                    setFocused((current) => (current === role ? null : role));
                  }}
                  onMove={() => setMoving((current) => (current ? null : focused))}
                  onClear={(role) => {
                    setMoving(null);
                    dispatch({ type: "roleCleared", role });
                  }}
                />
              )}
              <MainFrequency
                peak={peak}
                decayQ={peak ? decayOf(peak).view : "pending"}
                context={
                  activePlate
                    ? {
                        mode: "plate",
                        take: activePlate,
                        ...(currentValue === undefined ? {} : { current: currentValue }),
                      }
                    : { mode: "instrument", sameAs }
                }
                peaks={results.result.peaks}
                selected={results.selected}
                onSelect={choosePeak}
              />
            </>
          )}
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
                setFocused(null);
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
