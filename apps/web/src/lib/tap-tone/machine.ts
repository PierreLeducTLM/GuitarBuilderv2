import {
  nearestPeak,
  reattachRole,
  recomputeTake,
  resultFromRecord,
  type TakeAnalysis,
  type TakeCache,
  type TakePeak,
  type TakeResult,
  type TapToneRecord,
} from "@gb/dsp";

export type PlateTake = "longitudinal" | "crossGrain" | "diagonal";
export type TakeKey = PlateTake | "instrument";
export type RoleName = "air" | "top" | "back";
export type DialogMode = "plate" | "instrument";

export const PLATE_TAKES: readonly PlateTake[] = ["longitudinal", "crossGrain", "diagonal"];
export const ROLE_NAMES: readonly RoleName[] = ["air", "top", "back"];
const ALL_TAKES: readonly TakeKey[] = [...PLATE_TAKES, "instrument"];

export type DialogError =
  | {
      key:
        | "microphone"
        | "captureRate"
        | "processing"
        | "noTap"
        | "unsupported"
        | "export"
        | "playback";
    }
  | { key: "decode"; reason: string };

export type RateCorrection = { readonly trueRate: number; readonly statedRate: number };

export type TakeAudio = {
  readonly filtered: readonly Float64Array[];
  readonly raw: readonly Float32Array[];
  readonly sampleRate: number;
  readonly correction?: RateCorrection;
};

export type ResultsTake = {
  readonly status: "results";
  readonly cache: TakeCache | null;
  readonly result: TakeResult;
  readonly excluded: readonly number[];
  readonly selected: number | null;
  readonly manualRoles: Partial<Record<RoleName, number | null>>;
  readonly audio: TakeAudio | null;
};

export type Take =
  | { readonly status: "idle" }
  | { readonly status: "recording" }
  | { readonly status: "analyzing"; readonly run: number }
  | ResultsTake;

export type DialogState = {
  readonly mode: DialogMode;
  readonly takes: Partial<Record<TakeKey, Take>>;
  readonly active: TakeKey;
  readonly error: DialogError | null;
  readonly nextRun: number;
};

export type DialogEvent =
  | { type: "recordingStarted" }
  | { type: "recordingCancelled" }
  | { type: "analysisStarted" }
  | { type: "analysisDone"; run: number; analysis: TakeAnalysis; audio: TakeAudio }
  | { type: "analysisFailed"; run: number }
  | { type: "captureRejected"; run: number }
  | { type: "failed"; error: DialogError }
  | { type: "tapToggled"; number: number }
  | { type: "peakSelected"; index: number }
  | { type: "roleAssigned"; role: RoleName; index: number }
  | { type: "roleCleared"; role: RoleName }
  | { type: "reRecorded" }
  | { type: "takeSwitched"; take: TakeKey }
  | { type: "errorShown"; error: DialogError };

export type RoleView = {
  readonly frequency: number;
  readonly level: number;
  readonly spectralQ: number | null;
  readonly origin: "auto" | "user";
};

const IDLE: Take = { status: "idle" };

const indexNear = (peaks: readonly TakePeak[], frequency: number | undefined): number | null => {
  if (peaks.length === 0) return null;
  if (!frequency) return 0;
  const near = nearestPeak(peaks, frequency);
  return Math.max(
    0,
    peaks.findIndex((peak) => peak === near),
  );
};

const resultsTake = (options: {
  result: TakeResult;
  cache: TakeCache | null;
  audio: TakeAudio | null;
  near?: number;
}): ResultsTake => ({
  status: "results",
  cache: options.cache,
  result: options.result,
  excluded: [],
  selected: indexNear(options.result.peaks, options.near),
  manualRoles: {},
  audio: options.audio,
});

export const createDialog = (
  options:
    | {
        mode: "plate";
        saved?: Partial<Record<PlateTake, TapToneRecord>>;
        current?: Partial<Record<PlateTake, number>>;
      }
    | { mode: "instrument" },
): DialogState => {
  if (options.mode === "instrument") {
    return {
      mode: "instrument",
      takes: { instrument: IDLE },
      active: "instrument",
      error: null,
      nextRun: 1,
    };
  }
  const takes = Object.fromEntries(
    PLATE_TAKES.map((key) => {
      const record = options.saved?.[key];
      return [
        key,
        record
          ? resultsTake({
              result: resultFromRecord(record),
              cache: null,
              audio: null,
              near: options.current?.[key],
            })
          : IDLE,
      ];
    }),
  );
  return { mode: "plate", takes, active: "longitudinal", error: null, nextRun: 1 };
};

const withTake = (state: DialogState, key: TakeKey, take: Take): DialogState => ({
  ...state,
  takes: { ...state.takes, [key]: take },
});

const activeResults = (state: DialogState): ResultsTake | null => {
  const take = state.takes[state.active];
  return take?.status === "results" ? take : null;
};

const takeRunning = (state: DialogState, run: number): TakeKey | undefined =>
  ALL_TAKES.find((key) => {
    const take = state.takes[key];
    return take?.status === "analyzing" && take.run === run;
  });

const toggleTap = (take: ResultsTake, number: number): ResultsTake => {
  if (!take.cache) return take;
  const excluded = take.excluded.includes(number)
    ? take.excluded.filter((n) => n !== number)
    : [...take.excluded, number];
  const result = recomputeTake(take.cache, excluded);
  const previous = take.selected === null ? undefined : take.result.peaks[take.selected]?.frequency;
  const manualRoles = Object.fromEntries(
    Object.entries(take.manualRoles).map(([role, frequency]) => [
      role,
      typeof frequency === "number"
        ? (reattachRole(frequency, result.peaks)?.frequency ?? null)
        : null,
    ]),
  );
  return { ...take, excluded, result, selected: indexNear(result.peaks, previous), manualRoles };
};

export const reduce = (state: DialogState, event: DialogEvent): DialogState => {
  const results = activeResults(state);
  switch (event.type) {
    case "recordingStarted":
      return { ...withTake(state, state.active, { status: "recording" }), error: null };
    case "recordingCancelled":
      return state.takes[state.active]?.status === "recording"
        ? withTake(state, state.active, IDLE)
        : state;
    case "analysisStarted":
      return {
        ...withTake(state, state.active, { status: "analyzing", run: state.nextRun }),
        nextRun: state.nextRun + 1,
        error: null,
      };
    case "analysisDone": {
      const key = takeRunning(state, event.run);
      if (!key) return state;
      if (event.analysis.result.taps.length === 0) {
        return { ...withTake(state, key, IDLE), error: { key: "noTap" } };
      }
      return withTake(
        state,
        key,
        resultsTake({
          result: event.analysis.result,
          cache: event.analysis.cache,
          audio: event.audio,
        }),
      );
    }
    case "analysisFailed": {
      const key = takeRunning(state, event.run);
      return key ? { ...withTake(state, key, IDLE), error: { key: "processing" } } : state;
    }
    case "captureRejected": {
      const key = takeRunning(state, event.run);
      return key ? { ...withTake(state, key, IDLE), error: { key: "captureRate" } } : state;
    }
    case "failed":
      return { ...withTake(state, state.active, IDLE), error: event.error };
    case "tapToggled":
      return results ? withTake(state, state.active, toggleTap(results, event.number)) : state;
    case "peakSelected":
      return results && results.result.peaks[event.index]
        ? withTake(state, state.active, { ...results, selected: event.index })
        : state;
    case "roleAssigned": {
      const peak = results?.result.peaks[event.index];
      return results && peak
        ? withTake(state, state.active, {
            ...results,
            manualRoles: { ...results.manualRoles, [event.role]: peak.frequency },
          })
        : state;
    }
    case "roleCleared":
      return results
        ? withTake(state, state.active, {
            ...results,
            manualRoles: { ...results.manualRoles, [event.role]: null },
          })
        : state;
    case "reRecorded":
      return withTake(state, state.active, IDLE);
    case "takeSwitched": {
      const recording = Object.values(state.takes).some((take) => take?.status === "recording");
      return recording || !(event.take in state.takes) ? state : { ...state, active: event.take };
    }
    case "errorShown":
      return { ...state, error: event.error };
  }
};

export const selectedPeak = (take: Take | undefined): TakePeak | undefined =>
  take?.status === "results" && take.selected !== null
    ? take.result.peaks[take.selected]
    : undefined;

export const effectiveRoles = (take: Take | undefined): Record<RoleName, RoleView | null> => {
  const view = (role: RoleName): RoleView | null => {
    if (take?.status !== "results") return null;
    const manual = take.manualRoles[role];
    if (manual === null) return null;
    if (typeof manual === "number") {
      const peak = take.result.peaks.find((p) => p.frequency === manual);
      return peak
        ? {
            frequency: peak.frequency,
            level: peak.level,
            spectralQ: peak.spectralQ?.q ?? null,
            origin: "user",
          }
        : null;
    }
    const auto = take.result.roles?.[role];
    return auto
      ? {
          frequency: auto.frequency,
          level: auto.level,
          spectralQ: auto.spectralQ.q,
          origin: "auto",
        }
      : null;
  };
  return { air: view("air"), top: view("top"), back: view("back") };
};

export const canConfirm = (state: DialogState): boolean =>
  Object.values(state.takes).some((take) => selectedPeak(take) !== undefined);

export type PlateResult = Partial<
  Record<PlateTake, { frequency: number; record: TapToneRecord; spectralQ: number | null }>
>;

export const plateResults = (state: DialogState): PlateResult =>
  Object.fromEntries(
    PLATE_TAKES.flatMap((key) => {
      const take = state.takes[key];
      const peak = selectedPeak(take);
      const record = take?.status === "results" ? take.result.record : null;
      return peak && record
        ? [[key, { frequency: peak.frequency, record, spectralQ: peak.spectralQ?.q ?? null }]]
        : [];
    }),
  );

export const instrumentResult = (
  state: DialogState,
): {
  frequency: number;
  record: TapToneRecord;
  roles: Partial<Record<RoleName, RoleView>>;
} | null => {
  const take = state.takes.instrument;
  const peak = selectedPeak(take);
  const record = take?.status === "results" ? take.result.record : null;
  if (!peak || !record) return null;
  const views = effectiveRoles(take);
  const roles = Object.fromEntries(
    ROLE_NAMES.flatMap((name) => {
      const role = views[name];
      return role ? [[name, role]] : [];
    }),
  );
  return { frequency: peak.frequency, record, roles };
};
