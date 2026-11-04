export const SAMPLE_RATE = 48000;

export const TAP_BLOCK_SAMPLES = 240;
export const TAP_NOISE_PERCENTILE = 0.1;
export const TAP_MIN_LEVEL = 0.001;
export const TAP_NOISE_MARGIN = 10;
export const TAP_RISE_RATIO = 4;
export const TAP_RISE_BLOCKS = 4;
export const TAP_DEBOUNCE_BLOCKS = 20;
export const MAX_TAPS = 50;

export const CLIP_LEVEL = 0.999;
export const CLIP_CHECK_SAMPLES = 2400;
export const MIN_SAMPLES_AFTER_ONSET = 12000;

export const TAP_WINDOW_SAMPLES = 32768;
export const TAP_WINDOW_LEAD_SAMPLES = 8192;

export const MIN_FREQUENCY = 30;
export const MAX_FREQUENCY = 1000;

export const PEAK_FLOOR_DB = -60;
export const PEAK_PROMINENCE_DB = 3;
export const PEAK_NEIGHBOURHOOD_HZ = 30;
export const PEAK_RANGE_DB = 35;
export const MAX_PEAKS = 10;
export const MOBILE_EXCLUSION_HZ = { from: 132, to: 138 } as const;
