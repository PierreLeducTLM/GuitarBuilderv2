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

export const Q_BANDWIDTH_DB = 3;
export const Q_SEARCH_HZ = 50;
export const Q_MIN_BANDWIDTH_HZ = 0.1;

export const BODY_BAND_HZ = { from: 60, to: 400 } as const;
export const BODY_LOCAL_MAX_POINTS = 3;
export const BODY_RANGE_DB = 30;
export const BODY_PROMINENCE_DB = 6;
export const BODY_PROMINENCE_POINTS = 6;
export const AIR_RANGE_HZ = { from: 70, to: 130 } as const;
export const TOP_MIN_HZ = 140;
export const TOP_MIN_AIR_RATIO = 1.4;
export const TOP_MAX_HZ = 300;
export const BACK_MIN_ABOVE_TOP_HZ = 15;
export const BACK_MAX_HZ = 400;
export const BODY_SPLIT_HZ = 15;
export const ROLE_REATTACH_HZ = 3;
