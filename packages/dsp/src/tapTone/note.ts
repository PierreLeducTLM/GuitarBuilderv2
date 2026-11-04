const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
const A4_HZ = 440;

export const noteLabel = (frequency: number): string => {
  const semitones = 12 * Math.log2(frequency / A4_HZ);
  const nearest = Math.round(semitones);
  const name = NOTE_NAMES[(((nearest + 9) % 12) + 12) % 12];
  const octave = 4 + Math.floor((nearest + 9) / 12);
  const cents = Math.round(1200 * Math.log2(frequency / (A4_HZ * 2 ** (nearest / 12))));
  const sign = cents >= 0 ? "+" : "-";
  return `${name}${octave} ${sign}${Math.abs(cents)} c`;
};
