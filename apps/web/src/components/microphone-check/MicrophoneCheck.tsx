"use client";

import {
  type CheckLevel,
  measureLevel,
  measureTone,
  type RateVerdict,
  type ToneReading,
} from "@gb/dsp";
import { Button, DialogFrame, SelectField } from "@gb/ui";
import { LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { readCheck, rememberCheck } from "@/lib/microphone-check/memory";
import { decodeAudio, judgeRecording, prepareAudio } from "../tap-tone/audio";
import { type Recording, useAudioInputs, useRecorder } from "../tap-tone/hooks";
import { Oscilloscope } from "../tap-tone/Oscilloscope";
import { useCheckLabel } from "./useCheckLabel";
import { TONE_SECONDS, useTestTone } from "./useTestTone";

const CHECK_SECONDS = 5;
const MATCH_CENTS = 10;

type Outcome = {
  readonly verdict: RateVerdict;
  readonly statedRate: number;
  readonly level: CheckLevel;
};

type ToneOutcome = {
  readonly heard: ToneReading;
  readonly before: ToneReading | null;
  readonly clock: RateVerdict["verdict"];
};

type Phase = "idle" | "recording" | "tone" | "analyzing";

const browserStorage = () => window.localStorage;

/** microphone-check: the Microphone Check dialog (clock and level from one 5 s recording). */
export function MicrophoneCheck({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("microphoneCheck");
  const tDialog = useTranslations("dialog");
  const format = useFormatter();
  const inputs = useAudioInputs();
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tone, setTone] = useState<ToneOutcome | null>(null);
  const [error, setError] = useState<"microphone" | "processing" | null>(null);
  const input = inputs.inputs.find((candidate) => candidate.id === inputs.selected);
  const remembered = input ? readCheck(browserStorage, input) : null;
  const latestInput = useRef(input);
  latestInput.current = input;

  const decodeRecording = async (recording: Recording) => {
    setPhase("analyzing");
    const decoded = await decodeAudio(await recording.blob.arrayBuffer(), {
      mixToMono: false,
    }).catch(() => null);
    if (!decoded) {
      setError("processing");
      setPhase("idle");
    }
    return decoded;
  };

  const finishTone = async (recording: Recording) => {
    const decoded = await decodeRecording(recording);
    if (!decoded) return;
    const { verdict, audio } = judgeRecording(decoded, recording);
    const heardIn = (filtered: Float64Array | undefined) =>
      measureTone({ samples: filtered ?? new Float64Array(0), sampleRate: audio.sampleRate });
    setTone({
      heard: heardIn(audio.filtered[0]),
      before: verdict.verdict === "corrected" ? heardIn(prepareAudio(decoded).filtered[0]) : null,
      clock: verdict.verdict,
    });
    setPhase("idle");
  };

  const finish = async (recording: Recording) => {
    const decoded = await decodeRecording(recording);
    if (!decoded) return;
    const { verdict, audio } = judgeRecording(decoded, recording);
    const level = measureLevel({
      raw: audio.raw[0] ?? new Float32Array(0),
      filtered: audio.filtered[0] ?? new Float64Array(0),
    });
    const checked = latestInput.current;
    if (checked) {
      rememberCheck(browserStorage, checked, {
        checkedAt: new Date().toISOString(),
        rate: verdict.verdict,
        measuredRate: verdict.measuredRate,
        level: level.verdict,
        ...(verdict.verdict === "corrected" ? { trueRate: verdict.trueRate } : {}),
      });
    }
    setOutcome({ verdict, statedRate: recording.statedRate, level });
    setPhase("idle");
  };

  const refuse = () => {
    setError("microphone");
    setPhase("idle");
  };
  const recorder = useRecorder({
    deviceId: inputs.selected,
    maxSeconds: CHECK_SECONDS,
    onFinished: (recording) => void finish(recording),
    onError: refuse,
  });
  const toneRecorder = useRecorder({
    deviceId: inputs.selected,
    maxSeconds: TONE_SECONDS,
    onFinished: (recording) => void finishTone(recording),
    onError: refuse,
  });
  const testTone = useTestTone();

  const checkLabel = useCheckLabel();

  const signed = (value: number) => format.number(value, { signDisplay: "exceptZero" });
  const centsText = (key: "clock.cents" | "tone.heard" | "tone.off", value: number, extra = {}) => {
    const rounded = Math.round(value);
    return t(key, { ...extra, cents: signed(rounded), count: Math.abs(rounded) });
  };

  return (
    <DialogFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          recorder.cancel();
          toneRecorder.cancel();
          testTone.stop();
          onClose();
        }
      }}
      title={t("title")}
      closeLabel={tDialog("close")}
      size="lg"
      layer="top"
    >
      {inputs.inputs.length > 0 ? (
        <SelectField
          label={t("input")}
          value={inputs.selected ?? ""}
          disabled={phase !== "idle"}
          onChange={(event) => {
            inputs.select(event.target.value);
            setOutcome(null);
          }}
          fieldClassName="w-full max-w-sm"
        >
          {inputs.inputs.map((option, i) => (
            <option key={option.id} value={option.id}>
              {option.label ?? t("unnamedInput", { number: i + 1 })}
            </option>
          ))}
        </SelectField>
      ) : null}
      <p className="text-sm text-fg-dim">
        {remembered ? t("lastCheck", checkLabel(remembered)) : t("notChecked")}
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-ink bg-danger-soft px-3 py-2 text-sm text-danger-ink"
        >
          {t(`errors.${error}`)}
        </p>
      ) : null}

      {phase === "recording" ? (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-fg">{t("instruction")}</p>
          <p className="font-mono text-fg-dim">
            {t("remaining", {
              seconds: format.number(Math.max(0, CHECK_SECONDS - recorder.elapsed), "decimal1"),
            })}
          </p>
          <Oscilloscope analyser={recorder.analyser} />
        </div>
      ) : null}
      {phase === "tone" ? (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-fg">{t("tone.playing")}</p>
          <Oscilloscope analyser={toneRecorder.analyser} />
        </div>
      ) : null}
      {phase === "analyzing" ? (
        <p className="flex items-center gap-2 text-fg-dim">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {t("analyzing")}
        </p>
      ) : null}
      {phase === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              setError(null);
              setOutcome(null);
              setPhase("recording");
              await recorder.start();
              await inputs.refresh();
            }}
          >
            {outcome || remembered ? t("again") : t("start")}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setError(null);
              setTone(null);
              setPhase("tone");
              if (await toneRecorder.start()) testTone.play();
            }}
          >
            {t("tone.button")}
          </Button>
        </div>
      ) : null}

      {outcome ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="flex flex-col gap-1 rounded-xl border border-line bg-inset p-4">
            <h3 className="font-semibold text-fg">{t("clock.heading")}</h3>
            <p className="font-mono text-sm text-fg-dim">
              {t("clock.stated", { rate: outcome.statedRate })}
            </p>
            <p className="font-mono text-sm text-fg-dim">
              {t("clock.measured", { rate: Math.round(outcome.verdict.measuredRate) })}
            </p>
            <p className="font-mono text-sm text-fg-dim">
              {centsText("clock.cents", outcome.verdict.cents)}
            </p>
            <p className="text-sm text-fg">
              {outcome.verdict.verdict === "corrected"
                ? t("clock.corrected", {
                    trueRate: outcome.verdict.trueRate,
                    statedRate: outcome.statedRate,
                  })
                : t(`clock.${outcome.verdict.verdict}`)}
            </p>
          </section>
          <section className="flex flex-col gap-1 rounded-xl border border-line bg-inset p-4">
            <h3 className="font-semibold text-fg">{t("level.heading")}</h3>
            <p className="font-mono text-sm text-fg-dim">
              {t("level.noiseFloor", { db: format.number(outcome.level.noiseFloorDb, "decimal1") })}
            </p>
            <p className="font-mono text-sm text-fg-dim">
              {t("level.peak", { db: format.number(outcome.level.peakDb, "decimal1") })}
            </p>
            <p className="text-sm text-fg">{t(`level.${outcome.level.verdict}`)}</p>
          </section>
        </div>
      ) : null}
      {tone ? (
        <section className="flex flex-col gap-1 rounded-xl border border-line bg-inset p-4">
          {tone.heard.heard ? (
            <>
              <p className="font-mono text-sm text-fg">
                {centsText("tone.heard", tone.heard.cents, {
                  frequency: format.number(tone.heard.frequency, "decimal1"),
                })}
              </p>
              {tone.before?.heard ? (
                <p className="font-mono text-sm text-fg-dim">
                  {t("tone.correctedFrom", {
                    frequency: format.number(tone.before.frequency, "decimal1"),
                  })}
                </p>
              ) : null}
              {Math.abs(tone.heard.cents) <= MATCH_CENTS ? (
                <p className="text-sm text-fg">{t("tone.matches")}</p>
              ) : (
                <>
                  <p className="text-sm text-fg">{centsText("tone.off", tone.heard.cents)}</p>
                  {tone.clock === "mismatch" ? null : (
                    <p className="text-sm text-fg-dim">{t("tone.clockReference")}</p>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-fg">{t("tone.notHeard")}</p>
          )}
          <p className="text-sm text-fg-dim">{t("tone.note")}</p>
        </section>
      ) : null}
    </DialogFrame>
  );
}
