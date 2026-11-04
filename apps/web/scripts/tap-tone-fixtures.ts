// Writes the end-to-end tap-tone fixtures (e2e/fixtures/*.wav): deterministic synthetic
// recordings at 48 kHz, 16-bit mono. Run with `pnpm --filter @gb/web fixtures:tap-tone`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodeWav } from "@gb/dsp";

const SAMPLE_RATE = 48000;

type Mode = { frequency: number; amplitude: number; tau: number };
type Fixture = {
  seconds: number;
  onsets: readonly number[];
  modes: readonly Mode[];
  rumble?: number;
  loudTap?: { onset: number; gain: number };
};

const random = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const render = (fixture: Fixture): Float32Array => {
  const next = random(7);
  const length = Math.round(fixture.seconds * SAMPLE_RATE);
  return Float32Array.from({ length }, (_, n) => {
    const t = n / SAMPLE_RATE;
    const noise =
      0.0002 * Math.sqrt(-2 * Math.log(Math.max(next(), 1e-12))) * Math.cos(2 * Math.PI * next());
    const rumble = (fixture.rumble ?? 0) * Math.sin(2 * Math.PI * 15 * t);
    const taps = fixture.onsets.reduce((total, onset) => {
      if (t < onset) return total;
      const gain = fixture.loudTap?.onset === onset ? fixture.loudTap.gain : 1;
      const since = t - onset;
      return (
        total +
        gain *
          fixture.modes.reduce(
            (sum, mode) =>
              sum +
              mode.amplitude *
                Math.exp(-since / mode.tau) *
                Math.sin(2 * Math.PI * mode.frequency * since),
            0,
          )
      );
    }, 0);
    return Math.max(-1, Math.min(1, noise + rumble + taps));
  });
};

const plate: readonly Mode[] = [
  { frequency: 190, amplitude: 0.3, tau: 0.12 },
  { frequency: 95, amplitude: 0.2, tau: 0.15 },
];

export const FIXTURES: Readonly<Record<string, Fixture>> = {
  "taps.wav": { seconds: 4, onsets: [0.5, 1.6, 2.75], modes: plate, rumble: 0.05 },
  "clipped.wav": {
    seconds: 4,
    onsets: [0.5, 1.6, 2.75],
    modes: plate,
    rumble: 0.05,
    loudTap: { onset: 1.6, gain: 3 },
  },
  "mobile.wav": {
    seconds: 4,
    onsets: [0.5, 1.6, 2.75],
    modes: [
      { frequency: 134.8, amplitude: 0.3, tau: 0.12 },
      { frequency: 182.5, amplitude: 0.2, tau: 0.12 },
    ],
  },
  "silence.wav": { seconds: 3, onsets: [], modes: [] },
  "body.wav": {
    seconds: 5,
    onsets: [1, 2.2, 3.4],
    modes: [
      { frequency: 98.4, amplitude: 0.25, tau: 0.05 },
      { frequency: 196.9, amplitude: 0.3, tau: 0.06 },
      { frequency: 247.5, amplitude: 0.2, tau: 0.05 },
    ],
  },
};

const outputDir = fileURLToPath(new URL("../e2e/fixtures/", import.meta.url));
for (const [name, fixture] of Object.entries(FIXTURES)) {
  writeFileSync(`${outputDir}${name}`, encodeWav([render(fixture)], SAMPLE_RATE));
}
