# Findings: tap-tone-capture

## Dead or unwired code
- **Microphone calibration / spectral gating no longer exists.** Added in a5dfaec, removed in the record-then-analyze rewrite e8b0e4e (`git log -S isCalibrating -- src/components/FrequencyDetectionModal.tsx`). The old algorithm, in case the owner wants it back: the first 1 s of a live capture was "calibration" (UI showed "Calibrating noise..." / "Silence..."). During that second, a per-bin noise profile was learned as the max-hold of the live analyser's dB spectrum (FFT 16384, analyser smoothing 0.3, input gain 1.0, range 20-1200 Hz). After that, any bin below `noise[k] + 6 dB` was set to -100 dB (spectral gate). The gated spectrum fed a max-hold trace, and the detected frequency was the argmax of the max-hold in range if > -80 dB. None of this is in the current modal, so it is not specced.
- **No onset/tap trigger and no sub-bin (parabolic) interpolation** in the live modal. Recording is a fixed manual window. Peaks are reported at bin frequency (`src/utils/dsp.ts:575`). Parabolic interpolation exists only in `src/utils/peakDetection.ts:133-160`, which the analyzer on the build page uses (owned by `build-acoustic-analysis`). The modal stopped using `findStrongestPeak` in a5dfaec.
- **Gaussian spectral smoothing is unreachable**: `src/utils/dsp.ts:252-287,482-486`. The modal always passes `smoothingSigma: 0` (`src/components/FrequencyDetectionModal.tsx:427`), and the default is 0 (`dsp.ts:383`). It used to default to 8, then 4 (5b04257). The definition, if revived: kernel half-width `h = ceil(3*sigma)` bins, weights `g[i] = exp(-i^2/(2*sigma^2))` for `i = -h..h`, normalized to sum 1, convolved over linear magnitudes before the range cut. Edges are zero-padded and not renormalized, so edge bins are attenuated. Not specced: the spec says "no smoothing".
- Unused parts of `src/utils/dsp.ts`: `DSP` constants and `WindowFunction` class (16-22, 185-224), `FFT.getBandFrequency` (80-82, which returns the bin center and disagrees with the `k*df` used in the results), and `FFT.peak/peakBand` tracking (42-43, 99-102, never reset between frames).
- `src/utils/audioFileLoader.ts:108-129` `resampleAudioBuffer` is unused anywhere. `validateAudioFile` (50 MB limit, 161-181) is used only by the build-page analyzer, not by the modal.
- The translation key `frequencyDetector.hoverToSelect` ("Hover over graph and click to select frequency") is unused (`public/locales/en/translation.json`, `fr` likewise).

## Bugs and inconsistencies
- **The live waveform never draws.** `startRecording` calls `requestAnimationFrame(drawWaveform)` (`FrequencyDetectionModal.tsx:347`) with the callback captured while `state === 'idle'`. `drawWaveform` returns early when `state !== 'recording'` (207), and nothing restarts the loop, so the canvas stays blank. Specced the evident intent: a live oscilloscope.
- **Missing i18n keys render as raw keys.** i18next returns the key string, so the `|| 'fallback'` never applies: `common.or` (1040), `frequencyDetector.uploadFile` (1050), `frequencyDetector.downloadAudio` (1098), `common.play` / `common.stop` (1090). Hard-coded English text: "(highest)" (1189), "Microphone N" (972), "Error generating audio file" (863), "Error playing audio" (902), loader errors (`audioFileLoader.ts:43,69`), and caller labels (`WoodPropertiesCalculator.tsx:916-922`, `BuildSequenceDiagram.tsx:1219`). Specced: all text in EN and FR.
- Cents use `Math.floor` instead of rounding (`dsp.ts:317`). For example, -0.2 c displays as "-1 c". Specced nearest-integer rounding.
- WAV sample-scaling precedence bug at `audioExport.ts:48`. `0.5 + sample < 0` parses as `(0.5 + sample) < 0`, so negative samples in (-0.5, 0) are scaled by 32767 instead of 32768. Specced the standard `s<0 ? *32768 : *32767`.
- The recorded blob is always labeled `audio/webm` (481), even when the MP4 fallback was chosen (312-314). Decoding relies on content sniffing. Specced "decode according to the format actually used".
- File uploads are decoded at the device's default rate (509), but recordings are forced to 48 kHz (485). 3dcaed9's stated intent is to standardize on 48 kHz. Specced 48 kHz for files too. As a result, bin width and stored record length currently differ for files on 44.1 kHz devices (360 points, df = 2.69 Hz).
- The Accept "trim to <= 2000 Hz" (`FrequencyDetectionModal.tsx:805-822`) is a no-op, because analysis stops at 1000 Hz. `WoodPropertiesCalculator.tsx:293-318` repeats the same trim. There is no downsampling despite the "storage optimization" comments.
- Reopen path (`FrequencyDetectionModal.tsx:142-166`):
  - It does not re-apply the mobile 132-138 Hz exclusion.
  - With zero peaks and a non-zero current value, `closest.frequency` throws on undefined. The error is caught, so nothing is selected.
  - The graph is only (re)drawn when `peaks.length > 0` (696), so a saved spectrum with no peaks shows a blank graph. Specced: the graph always shows the spectrum.
- Mobile detection (444) includes any touch-capable browser (e.g. a touchscreen laptop) and silently drops genuine 132-138 Hz resonances. The filter runs after the 35 dB adaptive cut and the top-10 cut (433-452). If the artifact was the strongest peak, the 35 dB window is relative to the artifact, and fewer than 10 peaks may remain.
- The quiet-fallback test uses the max over the whole 0-Nyquist spectrum (`dsp.ts:470`), not the 30-1000 Hz range.
- Playback:
  - Each Play creates a new audio context that is never closed (881).
  - Re-record and Close do not stop an ongoing playback (840-847, 833-836). Only reopening without saved data does (186-190).
  - Specced: playback stops on re-record, cancel and close.
- The download filename is always `wood-frequency-analysis-...` (858), even for build-step captures.
- Closing the dialog while "analyzing" does not cancel the async processing (473-498). State is updated on a hidden dialog, and the next open resets it.
- The graph's top is -20 dB (545). A strong tap louder than -20 dB is clipped to the top edge, along with its marker.
- The device choice persists after the device is unplugged (100-104). The exact-device constraint then fails with the generic microphone error.
- The wood calculator's `currentValue` defaults to non-zero values (180/90/120, `WoodPropertiesCalculator.tsx:32-34`). The "Current Value" panel therefore shows these defaults even before any measurement.
- The migration comment says the map keys are `longitudinal, cross_grain, diagonal` (`supabase/migrations/20260104000000_add_fft_data_to_wood_panels.sql:5`). The code actually uses `freqLongitudinal`, `freqCrossGrain`, `freqDiagonal` (`WoodPropertiesCalculator.tsx:50,316`). Relevant for data migration (owned by `wood-panel-properties`).
- `hoverToSelect` wording implies any frequency can be picked, but a click always selects the nearest detected peak (774-792).

## Security and data-integrity concerns
- The spectrum record is client-built JSON stored as-is (wood panel `fft_data`, build-step `fftData`). There is no server-side shape or size validation, so a modified client can store arbitrary or large JSON. The impact is low (only the owner's rows), but the rewrite should validate the shape and length (about 331-360 points).
- Raw audio is never uploaded or persisted. The WAV download is local only. This is good; keep it.
- The microphone is opened only on explicit Start Recording and released on stop or cancel. No issue found.

## Open questions for the owner
- Should microphone calibration and spectral gating (a5dfaec) or an automatic tap/onset trigger come back? Neither exists today.
- Should peaks get sub-bin refinement, e.g. parabolic interpolation on dB: `delta = 0.5*(a-c)/(a-2b+c)`, `f = (k+delta)*df`? Bin spacing is 2.93 Hz. Wood moduli scale with f^2, so a 1.5 Hz error at a 90 Hz cross-grain mode is about a 3.3% error in E_C.
- Should the 132-138 Hz exclusion apply only to Android (as the comment says), or to all touch devices (as the code does)? Should it be re-applied when reopening saved spectra?
- Should a click on the graph be able to select an arbitrary (non-peak) frequency? `hoverToSelect` suggests yes.
- Should the dialog warn about "no clear peak - tap harder", clipping, or too-short recordings? Today the user only sees "—".
- Should the file input be resampled to 48 kHz (specced) or analyzed at its native rate?
- Should the graph's dB range extend above -20 dB (strong taps are clipped), or auto-scale?
- Should the export filename reflect the caller (wood measurement vs build step)?
