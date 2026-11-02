// JSON shapes stored in builds.sequence_state and exchanged with update_build_step
// (supabase/migrations/20261102120000_builds_and_steps.sql). The database stores them
// as jsonb, so the generated types only say `Json`; these name what the column holds.

/** The two guitar types of guitar-builds; `null` ("not set") only for imported builds. */
export const guitarTypes = ["classical", "steel_string"] as const;
export type GuitarType = (typeof guitarTypes)[number];

export function toGuitarType(value: unknown): GuitarType | null {
  return value === "classical" || value === "steel_string" ? value : null;
}

/** A photo attached to a step: its public URL and generated storage file name. */
export interface StepPhoto {
  url: string;
  name: string;
}

/** Tap-Tone Spectrum Record (tap-tone-capture), limited to frequencies up to 2000 Hz. */
export interface SpectrumRecord {
  /** Hz, ascending. */
  frequencies: number[];
  /** Linear amplitudes, same length as `frequencies`. */
  magnitudes: number[];
  /** dB, same length as `frequencies`. */
  magnitudesDb: number[];
  /** Hz. */
  sampleRate: number;
  /** Samples. */
  fftSize: number;
  /** Hz, sampleRate / fftSize. */
  binWidth: number;
}

/** A tap-tone measurement attached to a step (build-sequence: Step Measurement Record). */
export interface StepMeasurement {
  id: string;
  /** Recording time, milliseconds since the epoch. */
  timestamp: number;
  description: string;
  /** Accepted peak frequency, Hz. */
  frequency: number;
  spectrum: SpectrumRecord;
}

/** One step's stored state, as returned by update_build_step. */
export interface StepEntry {
  key: string;
  completed: boolean;
  notes: string;
  photos: StepPhoto[];
  measurements: StepMeasurement[];
}

/** One change applied by update_build_step. */
export type StepChange =
  | { op: "set_completed"; completed: boolean }
  | { op: "set_notes"; notes: string }
  | { op: "add_photos"; photos: StepPhoto[] }
  | { op: "remove_photo"; name: string }
  | { op: "add_measurement"; measurement: StepMeasurement }
  | { op: "set_measurement_description"; id: string; description: string }
  | { op: "remove_measurement"; id: string };

/** Name of the public storage bucket holding step photos. */
export const STEP_PHOTOS_BUCKET = "step-photos";

/** Object path of a step photo inside the bucket: `<build id>/<step key>/<file name>`. */
export function stepPhotoPath(buildId: string, stepKey: string, name: string): string {
  return `${buildId}/${stepKey}/${name}`;
}
