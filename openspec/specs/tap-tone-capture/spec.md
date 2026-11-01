# tap-tone-capture Specification

## Purpose
A luthier taps a wood sample or a guitar part and the system listens through the browser's microphone (or reads an audio file), computes a magnitude spectrum, finds the resonant peaks and lets the user confirm one peak frequency. The confirmed frequency, together with a compact copy of the spectrum, is handed back to the screen that opened the dialog: the wood calculator (`wood-panel-properties`) for its three panel frequencies, or a build step (`build-sequence`) for a generic sound measurement.

## Requirements

### Requirement: Opening the Capture Dialog
The system SHALL provide a modal "Frequency Detector" dialog that a calling screen opens with a measurement label, an optional current frequency value (Hz) and an optional previously saved spectrum record. The label is shown under the title. Without a saved spectrum the dialog opens in the idle state. Opening the dialog SHALL NOT by itself trigger a microphone permission prompt. Clicking outside the dialog does not close it.

#### Scenario: Open from the wood calculator
- **WHEN** the user clicks the detect button next to the longitudinal, cross-grain or diagonal frequency field
- **THEN** the dialog opens with the label "Longitudinal Frequency (f_L)", "Cross-grain Frequency (f_C)" or "Diagonal Frequency (f_LC)" respectively
- **AND** the caller passes that field's current value and, if one exists for that field, its saved spectrum record

#### Scenario: Open from a build step
- **WHEN** the user clicks "Add Analysis" on a build step named "Top bracing"
- **THEN** the dialog opens with the label "Analysis for Top bracing", no current value and no saved spectrum

#### Scenario: Idle state contents
- **WHEN** the dialog opens without a saved spectrum
- **THEN** it shows the input device selector, a Start Recording button, the hint "Max 5 seconds", an "or" separator and an Upload Audio File action
- **AND** the browser has not asked for microphone permission yet

### Requirement: Help Instructions
The system SHALL show usage instructions in a tooltip next to the dialog title.

#### Scenario: Hover the help icon
- **WHEN** the user hovers the help icon beside "Frequency Detector"
- **THEN** a panel titled "Instructions:" lists: click "Start Recording" to begin; tap the wood sample firmly; recording will capture up to 5 seconds of audio; after recording, the spectrum will be analyzed; click on a peak to select a different frequency

### Requirement: Input Device Selection
The system SHALL let the user choose the audio input device before recording. The list holds the browser's audio inputs, is refreshed when devices are connected or disconnected while the dialog is open, and is refreshed again after permission is granted so real names appear. The selector is disabled while recording and hidden when no input is listed, in which case the browser's default input is used.

#### Scenario: Initial choice
- **WHEN** the dialog opens for the first time on a page
- **THEN** the device the browser marks as default is selected, otherwise the first listed device
- **AND** the choice is kept for later openings while the page stays open

#### Scenario: Unnamed devices before permission
- **GIVEN** the user has never granted microphone permission to the site
- **WHEN** the dialog opens on a computer with two inputs
- **THEN** the selector lists "Microphone 1" and "Microphone 2" (localized)
- **AND** after the user starts a recording and grants permission, the entries show the real device names

#### Scenario: Device plugged in
- **WHEN** a USB microphone is connected while the dialog is open
- **THEN** it appears in the selector without reopening the dialog

### Requirement: Raw Microphone Capture
The system SHALL, when the user clicks Start Recording, open the selected microphone as an unprocessed mono stream at 48,000 Hz, asking the browser for permission at that moment. Echo cancellation, noise suppression and automatic gain control SHALL be turned off so the tap's natural level and decay are preserved.

#### Scenario: Capture settings requested
- **WHEN** a recording starts
- **THEN** the browser is asked for exactly the selected device, 1 channel, a 48,000 Hz sample rate, echo cancellation off, noise suppression off and automatic gain control off

### Requirement: Recording Format Preference
The system SHALL store the recording in the best format the browser supports, preferring lossless audio, and SHALL decode it according to the format actually used.

#### Scenario: Format choice order
- **WHEN** a recording starts
- **THEN** the first supported format is used from: lossless PCM in a WebM container, Opus in WebM, the browser's default WebM, MP4
- **AND** the recording is collected in chunks of about 100 ms

### Requirement: Microphone Access Errors
The system SHALL stay in the idle state and show "Unable to access microphone. Please check permissions." when the microphone cannot be opened for any reason (no microphone, permission denied, selected device unavailable or busy).

#### Scenario: Permission denied
- **WHEN** the user clicks Start Recording and denies the permission prompt
- **THEN** the dialog stays idle and shows "Unable to access microphone. Please check permissions." in its error banner

### Requirement: Recording Window
The system SHALL record continuously from Start Recording until the user clicks Stop Recording or 5.0 seconds have elapsed, and SHALL analyze the whole recording. There is no automatic tap or onset trigger: recording starts immediately and the user taps the part one or more times during the window. Upload Audio File is disabled while recording.

#### Scenario: Automatic stop at five seconds
- **WHEN** the user starts a recording and does not stop it
- **THEN** recording stops when the elapsed time reaches 5.0 s (checked every 0.1 s) and the analysis starts

#### Scenario: Manual stop
- **WHEN** the user taps the sample and clicks Stop Recording after 1.8 s
- **THEN** the 1.8 s recording is analyzed and the results are shown

### Requirement: Recording Progress Display
The system SHALL show recording progress while recording: a pulsing "Recording..." indicator, an elapsed-time counter, a Stop Recording button in place of Start Recording, and a live oscilloscope view of the incoming waveform.

#### Scenario: During a recording
- **WHEN** 2.3 s have elapsed
- **THEN** the counter reads "2.3s / 5s" (one decimal, updated every 0.1 s)
- **AND** the oscilloscope shows the most recent 2048 input samples, amplitude -1..+1 spanning the view height, with a dashed center line

### Requirement: Recording Analysis Hand-off
The system SHALL, once recording stops, release the microphone, show an "Analyzing..." spinner, decode the recording at 48,000 Hz and run the analysis pipeline. If the recording holds no audio or cannot be decoded or analyzed, the system SHALL return to idle and show "Error processing audio. Please try again."

#### Scenario: Successful analysis
- **WHEN** the user stops a recording that contains taps
- **THEN** the microphone is released, "Analyzing..." is shown briefly, and the results state appears

#### Scenario: Empty recording
- **WHEN** the recording produced no audio data
- **THEN** the dialog returns to idle and shows "Error processing audio. Please try again."

### Requirement: Loading an Audio File
The system SHALL let the user analyze a WAV, MP3 or OGG file from the idle state instead of recording. The file is decoded, resampled to 48,000 Hz, converted to mono and run through the same analysis pipeline as a recording, with no length limit. The file picker is reset after each attempt so the same file can be chosen again.

#### Scenario: Format recognition
- **WHEN** the user picks a file
- **THEN** it is accepted if its name ends in ".wav", ".mp3" or ".ogg" or its media type contains "wav", "mpeg", "mp3" or "ogg"

#### Scenario: Stereo file
- **WHEN** the user uploads a stereo WAV tap recording
- **THEN** the channels are averaged sample by sample, `x[n] = (1/C) * sum over channels c of x_c[n]`, and the mono result is analyzed

#### Scenario: Unsupported file
- **WHEN** the user uploads a ".flac" file
- **THEN** the dialog shows "Unsupported audio format. Supported formats: WAV, MP3, OGG" and returns to idle

#### Scenario: Corrupt file
- **WHEN** a ".mp3" file cannot be decoded
- **THEN** the dialog shows "Failed to decode audio file: <reason>" and returns to idle

### Requirement: High-Pass Pre-Filter
The system SHALL pass every recording or loaded file through a 30 Hz high-pass filter before analysis to remove handling rumble. The filtered signal is the one analyzed, played back and exported.

#### Scenario: Filter definition
- **WHEN** audio is prepared for analysis
- **THEN** it is filtered by a second-order (12 dB/octave) biquad high-pass with cutoff fc = 30 Hz and resonance Q = 10^(1/20) ~= 1.122 (a 1 dB resonance setting), over the whole signal at its own sample rate, preserving length and channel count

#### Scenario: Handling noise below 30 Hz
- **WHEN** a recording contains strong 15 Hz handling noise and a 180 Hz tap resonance
- **THEN** the 15 Hz component is attenuated before analysis and the 180 Hz resonance is essentially unchanged

### Requirement: Spectrum Framing and Silence Gate
The system SHALL split the filtered signal into 50%-overlapping frames of N samples and skip silent frames. Here x[n] is the first channel of the filtered signal (full scale +/-1), L its length in samples and fs its sample rate (48,000 Hz).

#### Scenario: Frame layout
- **WHEN** the spectrum is computed
- **THEN** the FFT size is N = min(16384, 2^floor(log2(L))), so recordings shorter than 16384 samples (0.341 s at 48 kHz) use the largest power of two that fits
- **AND** the hop is H = N/2, the frame count is M = max(1, floor((L - N)/H) + 1), frame m covers samples m*H .. m*H + N - 1, and trailing samples that do not fill a frame are ignored

#### Scenario: Silent frames skipped
- **WHEN** a frame's RMS r_m = sqrt((1/N) * sum of x[n]^2 over the frame) is below 0.001 (about -60 dBFS)
- **THEN** that frame is excluded from the spectrum

### Requirement: Frame Spectrum Computation
The system SHALL compute each non-silent frame's single-sided linear magnitude spectrum with a Hamming window and 2/N amplitude scaling, so that levels and thresholds are expressed relative to digital full scale.

#### Scenario: Window and magnitude
- **WHEN** a frame is transformed
- **THEN** the window is w[n] = 0.54 - 0.46 * cos(2*pi*n/(N-1)) for n = 0..N-1
- **AND** the magnitude is A_m[k] = (2/N) * | sum for n = 0..N-1 of w[n] * x[m*H + n] * e^(-j*2*pi*k*n/N) | for k = 0..N/2-1
- **AND** a full-scale sine therefore reads about 0.54 (about -5.4 dB) because of the window's coherent gain

### Requirement: Spectrum Averaging and Fallbacks
The system SHALL average the magnitudes of all non-silent frames bin by bin (arithmetic mean of linear magnitudes), with fallbacks for very quiet or fully silent audio. No smoothing SHALL be applied to the result, so that narrow peaks keep full resolution.

#### Scenario: Normal averaging
- **GIVEN** a 2-second recording at 48 kHz containing two taps with silence between them
- **WHEN** the spectrum is computed
- **THEN** A[k] is the mean of A_m[k] over the frames whose RMS is at least 0.001

#### Scenario: Average too quiet
- **WHEN** 20*log10(max over all k of A[k]) < -80 dB
- **THEN** the spectrum of the single non-silent frame with the highest RMS is used instead of the average

#### Scenario: Everything silent
- **WHEN** every frame is below the silence gate
- **THEN** the spectrum of the first N samples, windowed, is used as the result

### Requirement: Analysis Frequency Range
The system SHALL keep only the spectrum bins between 30 Hz and 1000 Hz, each with its frequency, linear magnitude and level in dB.

#### Scenario: Output points
- **WHEN** the spectrum is reduced to the range of interest
- **THEN** with bin width df = fs/N, the bins k = ceil(30/df) .. floor(1000/df) inclusive are kept, with frequency f_k = k * df Hz, magnitude A[k] and level dB_k = 20*log10(max(A[k], 1e-10)) dB

#### Scenario: Standard 48 kHz capture
- **WHEN** a capture at 48,000 Hz is analyzed with N = 16384
- **THEN** df = 2.9296875 Hz and the result has 331 points (bins 11..341) from 32.2265625 Hz to 999.0234375 Hz

### Requirement: Peak Candidate Tests
The system SHALL treat an output point as a candidate peak only if it is a strict local maximum, at least -60 dB, and at least 3 dB prominent relative to the 10 points on each side. The first and last output points can never be peaks.

#### Scenario: Candidate rules
- **WHEN** point i (1 <= i <= count-2) with level dB_i is examined
- **THEN** it must satisfy dB_i > dB_(i-1), dB_i > dB_(i+1) and dB_i >= -60 dB
- **AND** with leftMin = min of dB_j for j = max(0, i-10) .. i-1 and rightMin = min of dB_j for j = i+1 .. min(count-1, i+10), its prominence dB_i - max(leftMin, rightMin) must be at least 3 dB

#### Scenario: Ripple rejected
- **WHEN** a local maximum at -45 dB rises only 2 dB above the higher of its two neighborhood minima
- **THEN** it is not a candidate

### Requirement: Peak Ranking and Limits
The system SHALL rank candidate peaks by level, keep only those within 35 dB of the strongest, keep at most 10, and automatically select the strongest. A peak's frequency is the frequency of its bin (no sub-bin interpolation), so resolution equals the bin width (2.93 Hz at 48 kHz). Each peak carries frequency (Hz), linear magnitude, level (dB) and a note label.

#### Scenario: Adaptive threshold
- **GIVEN** the strongest candidate is at -22 dB
- **WHEN** peaks are ranked
- **THEN** candidates below -57 dB are discarded

#### Scenario: Many resonances
- **WHEN** 14 candidates remain after the adaptive threshold
- **THEN** only the 10 loudest are kept, ordered loudest first, and the loudest is selected

### Requirement: Mobile Artifact Suppression
The system SHALL discard detected peaks from 132 Hz to 138 Hz inclusive when audio is captured or loaded on a mobile device, because Android browsers inject a spurious tone near 134.8 Hz. A device counts as mobile when its browser identification contains "android", "mobile" or "tablet" (case-insensitive) or the browser supports touch input. The exclusion runs after ranking and limits and before automatic selection.

#### Scenario: Android phone
- **GIVEN** the user records on an Android phone
- **WHEN** peaks are detected at 134.8 Hz and 182.5 Hz
- **THEN** only 182.5 Hz is offered and it is selected

#### Scenario: Desktop computer
- **WHEN** the same peaks are detected on a desktop browser without touch support
- **THEN** both peaks are offered

### Requirement: Musical Note Label
The system SHALL label each peak with the nearest equal-tempered note (A4 = 440 Hz), its octave and its deviation in cents, formatted "<name><octave> <sign><cents> c" with "+" for zero or positive cents.

#### Scenario: Note computation
- **WHEN** a peak at frequency f is labeled
- **THEN** s = 12*log2(f/440), n = round(s), the name is entry ((n + 9) mod 12, taken non-negative) of [C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B], the octave is 4 + floor((n + 9)/12), and cents = 1200*log2(f / (440 * 2^(n/12))) rounded to the nearest integer

#### Scenario: Example label
- **WHEN** the peak is 181.640625 Hz
- **THEN** the label reads "F#3 -32 c"

### Requirement: Spectrum Graph Axes
The system SHALL show the analyzed spectrum, once analysis completes, as a static line graph with a linear 30-1000 Hz frequency axis and a -100 to -20 dB level axis, captioned "Frequency Spectrum" with the hint "Click on a peak to select".

#### Scenario: Axes and grid
- **WHEN** results are shown
- **THEN** labeled vertical grid lines appear at 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 and 1000 Hz and labeled horizontal grid lines at -100, -80, -60, -40 and -20 dB
- **AND** the spectrum is drawn as a continuous line through all output points, with levels outside -100..-20 dB drawn at the nearest edge

### Requirement: Peak Markers
The system SHALL mark every detected peak on the graph with a vertical line from the peak to the frequency axis, a dot and a "<frequency> Hz" label with one decimal, visually distinguishing the strongest peak, the selected peak and the peak under the pointer.

#### Scenario: Results displayed
- **WHEN** analysis finds peaks at 181.6 Hz (strongest) and 92.8 Hz
- **THEN** markers labeled "181.6 Hz" and "92.8 Hz" are drawn
- **AND** the 181.6 Hz marker is emphasized as selected (solid line, larger dot, bold label) while the other uses a dashed line and small dot

### Requirement: Hover Readout and Snap
The system SHALL show the frequency under the pointer on the spectrum graph and SHALL snap to a detected peak when the pointer's frequency is within 20 Hz of it. The pointer position maps linearly onto 30-1000 Hz, clamped to that range. Leaving the graph removes the readout and the snap highlight.

#### Scenario: Pointer near a peak
- **WHEN** the pointer is at 175 Hz and the nearest peak is at 181.6 Hz
- **THEN** the 181.6 Hz marker is highlighted as the snap target (emphasized marker with a ring) and no cursor line is drawn

#### Scenario: Pointer far from peaks
- **WHEN** the pointer is at 600 Hz and the nearest peak is at 410.2 Hz
- **THEN** a vertical cursor line with the label "600.0 Hz" is drawn at the pointer

### Requirement: Peak Selection by Click
The system SHALL select a peak when the user clicks the graph: the snap target if there is one, otherwise the detected peak closest to the clicked frequency wherever the click lands. A frequency that is not a detected peak cannot be selected in the dialog.

#### Scenario: Click between peaks
- **WHEN** the user clicks the graph at 300 Hz and the detected peaks are 181.6 Hz and 410.2 Hz
- **THEN** 410.2 Hz is selected

### Requirement: Detected Peaks List
The system SHALL list, when more than one peak is detected, the first 5 peaks by level under "Detected Peaks" as buttons labeled "<frequency> Hz" with one decimal, the first suffixed "(highest)". Clicking a button selects that peak and the selected button is highlighted.

#### Scenario: Choose the second peak
- **GIVEN** detected peaks 181.6 Hz (strongest) and 92.8 Hz
- **WHEN** the user clicks the "92.8 Hz" button
- **THEN** 92.8 Hz becomes the selected peak

#### Scenario: Single peak
- **WHEN** only one peak is detected
- **THEN** no "Detected Peaks" list is shown

### Requirement: Selected Frequency Display
The system SHALL show a "Detected Frequency" panel with the selected peak's frequency (one decimal, "Hz"), its "Peak Level" in dB (one decimal) and its note label, showing "—" when nothing is selected. When the caller supplied a current value, a "Current Value" panel SHALL show it with two decimals and "Hz" for comparison.

#### Scenario: Compare with the existing value
- **GIVEN** the wood calculator's longitudinal field holds 180
- **WHEN** a capture selects 181.640625 Hz at -24.3 dB
- **THEN** "Current Value" shows "180.00 Hz" and "Detected Frequency" shows "181.6" Hz with peak level "-24.3 dB" and "F#3 -32 c"

### Requirement: No Peak Found
The system SHALL keep the dialog open in the results state when no peak survives detection, showing the spectrum graph without markers, "—" as the detected frequency and a disabled Confirm button. The system does not separately warn about clipping or low level.

#### Scenario: Tap too quiet
- **WHEN** a recording contains only faint room noise and no point reaches -60 dB with 3 dB prominence
- **THEN** the results show the spectrum with no markers, "—" as the detected frequency and a disabled Confirm button
- **AND** the user can Re-record or load another file

### Requirement: Error Banner
The system SHALL display operation failures in an error banner at the top of the dialog without closing it: microphone access, processing, file format or decoding, audio export ("Error generating audio file") and playback ("Error playing audio"). Starting a new recording or file load clears the banner.

#### Scenario: Export failure
- **WHEN** generating the WAV download fails
- **THEN** "Error generating audio file" is shown and the results remain on screen

### Requirement: Playback of the Captured Audio
The system SHALL let the user listen to the analyzed (high-pass-filtered) audio from the results state when that audio was captured or loaded in the current session. Play turns into Stop while playing; Stop or the end of the audio returns it to Play. Playback stops when the user re-records, cancels or closes the dialog.

#### Scenario: Listen to the tap
- **WHEN** the user clicks Play after a recording is analyzed
- **THEN** the filtered recording plays through the device speakers and the button reads Stop until playback ends

#### Scenario: Saved spectrum only
- **WHEN** the results come from a saved spectrum record
- **THEN** no Play button is shown, because audio is never persisted

### Requirement: Export of the Captured Audio
The system SHALL let the user download the analyzed (high-pass-filtered) audio as an uncompressed 16-bit PCM WAV file from the results state when that audio was captured or loaded in the current session. The file is generated locally; audio is never uploaded or stored by the system.

#### Scenario: File format
- **WHEN** the user clicks Download Audio
- **THEN** the file is RIFF/WAVE with a 44-byte header, PCM format code 1, 16 bits per sample, little-endian, the audio's channel count (interleaved) and sample rate, byte rate sampleRate*2*channels, block align 2*channels and data size samples*channels*2
- **AND** each sample is converted as s = clamp(x, -1, 1), stored as trunc(s*32768) when s < 0, else trunc(s*32767)

#### Scenario: File name
- **WHEN** the user clicks Download Audio on 2026-03-14 at 15:09:26 UTC after a 2 s recording at 48 kHz mono
- **THEN** a file named "wood-frequency-analysis-2026-03-14T15-09-26.wav" holding 96,000 samples at 48,000 Hz is downloaded

#### Scenario: Saved spectrum only
- **WHEN** the results come from a saved spectrum record
- **THEN** no Download Audio action is shown

### Requirement: Re-record
The system SHALL let the user discard the current results with a Re-record action, which clears the spectrum, peaks, selection and captured audio and returns to the idle state. Nothing is returned to the caller.

#### Scenario: Retry after a bad tap
- **WHEN** the user clicks Re-record on the results
- **THEN** the idle state (device selector, Start Recording, Upload Audio File) is shown with no selected frequency

### Requirement: Accepting a Frequency
The system SHALL, when the user clicks Confirm, return to the caller the selected peak frequency in Hz (unrounded) and, whenever a spectrum exists, a Tap-Tone Spectrum Record of the analyzed points with frequency <= 2000 Hz, then close the dialog. Confirm is enabled only in the results state with a peak selected. No downsampling is applied. The dialog returns no description.

#### Scenario: Confirm in the wood calculator
- **WHEN** the user confirms 181.640625 Hz for the longitudinal measurement
- **THEN** the dialog closes, the caller receives 181.640625 Hz and the 331-point spectrum record, and the field shows 181.6 (rounding and storage per `wood-panel-properties`)

#### Scenario: Confirm on a build step
- **WHEN** the user confirms a frequency from a build step
- **THEN** the caller receives the frequency and the spectrum record and then asks for a description as specified in `build-sequence`

#### Scenario: Nothing selected
- **WHEN** no peak is selected or the dialog is not showing results
- **THEN** the Confirm button is disabled

### Requirement: Cancelling the Dialog
The system SHALL discard everything and return nothing to the caller when the user clicks Cancel or the close button: an ongoing recording is stopped without analysis, the microphone is released and playback is stopped. Reopening afterwards starts from idle unless the caller supplies a saved spectrum.

#### Scenario: Cancel during recording
- **WHEN** the user clicks Cancel while recording
- **THEN** the recording is discarded, the microphone is released, the dialog closes and the caller's value is unchanged

### Requirement: Reopening With a Saved Spectrum
The system SHALL open directly in the results state when the caller supplies a saved spectrum record, re-detect peaks from it with the Peak Candidate Tests and Peak Ranking and Limits rules (without re-applying the mobile exclusion), and preselect the peak closest to the caller's non-zero current value, or else the strongest peak. Graph, list, hover and selection then behave as for a fresh capture.

#### Scenario: Revisit a measurement
- **GIVEN** the cross-grain field holds 92.8 and its spectrum was captured earlier
- **WHEN** the user opens the detector for the cross-grain field again
- **THEN** the saved spectrum is shown with its peaks and the peak with the smallest |f - 92.8| is preselected, without recording

#### Scenario: Replace a saved capture
- **WHEN** the user clicks Re-record on a reopened spectrum and confirms a new capture
- **THEN** the caller receives the new frequency and spectrum record

### Requirement: Tap-Tone Spectrum Record
The system SHALL represent a captured spectrum, wherever a caller persists it (per wood-panel measurement or per build-step analysis), as a self-contained record from which the graph and peak detection can be reproduced without the audio. Raw audio SHALL never be persisted.

#### Scenario: Record attributes
- **WHEN** a spectrum record is stored
- **THEN** it holds frequencies (list of numbers, Hz, ascending, spaced by binWidth), magnitudes (same length, linear amplitude as in Frame Spectrum Computation), magnitudesDb (same length, dB), sampleRate (Hz), fftSize (samples, power of two, at most 16384) and binWidth (Hz, = sampleRate / fftSize)

#### Scenario: Stored shape for a 48 kHz capture
- **WHEN** a 48 kHz capture of at least 0.341 s is confirmed
- **THEN** the record has sampleRate 48000, fftSize 16384, binWidth 2.9296875 and three lists of 331 numbers starting at 32.2265625 Hz

### Requirement: Fixed Analysis Parameters
The system SHALL NOT expose analysis parameters to the user; the only user choices are the input device, recording versus file input, recording length (up to 5 s) and the selected peak.

#### Scenario: Fixed values
- **WHEN** the user opens the dialog
- **THEN** no control for FFT size, thresholds, smoothing or frequency range is offered
- **AND** the values used are: 48,000 Hz mono capture with echo cancellation, noise suppression and auto-gain off; 5 s maximum recording; 30 Hz high-pass; FFT size 16384, Hamming window, 50% overlap; silence gate RMS 0.001; quiet fallback -80 dB; range 30-1000 Hz; no smoothing; peak floor -60 dB; prominence 3 dB over 10 bins per side; adaptive threshold 35 dB; at most 10 peaks (5 listed); mobile exclusion 132-138 Hz; snap distance 20 Hz; graph -100 to -20 dB

### Requirement: Localized Dialog Text
The system SHALL present all dialog text in English and French according to the user's language, including the title, help instructions, buttons, the "or" separator, state messages, panel captions, the "(highest)" suffix, unnamed-device names, caller-supplied measurement labels and all error messages.

#### Scenario: French user
- **GIVEN** the interface language is French
- **WHEN** the dialog opens
- **THEN** the title reads "Détecteur de fréquence" and the record button reads "Démarrer l'enregistrement"
