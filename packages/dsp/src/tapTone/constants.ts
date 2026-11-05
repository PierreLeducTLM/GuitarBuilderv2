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
export const BODY_PROMINENCE_HZ = 30;
export const AIR_RANGE_HZ = { from: 70, to: 130 } as const;
export const TOP_MIN_HZ = 140;
export const TOP_MIN_AIR_RATIO = 1.4;
export const TOP_MAX_HZ = 300;
export const BACK_MIN_ABOVE_TOP_HZ = 15;
export const BACK_AIR_RATIO = 2;
export const BACK_MAX_HZ = 400;
export const BODY_SPLIT_HZ = 15;
export const ROLE_REATTACH_HZ = 3;

export const DECAY_NEXT_TAP_MARGIN_SAMPLES = 480;
export const DECAY_SEGMENT_MAX_SAMPLES = 144000;
export const DECAY_NEIGHBOUR_RANGE_DB = 30;
export const DECAY_KERNEL_SPACING_FACTOR = 3.5;
export const DECAY_KERNEL_SECONDS = { min: 0.02, max: 0.5 } as const;
export const DECAY_PRECHECK_DB_PER_HZ_SECOND = 27.29;
export const DECAY_PRECHECK_GUARD_SECONDS = 0.005;
export const DECAY_PRECHECK_SMOOTHER_SECONDS = 0.00196;
export const DECAY_PRECHECK_MAX_DB = 30;
export const DECAY_DECIMATION = 48;
export const DECAY_SMOOTHER_STAGES = 4;
export const DECAY_RATE = 1000;
export const DECAY_QUIET_MIN_SECONDS = 0.1;
export const DECAY_QUIET_KERNEL_FACTOR = 3;
export const DECAY_TAIL_MIN_SAMPLES = 100;
export const DECAY_TAIL_KERNEL_FACTOR = 3;
export const DECAY_TAIL_WINDOWS_NEEDED = 2;
export const DECAY_NOISE_FLOOR_MIN = 1e-6;
export const DECAY_END_MARGIN = 10;
export const DECAY_CONTACT_GUARD_SAMPLES = 5;
export const DECAY_MIN_FIT_SAMPLES = 8;
export const DECAY_DB_PER_NEPER = 8.6859;
export const DECAY_MIN_RANGE_DB = 10;
export const DECAY_MAX_RESIDUAL_DB = 1;
export const DECAY_HALF_RATIO = { min: 0.7, max: 1.43 } as const;
export const DECAY_MIN_VALID_TAPS = 3;
export const DECAY_MAX_SPREAD = 0.15;
export const DECAY_DISPLAY_BUCKETS = 400;
export const DECAY_DISPLAY_POINTS = 800;
