# tap-tone-capture Specification

## Purpose
A luthier taps a wood sample or an assembled guitar and the system records it through the browser's microphone (or reads an audio file), finds each tap, averages the usable taps into a spectrum, refines the resonant peaks and measures their spectral and decay Q. In Plate mode, used by the wood calculator (`wood-panel-properties`), the user records one take per plate mode and confirms the longitudinal, cross-grain and diagonal frequencies together. In Instrument mode, used by build steps (`build-sequence`), the system labels the Air, Top and Back resonances, which the user can correct, and returns the main peak with those roles. Each confirmed frequency comes with a compact copy of its spectrum.

## Requirements

### Requirement: Opening the Capture Dialog
The system SHALL provide a modal "Frequency Detector" dialog that a calling screen opens in one of two modes, Plate or Instrument, with a measurement label. In Plate mode the caller may also pass, per plate mode, a current frequency (Hz) and a saved spectrum record. The label is shown under the title. Opening the dialog SHALL NOT by itself trigger a microphone permission prompt. Clicking outside the dialog does not close it.

#### Scenario: Open from the wood calculator
- **WHEN** the user starts a plate measurement in the wood calculator
- **THEN** the dialog opens in Plate mode with three takes, "Longitudinal (f_L)", "Cross-grain (f_C)" and "Diagonal (f_LC)", the first one active
- **AND** the caller passes each field's current value and, where one exists, its saved spectrum record

#### Scenario: Open from a build step
- **WHEN** the user clicks "Add Analysis" on a build step named "Top bracing"
- **THEN** the dialog opens in Instrument mode with the label "Analysis for Top bracing", no current value and no saved spectrum

#### Scenario: Idle state contents
- **WHEN** a take without a saved spectrum is shown
- **THEN** it shows the input device selector, a Start Recording button, the hint "Max 10 seconds", an "or" separator and an Upload Audio File action
- **AND** the browser has not asked for microphone permission yet

### Requirement: Help Instructions
The system SHALL show usage instructions in a tooltip next to the dialog title, worded for the current mode, and in Plate mode SHALL also show under the active take how to hold and tap the plate for that mode.

#### Scenario: Hover the help icon
- **WHEN** the user hovers or focuses the help icon in Instrument mode
- **THEN** a panel titled "Instructions:" lists: damp the strings; wait a second before the first tap; tap the bridge firmly 3 to 5 times, about a second apart; stop the recording; check the detected taps and the Air, Top and Back labels; click a peak to select a different frequency

#### Scenario: Plate take guidance
- **WHEN** the Longitudinal take is active
- **THEN** it reads "Hold the plate lightly at 22.4% of its length from one end, near a long edge. Tap the middle of the plate."
- **AND** the Cross-grain take reads "Hold the plate lightly at 22.4% of its width from a long edge, near a short end. Tap the middle of the plate."
- **AND** the Diagonal take reads "Hold the plate lightly at the middle of one short end. Tap near a corner of the opposite end."

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

### Requirement: Recording Progress Display
The system SHALL show recording progress while recording: a pulsing "Recording..." indicator, an elapsed-time counter, a Stop Recording button in place of Start Recording, and a live oscilloscope view of the incoming waveform.

#### Scenario: During a recording
- **WHEN** 2.3 s have elapsed
- **THEN** the counter reads "2.3s / 10s" (one decimal, updated every 0.1 s)
- **AND** the oscilloscope shows the most recent 2048 input samples, amplitude -1..+1 spanning the view height, with a dashed center line

### Requirement: Recording Analysis Hand-off
The system SHALL, once recording stops, release the microphone, show an "Analyzing..." spinner, decode the recording at 48,000 Hz and run the analysis. If the recording holds no audio or cannot be decoded or analyzed, the take SHALL return to idle with "Error processing audio. Please try again."; if no tap is detected, it SHALL return to idle with "No tap detected. Tap the part firmly and try again."

#### Scenario: Successful analysis
- **WHEN** the user stops a recording that contains taps
- **THEN** the microphone is released, "Analyzing..." is shown briefly, and the results state appears

#### Scenario: Empty recording
- **WHEN** the recording produced no audio data
- **THEN** the take returns to idle and shows "Error processing audio. Please try again."

#### Scenario: Recording without a tap
- **WHEN** the user records 4 s of room noise without tapping
- **THEN** the take returns to idle and shows "No tap detected. Tap the part firmly and try again."

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

### Requirement: Analysis Frequency Range
The system SHALL keep only the bins of the tap spectrum between 30 Hz and 1000 Hz, each with its frequency, linear magnitude and level in dB.

#### Scenario: Output points
- **WHEN** the spectrum is reduced to the range of interest
- **THEN** with bin width df = fs/N (fs = 48,000 Hz sample rate, N = 32768 FFT size), the bins k = ceil(30/df) .. floor(1000/df) inclusive are kept, with frequency f_k = k * df Hz, magnitude A[k] and level dB_k = 20*log10(max(A[k], 1e-10)) dB

#### Scenario: Standard 48 kHz capture
- **WHEN** a capture at 48,000 Hz is analyzed
- **THEN** df = 1.46484375 Hz and the result has 662 points (bins 21..682) from 30.76171875 Hz to 999.0234375 Hz

### Requirement: Peak Candidate Tests
The system SHALL treat an output point as a candidate peak only if it is a strict local maximum, at least -60 dB, and at least 3 dB prominent relative to the points within 30 Hz on each side. The first and last output points can never be peaks.

#### Scenario: Candidate rules
- **WHEN** point i (1 <= i <= count-2) with level dB_i is examined
- **THEN** it must satisfy dB_i > dB_(i-1), dB_i > dB_(i+1) and dB_i >= -60 dB
- **AND** with leftMin = min of dB_j over the points j < i with f_i - f_j <= 30 Hz (20 points at 48 kHz) and rightMin = min of dB_j over the points j > i with f_j - f_i <= 30 Hz, its prominence dB_i - max(leftMin, rightMin) must be at least 3 dB

#### Scenario: Ripple rejected
- **WHEN** a local maximum at -45 dB rises only 2 dB above the higher of its two neighborhood minima
- **THEN** it is not a candidate

### Requirement: Peak Ranking and Limits
The system SHALL refine each candidate per Sub-Bin Peak Refinement, rank candidates by refined level, keep only those within 35 dB of the strongest, keep at most 10, and automatically select the strongest. Each peak carries its refined frequency (Hz), refined level (dB), the linear magnitude of its bin, a note label, a spectral Q and a decay Q.

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
The system SHALL show the analyzed spectrum, once analysis completes, as a static line graph with a linear 30-600 Hz frequency axis and a -100 to 0 dB level axis, captioned "Frequency Spectrum" with the hint "Click on a peak to select". Spectrum points above 600 Hz are kept by analysis but not drawn.

#### Scenario: Axes and grid
- **WHEN** results are shown
- **THEN** labeled vertical grid lines appear at 50, 100, 200, 300, 400, 500 and 600 Hz and labeled horizontal grid lines at -100, -80, -60, -40, -20 and 0 dB
- **AND** the spectrum is drawn as a continuous line through all output points between 30 and 600 Hz, with levels outside -100..0 dB drawn at the nearest edge

### Requirement: Peak Markers
The system SHALL mark every detected peak between 30 and 600 Hz on the graph with a vertical line from the peak to the frequency axis, a dot and a "<frequency> Hz" label with one decimal, visually distinguishing the strongest peak, the selected peak and the peak under the pointer. Detected peaks above 600 Hz get no marker.

#### Scenario: Results displayed
- **WHEN** analysis finds peaks at 181.6 Hz (strongest) and 92.8 Hz
- **THEN** markers labeled "181.6 Hz" and "92.8 Hz" are drawn
- **AND** the 181.6 Hz marker is emphasized as selected (solid line, larger dot, bold label) while the other uses a dashed line and small dot

#### Scenario: Peak beyond the axis
- **WHEN** analysis finds peaks at 720.4 Hz (strongest) and 181.6 Hz
- **THEN** only the "181.6 Hz" marker is drawn
- **AND** 720.4 Hz still appears in the Detected Peaks list

### Requirement: Hover Readout and Snap
The system SHALL show the frequency under the pointer on the spectrum graph and SHALL snap to a detected peak drawn on the graph when the pointer's frequency is within 20 Hz of it. The pointer position maps linearly onto 30-600 Hz, clamped to that range. Leaving the graph removes the readout and the snap highlight.

#### Scenario: Pointer near a peak
- **WHEN** the pointer is at 175 Hz and the nearest peak is at 181.6 Hz
- **THEN** the 181.6 Hz marker is highlighted as the snap target (emphasized marker with a ring) and no cursor line is drawn

#### Scenario: Pointer far from peaks
- **WHEN** the pointer is at 600 Hz and the nearest peak is at 410.2 Hz
- **THEN** a vertical cursor line with the label "600.0 Hz" is drawn at the pointer

### Requirement: Peak Selection by Click
The system SHALL select a peak when the user clicks the graph: the snap target if there is one, otherwise the detected peak drawn on the graph closest to the clicked frequency wherever the click lands. A frequency that is not a detected peak cannot be selected in the dialog.

#### Scenario: Click between peaks
- **WHEN** the user clicks the graph at 300 Hz and the detected peaks are 181.6 Hz and 410.2 Hz
- **THEN** 410.2 Hz is selected

#### Scenario: Click near the right edge
- **WHEN** the user clicks the graph at 600 Hz and the detected peaks are 720.4 Hz and 410.2 Hz
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
The system SHALL show a "Detected Frequency" panel with the selected peak's frequency (one decimal, "Hz"), "Peak Level" (dB, one decimal), note label, "Spectral Q" and "Decay Q" (no decimals), showing "—" for a value that is missing and the reason for a missing Q. When the caller supplied a current value for the take, a "Current Value" panel SHALL show it with two decimals and "Hz".

#### Scenario: Compare with the existing value
- **GIVEN** the wood calculator's longitudinal field holds 180
- **WHEN** a Longitudinal take selects a peak refined to 181.82 Hz at -19.9 dB with spectral Q 64.3 and decay Q 71.8
- **THEN** "Current Value" shows "180.00 Hz" and "Detected Frequency" shows "181.8" Hz, peak level "-19.9 dB", "F#3 -30 c", spectral Q "64" and decay Q "72"

#### Scenario: Saved spectrum has no decay Q
- **WHEN** the take shows a saved spectrum record
- **THEN** "Decay Q" shows "—" with the reason "Needs the recording; record the take again to measure it"

### Requirement: No Peak Found
The system SHALL keep the take in the results state when no peak survives detection, showing the waveform with its taps, the spectrum graph without markers, "—" as the detected frequency, and no selection for that take. Rejected taps show their rejection reasons, so a clipped or cut-off recording is explained.

#### Scenario: Tap too quiet
- **WHEN** a recording contains one faint tap and no point reaches -60 dB with 3 dB prominence
- **THEN** the results show the spectrum with no markers and "—" as the detected frequency, and the take has nothing to confirm
- **AND** the user can Re-record or load another file

### Requirement: Error Banner
The system SHALL display operation failures in an error banner at the top of the dialog without closing it: microphone access, processing, no tap detected, file format or decoding, audio export ("Error generating audio file") and playback ("Error playing audio"). Starting a new recording or file load clears the banner.

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
The system SHALL let the user discard the active take's results with a Re-record action, which clears that take's taps, spectrum, peaks, selection, roles and captured audio and returns the take to idle. Other Plate takes are kept. Nothing is returned to the caller.

#### Scenario: Retry after a bad tap
- **WHEN** the user clicks Re-record on the Cross-grain take's results
- **THEN** the Cross-grain take shows the idle state (device selector, Start Recording, Upload Audio File) with no selected frequency
- **AND** the Longitudinal and Diagonal takes keep their results

### Requirement: Accepting a Frequency
The system SHALL, when the user clicks Confirm, return the mode's result to the caller and close the dialog. Plate mode returns each take that has a selected peak; Instrument mode returns the selected main peak and the body roles. Each frequency is unrounded and comes with the take's Tap-Tone Spectrum Record. Confirm is enabled only when there is something to return.

#### Scenario: Confirm in the wood calculator
- **GIVEN** the Longitudinal take selected 181.82 Hz and the Cross-grain take selected 92.71 Hz, and the Diagonal take was not recorded
- **WHEN** the user clicks Confirm
- **THEN** the caller receives, for Longitudinal and Cross-grain, the frequency, the take's spectrum record, its spectral Q and its decay Q (each possibly missing), and nothing for Diagonal

#### Scenario: Confirm on a build step
- **WHEN** the user confirms with the main peak at 196.94 Hz, Air at 98.41 Hz, Top at 196.94 Hz and Back not identified
- **THEN** the caller receives the main frequency 196.94 Hz, the spectrum record and the roles Air and Top, each with frequency (Hz), level (dB), spectral Q, decay Q and whether it was found automatically or set by the user
- **AND** the caller then asks for a description as specified in `build-sequence`

#### Scenario: Nothing selected
- **WHEN** no take has a selected peak
- **THEN** the Confirm button is disabled

### Requirement: Cancelling the Dialog
The system SHALL discard everything and return nothing to the caller when the user clicks Cancel or the close button: an ongoing recording is stopped without analysis, an ongoing analysis is abandoned, the microphone is released and playback is stopped. Reopening afterwards starts from idle unless the caller supplies saved spectra.

#### Scenario: Cancel during recording
- **WHEN** the user clicks Cancel while recording
- **THEN** the recording is discarded, the microphone is released, the dialog closes and the caller's values are unchanged

#### Scenario: Cancel during analysis
- **GIVEN** the user loaded a long audio file and the take shows "Analyzing..."
- **WHEN** the user clicks Cancel
- **THEN** the dialog closes at once, the analysis result is discarded when it completes, and the caller's values are unchanged
- **AND** reopening the dialog shows the idle state, not the discarded results

### Requirement: Reopening With a Saved Spectrum
The system SHALL open a Plate take directly in the results state when the caller supplies a saved spectrum record for it. Peaks are re-detected from the record with the Peak Candidate Tests, Sub-Bin Peak Refinement, Peak Ranking and Limits and Spectral Q rules, without the mobile exclusion. The peak closest to the take's non-zero current value is preselected, or else the strongest. Instrument mode never reopens.

#### Scenario: Revisit a measurement
- **GIVEN** the cross-grain field holds 92.7 and its spectrum was captured earlier
- **WHEN** the user starts a plate measurement again
- **THEN** the Cross-grain take shows the saved spectrum with its peaks, the peak with the smallest |f - 92.7| is preselected, no waveform is shown, and nothing is recorded

#### Scenario: Older 16384-point record
- **WHEN** a saved record has fftSize 16384 and binWidth 2.9296875 Hz
- **THEN** peaks are re-detected on its own points, with the 30 Hz prominence neighborhood covering 10 points per side

#### Scenario: Replace a saved capture
- **WHEN** the user clicks Re-record on a reopened take and confirms a new capture
- **THEN** the caller receives the new frequency and spectrum record for that take

### Requirement: Tap-Tone Spectrum Record
The system SHALL represent a captured spectrum, wherever a caller persists it (per wood-panel measurement or per build-step analysis), as a self-contained record from which the graph and peak detection can be reproduced without the audio. Raw audio SHALL never be persisted.

#### Scenario: Record attributes
- **WHEN** a spectrum record is stored
- **THEN** it holds frequencies (list of numbers, Hz, ascending, spaced by binWidth), magnitudes (same length, linear amplitude as in Tap Spectrum), magnitudesDb (same length, dB), sampleRate (Hz), fftSize (samples, power of two, at most 32768) and binWidth (Hz, = sampleRate / fftSize)

#### Scenario: Stored shape for a 48 kHz capture
- **WHEN** a 48 kHz take is confirmed
- **THEN** the record has sampleRate 48000, fftSize 32768, binWidth 1.46484375 and three lists of 662 numbers starting at 30.76171875 Hz

### Requirement: Fixed Analysis Parameters
The system SHALL NOT expose analysis parameters to the user; the only user choices are the input device, recording versus file input, recording length (up to 10 s), which detected taps to use, the selected peak, and in Instrument mode the body role labels.

#### Scenario: Fixed values
- **WHEN** the user opens the dialog
- **THEN** no control for FFT size, window, thresholds, smoothing or frequency range is offered
- **AND** the values used are: 48,000 Hz mono capture with processing off; 10 s maximum recording; 30 Hz high-pass; tap blocks of 240 samples, threshold max(0.001, 10 x noise floor), 12 dB rise, 100 ms debounce, at most 50 taps; tap window 32768 samples starting 8192 before the onset, Hann; power averaging; range 30-1000 Hz; peak floor -60 dB; prominence 3 dB within 30 Hz; adaptive threshold 35 dB; at most 10 peaks (5 listed); parabolic refinement; Q bandwidth level -3 dB within 50 Hz; decay Q constants as in Mode Isolation, Decay Noise Floor, Decay Fit Interval, Decay Fit Quality and Decay Q Across Taps; mobile exclusion 132-138 Hz; snap distance 20 Hz; graph -100 to 0 dB

### Requirement: Localized Dialog Text
The system SHALL present all dialog text in English and French according to the user's language, including the title, help instructions and plate guidance, take and role names, buttons, the "or" separator, state messages, panel captions, tap rejection and Q reasons, the "(highest)" suffix, unnamed-device names, caller-supplied measurement labels and all error messages.

#### Scenario: French user
- **GIVEN** the interface language is French
- **WHEN** the dialog opens
- **THEN** the title reads "Détecteur de fréquence" and the record button reads "Démarrer l'enregistrement"
- **AND** the Instrument roles read "Air", "Table" and "Fond"

### Requirement: Recording Length
The system SHALL record continuously from Start Recording until the user clicks Stop Recording or 10.0 seconds have elapsed. There is no recording trigger: recording starts immediately and the user taps the part one or more times; the taps are found afterwards by Tap Detection. Upload Audio File is disabled while recording. In Plate mode a recording belongs to the active take only.

#### Scenario: Automatic stop at ten seconds
- **WHEN** the user starts a recording and does not stop it
- **THEN** recording stops when the elapsed time reaches 10.0 s (checked every 0.1 s) and the analysis starts

#### Scenario: Manual stop
- **WHEN** the user taps the part three times and clicks Stop Recording after 3.4 s
- **THEN** the 3.4 s recording is analyzed and the results are shown

### Requirement: Tap Detection
The system SHALL find the taps in an analyzed recording or file by their onsets in the filtered signal, using a level threshold derived from the recording's own noise floor and a sudden-rise test. Only the first 50 onsets are used.

#### Scenario: Onset rule
- **GIVEN** x[n] is the first channel of the filtered signal (full scale +/-1) cut into blocks of B = 240 samples (5 ms at 48 kHz), r_b is block b's RMS, and the noise floor nf is the 10th percentile of all r_b
- **WHEN** the threshold is T = max(0.001, 10 * nf)
- **THEN** block b is an onset when r_b >= T and r_b >= 4 * max(r_(b-1), r_(b-2), r_(b-3), r_(b-4)), with missing blocks counted as 0, and at least 20 blocks (100 ms) after the previous onset
- **AND** the tap's onset sample is s = b * B

#### Scenario: Three taps
- **GIVEN** a 4 s recording at 48 kHz with taps starting at 0.50 s, 1.60 s and 2.75 s over noise at RMS 0.0002
- **WHEN** taps are detected
- **THEN** three taps are found, at onset samples 24000, 76800 and 132000

#### Scenario: A double hit counts once
- **WHEN** the part is struck twice 40 ms apart
- **THEN** one tap is detected

### Requirement: Tap Acceptance
The system SHALL reject automatically, with a reason, a tap that clips, that overlaps another tap or that is cut off by the end of the audio, and SHALL let the user exclude or re-include any other tap. Only accepted taps that the user did not exclude are used; the spectrum, peaks, Q values and roles are recomputed whenever this set changes.

#### Scenario: Rejection rules
- **GIVEN** a tap with onset sample s in a signal of L samples
- **WHEN** taps are checked
- **THEN** it is rejected as "Clipped" when any unfiltered sample of any channel in s .. s + 2399 (50 ms) has |x| >= 0.999
- **AND** as "Too close to another tap" when another onset lies in s - 8192 .. s + 24575 (its spectrum window)
- **AND** as "Cut off by the end of the recording" when s + 12000 > L (less than 250 ms after the onset)

#### Scenario: Excluding a tap
- **GIVEN** taps 1, 2 and 3 are accepted
- **WHEN** the user excludes tap 2
- **THEN** the spectrum is the average of taps 1 and 3 only and the waveform shows "2 of 3 taps used"

#### Scenario: Nothing usable
- **WHEN** every detected tap is rejected or excluded
- **THEN** the waveform shows the taps and their reasons, no spectrum is drawn, and "None of the taps can be used" is shown in place of the graph

### Requirement: Waveform With Taps
The system SHALL show, in the results of a recorded or loaded take, the filtered waveform of the whole audio with a marker at each detected tap, distinguishing used, excluded and rejected taps. Activating the marker of a used or excluded tap toggles it; a rejected tap's reason is shown on hover, focus or tap and it cannot be included.

#### Scenario: Waveform display
- **WHEN** a 3.4 s recording with three taps is analyzed
- **THEN** the waveform spans 0 to 3.4 s with time labels in seconds, each tap is numbered 1..3 at its onset, and its spectrum window is shaded

#### Scenario: Keyboard toggle
- **WHEN** the user focuses tap 2's marker and presses Space
- **THEN** tap 2 is excluded and announced as "Tap 2 excluded"

### Requirement: Tap Spectrum
The system SHALL compute each used tap's single-sided magnitude spectrum over a Hann-windowed 32768-sample window that starts 8192 samples before its onset, normalized so that a full-scale sine centred on a bin reads 1.0 (0 dB), and SHALL combine the used taps by averaging power bin by bin. No smoothing is applied.

#### Scenario: Window and magnitude
- **GIVEN** N = 32768, a tap with onset sample s, and x[n] the first channel of the filtered signal with x[n] = 0 outside the audio
- **WHEN** the tap is transformed
- **THEN** the window is w[n] = 0.5 - 0.5 * cos(2*pi*n/(N-1)) for n = 0..N-1, with sum S = sum of w[n]
- **AND** the magnitude is A_t[k] = (2/S) * | sum for n = 0..N-1 of w[n] * x[s - 8192 + n] * e^(-j*2*pi*k*n/N) | for k = 0..N/2-1

#### Scenario: Power average
- **WHEN** taps t = 1..T are used
- **THEN** A[k] = sqrt( (1/T) * sum over t of A_t[k]^2 )

#### Scenario: Calibration of the scale
- **WHEN** the window holds a full-scale sine at exactly 375 Hz (bin 256)
- **THEN** A[256] reads 1.0 within 0.001 (0.0 dB)

### Requirement: Sub-Bin Peak Refinement
The system SHALL refine each candidate peak's frequency and level by fitting a parabola through the dB levels of its point and its two neighbours, limiting the offset to half a bin.

#### Scenario: Refinement formula
- **GIVEN** a candidate at point i with bin k, bin width df (Hz) and levels a = dB_(i-1), b = dB_i, c = dB_(i+1)
- **WHEN** it is refined
- **THEN** d = 0.5 * (a - c) / (a - 2b + c), clamped to -0.5..0.5 (bins)
- **AND** the frequency is (k + d) * df Hz and the level is b - 0.25 * (a - c) * d dB

#### Scenario: Worked example
- **GIVEN** df = 1.46484375 Hz, k = 124 and levels -30, -20 and -26 dB
- **WHEN** the peak is refined
- **THEN** d = 0.125, the frequency is 181.82373046875 Hz (shown "181.8 Hz") and the level is -19.875 dB

#### Scenario: Accuracy on a synthetic tone
- **WHEN** a single decaying tap at 182.3 Hz (tau 0.15 s) is analyzed
- **THEN** the refined peak lies within 0.2 Hz of 182.3 Hz

### Requirement: Spectral Q
The system SHALL compute each peak's spectral Q as its refined frequency divided by its -3 dB bandwidth, found on the spectrum within 50 Hz of the peak, and SHALL report no spectral Q when either -3 dB point is not found or the bandwidth is below 0.1 Hz.

#### Scenario: Bandwidth points
- **GIVEN** the peak's refined frequency f0 (Hz) and refined level A0 (dB), linear amplitudes a_j = 10^(dB_j/20) and threshold T = 10^((A0 - 3)/20)
- **WHEN** the lower point is searched from the peak's point downwards, no further than f0 - 50 Hz
- **THEN** at the first point j with a_j <= T, f_low = f_j + (T - a_j) / (a_(j+1) - a_j) * df
- **AND** the upper point is searched upwards in the same way, no further than f0 + 50 Hz, giving f_high by linear interpolation between the last point above T and the first at or below it
- **AND** BW = f_high - f_low (Hz) and spectral Q = f0 / BW

#### Scenario: Example
- **GIVEN** a peak at f0 = 200 Hz whose -3 dB points interpolate to 195 Hz and 205 Hz
- **WHEN** spectral Q is computed
- **THEN** BW = 10 Hz and spectral Q = 20

#### Scenario: Not determinable
- **WHEN** the spectrum never falls 3 dB below the peak within 50 Hz above it
- **THEN** "Spectral Q" shows "—" with the reason "The peak is too broad or merges with a neighbour"

### Requirement: Plate Mode Takes
The system SHALL, in Plate mode, offer three takes, Longitudinal (f_L), Cross-grain (f_C) and Diagonal (f_LC), each recorded, analyzed, re-recorded and reopened on its own. In each take the strongest peak is selected automatically and the user may select any other detected peak. The take selector shows each take's selected frequency or "—".

#### Scenario: Measure the three modes
- **GIVEN** the Longitudinal take selected 181.8 Hz
- **WHEN** the user switches to the Cross-grain take, records it and the strongest peak is 92.7 Hz
- **THEN** the take selector reads "Longitudinal 181.8 Hz", "Cross-grain 92.7 Hz" and "Diagonal —"

#### Scenario: Recording is per take
- **WHEN** a recording is in progress on one take
- **THEN** switching to another take is disabled until the recording stops

### Requirement: Instrument Body Resonance Candidates
The system SHALL, in Instrument mode, find body resonance candidates in the tap spectrum with fixed settings: strict local maxima over 60-400 Hz within 30 dB of the strongest such maximum, with at least 6 dB prominence against the points within 30 Hz on each side, and 3 bins of spacing. Each candidate's frequency and level are refined per Sub-Bin Peak Refinement and its spectral Q computed per Spectral Q.

#### Scenario: Candidate rules
- **GIVEN** points in 60-400 Hz with levels dB_k in bin order
- **WHEN** candidates are searched
- **THEN** point k qualifies when dB_k is strictly greater than dB_(k-j) and dB_(k+j) for j = 1..3, dB_k >= (strongest qualifying level) - 30 dB, and dB_k - max(L, R) >= 6 dB, where L (R) is the lowest of dB_k and the points below (above) it with |f - f_k| <= 30 Hz
- **AND** scanning from low to high frequency, a point fewer than 3 bins from an accepted candidate is skipped

#### Scenario: Weak peak rejected
- **GIVEN** the strongest candidate between 60 and 400 Hz is at -20 dB
- **WHEN** candidates are found
- **THEN** a peak at -52 dB is not a candidate

#### Scenario: Damped mode accepted
- **GIVEN** a phone recording of an assembled body with resonances at 103.6 Hz, 186.7 Hz and 223.1 Hz, where the 223.1 Hz mode has a spectral Q of about 15 and falls only 2.3 dB within 8.8 Hz but more than 10 dB within 30 Hz
- **WHEN** candidates are found and roles assigned
- **THEN** 223.1 Hz is a candidate and is labelled Back, not the weaker peak at 300.3 Hz

### Requirement: Instrument Body Resonance Assignment
The system SHALL assign the roles Air, T(1,1)1, Top, T(1,1)2, and Back, T(1,1)3, by mode order: Air is the lowest candidate from 70 to 130 Hz; Top the lowest from max(140 Hz, 1.4 x f_air) to 300 Hz; Back the candidate from f_top + 15 Hz to 400 Hz closest to one octave above the air resonance, 2 x f_air, measured as a frequency ratio, the lower one on a tie. Each role's label is drawn on the spectrum at its frequency.

#### Scenario: Typical assembled body
- **GIVEN** candidates at 98.4 Hz, 196.9 Hz and 247.5 Hz, each with a spectral Q
- **WHEN** roles are assigned
- **THEN** Air is 98.4 Hz, Top is 196.9 Hz and Back is 247.5 Hz, and the labels "Air", "Top" and "Back" mark those peaks

#### Scenario: Candidate too close above the air resonance
- **GIVEN** candidates at 110 Hz, 150 Hz, 212 Hz and 262 Hz, each with a spectral Q
- **WHEN** roles are assigned
- **THEN** Air is 110 Hz, Top is 212 Hz (150 Hz is below 1.4 x 110 = 154 Hz) and Back is 262 Hz

#### Scenario: Back near the air octave rather than just above Top
- **GIVEN** candidates at 100 Hz, 150 Hz, 170 Hz and 205 Hz, each with a spectral Q
- **WHEN** roles are assigned
- **THEN** Air is 100 Hz, Top is 150 Hz and Back is 205 Hz, the candidate above Top nearest 2 x 100 = 200 Hz, not 170 Hz

### Requirement: Instrument Body Resonance Reliability
The system SHALL report a role as not identified, rather than guess, when no candidate lies in its range, when the chosen candidate has no spectral Q, or when another candidate lies within 15 Hz of it. Top requires an identified Air and Back requires an identified Top. A role that is not identified shows "Not identified" in the roles panel.

#### Scenario: Free plate on a build step
- **GIVEN** a free-plate spectrum with candidates at 152 Hz and 233 Hz only
- **WHEN** roles are assigned
- **THEN** Air, Top and Back are all not identified, and the user can still select and confirm a main peak

#### Scenario: Split peak
- **GIVEN** air-range candidates at 96 Hz and 108 Hz
- **WHEN** roles are assigned
- **THEN** Air is not identified, and neither are Top and Back

### Requirement: Manual Role Assignment
The system SHALL let the user, in Instrument mode, set a role to any detected peak or clear it, by dragging the role's label onto a peak or, with keyboard or touch, by choosing the role in the roles panel and then a peak. A role set this way is marked as set by the user and is no longer changed by automatic assignment until the take is re-recorded.

#### Scenario: Correct the Top label
- **GIVEN** Top was assigned automatically to 212.0 Hz and a peak exists at 204.6 Hz
- **WHEN** the user drags the "Top" label onto the 204.6 Hz peak
- **THEN** Top becomes 204.6 Hz with that peak's level, spectral Q and decay Q, and the roles panel marks it "set by you"

#### Scenario: Clear a role
- **WHEN** the user clears Back in the roles panel
- **THEN** Back shows "Not identified" and is not returned on Confirm

#### Scenario: Excluding a tap keeps manual roles
- **GIVEN** the user set Top to 204.6 Hz
- **WHEN** the user excludes a tap and the spectrum is recomputed
- **THEN** Top stays on the detected peak nearest 204.6 Hz within 3 Hz, or becomes "Not identified" if there is none

### Requirement: Spectrum Record Validation
The server SHALL refuse to store a Tap-Tone Spectrum Record that is malformed or oversized, wherever a caller persists one, and SHALL store nothing from that request. A refused record is reported to the user as the caller's usual save failure.

#### Scenario: Accepted record
- **WHEN** a client stores a 48 kHz record with sampleRate 48000, fftSize 32768, binWidth 1.46484375 and three lists of 662 numbers from 30.76171875 Hz to 999.0234375 Hz
- **THEN** the record is stored unchanged

#### Scenario: Older record still accepted
- **WHEN** a record with fftSize 16384, binWidth 2.9296875 and 331 points is stored
- **THEN** it is accepted

#### Scenario: Shape rules
- **WHEN** a client stores a record
- **THEN** it is refused unless frequencies, magnitudes and magnitudesDb are lists of numbers with the same length, from 1 to 1024 entries
- **AND** unless the frequencies are strictly ascending, greater than 0 Hz and at most 2000 Hz, and every magnitude is at least 0
- **AND** unless sampleRate is a number greater than 0 (Hz), fftSize is a power of two no larger than 32768 (samples), and binWidth (Hz) equals sampleRate / fftSize to within one part in a billion

#### Scenario: Oversized record
- **WHEN** a modified client stores a record with 5000 points on a build step
- **THEN** the step change is refused, the step keeps its earlier measurements, and the user sees "Failed to save changes"

### Requirement: Decay Q Measurement
The system SHALL measure, for every detected peak and every used tap, the decay Q of that resonance from the tap's own ring-down: it isolates the resonance, takes its amplitude envelope, fits an exponential decay over an interval set by the tap contact and the noise floor, and checks the fit. Each tap yields either a decay Q with its time constant, or a reason code explaining why none can be given.

#### Scenario: Decay Q definition
- **GIVEN** a fitted amplitude time constant tau in seconds and the peak frequency f0 in Hz
- **WHEN** the decay Q is computed
- **THEN** Q_d = pi * f0 * tau
- **AND** for f0 = 180 Hz and tau = 0.2 s, Q_d = 113.1

#### Scenario: Analysis segment of a tap
- **GIVEN** a tap with onset sample o, the next detected onset o_next (or none), recording length n_end samples, fs = 48000 Hz
- **WHEN** the segment is cut
- **THEN** it spans samples o to min(o_next - 480, n_end, o + 144000) - 1 (480 samples = 10 ms, 144000 = 3.0 s)
- **AND** for o = 48000 and o_next = 120000 the segment holds 71520 samples (1.49 s)

#### Scenario: Clean single resonance
- **GIVEN** a tap x(t) = 0.5 * exp(-t / 0.2) * sin(2*pi*180*t) plus white Gaussian noise of RMS 0.001, 1.5 s long, a quiet stretch of 2 s of the same noise, and a peak at f0 = 180 Hz with no other peak
- **WHEN** the decay Q of the tap is measured
- **THEN** tau = 0.200 s within 1 % and Q_d = 113.1 within 1 %
- **AND** the fit ends because the envelope reaches the noise margin, near t = 1.29 s

### Requirement: Mode Isolation
The system SHALL isolate each peak with a linear-phase finite band-pass filter centred on the peak frequency, whose length is set by the distance to the nearest relevant neighbouring peak, and SHALL refuse the peak as not isolated when a neighbour is too close for the filter to separate them before the resonance has died away.

#### Scenario: Choosing the filter length
- **GIVEN** a peak at f0 (Hz) with level L0 (dB), other peaks f_n with levels L_n
- **WHEN** the isolation filter is chosen
- **THEN** relevant neighbours are peaks with f_n != f0 and L_n >= L0 - 30 dB
- **AND** d_min = min(2 * f0, min |f_n - f0| over relevant neighbours) in Hz
- **AND** T_h = max(0.02, 3.5 / d_min) seconds, and the kernel has M = 2 * round(T_h * 500) + 1 taps at 1000 Hz
- **AND** for f0 = 180 Hz with a relevant neighbour at 192 Hz, d_min = 12 Hz, T_h = 0.2917 s and M = 293

#### Scenario: Filter chain
- **GIVEN** a segment s[n], n = 0..L-1, fs = 48000 Hz
- **WHEN** the resonance is isolated
- **THEN** z[n] = s[n] * exp(-j*2*pi*f0*n/fs)
- **AND** z is smoothed by four cascaded 48-sample moving averages (each scaled by 1/48) and every 48th output kept, sample k centred at t_k = (48*k + 94)/48000 s
- **AND** the result is convolved with the normalised Blackman kernel w[m] = 0.42 - 0.5*cos(2*pi*m/(M-1)) + 0.08*cos(4*pi*m/(M-1)), m = 0..M-1, centred on t_k
- **AND** the envelope is e[k] = 2 * |y[k]|, kept only where the whole filter support lies inside the segment

#### Scenario: Neighbour too close
- **GIVEN** relevant peaks at 200.0 Hz and 205.0 Hz
- **WHEN** the 200.0 Hz peak is analysed
- **THEN** 3.5 / 5.0 = 0.7 s exceeds 0.5 s and the peak result is MODE_NOT_ISOLATED with neighbour 205.0 Hz and spacing 5.0 Hz
- **AND** with the neighbour at 207.0 Hz (spacing 7.0 Hz, T_h = 0.5 s) the peak is analysed

#### Scenario: Broad resonance next to a neighbour
- **GIVEN** a peak at 180 Hz with spectral bandwidth BW = 20 Hz and a relevant neighbour at 190 Hz, so T_h = 0.35 s
- **WHEN** the bandwidth pre-check runs
- **THEN** t_s0 = 0.005 + 0.35/2 + 0.00196 = 0.182 s and P = 27.29 * BW * t_s0 = 99 dB, above 30 dB, so the result is MODE_NOT_ISOLATED
- **AND** with BW = 2 Hz, P = 9.9 dB and the peak is analysed

### Requirement: Decay Noise Floor
The system SHALL estimate, for each peak, the background noise level in that peak's isolation band from the quiet parts of the recording, fall back to the quietest tap tails when the quiet parts are too short, and refuse the peak when neither exists. The decay fit SHALL stop well above this noise floor.

#### Scenario: Noise floor from quiet stretches
- **GIVEN** the isolation chain applied to every quiet stretch, yielding envelope values e (only where the filter support is inside the stretch), total duration T_q seconds, kernel length T_he seconds
- **WHEN** T_q >= max(0.1, 3 * T_he)
- **THEN** N = sqrt(median(e^2) / ln 2) and the noise source is "quiet"
- **AND** N_eff = max(N, 0.000001) and the fit end threshold is e_thr = 10 * N_eff (20 dB above)
- **AND** for 2 s of white Gaussian noise of RMS 0.001 and T_he = 0.02 s, N is within 1.5 dB of 0.000085

#### Scenario: Quiet stretches
- **GIVEN** the onsets of all detected taps, o_1 (first) to o_last (last), in samples, and n_end the recording length
- **WHEN** the quiet stretches are taken
- **THEN** they are samples 0 .. o_1 - 481 and samples o_last + 144000 .. n_end - 1 (3.0 s after the last onset), each only if non-empty
- **AND** a recording that starts 0.8 s before its first tap has an 0.79 s quiet stretch

#### Scenario: Fallback to tap tails
- **GIVEN** quiet stretches shorter than max(0.1, 3 * T_he) seconds
- **WHEN** the noise floor is estimated
- **THEN** for each used tap with at least 2*W valid envelope samples, W = max(100, 3*(M-1)), the same estimate is taken over its last W samples
- **AND** N is the smallest of these and the noise source is "tapTail"
- **AND** when no tap qualifies the peak result is NO_QUIET_REFERENCE

### Requirement: Decay Fit Interval
The system SHALL fit the decay only from a start point that excludes the tap contact and any filter output touching it, up to the last point that is at least 20 dB above the noise floor or the end of the usable segment, and SHALL record which of the two ended the fit.

#### Scenario: Fit start and end
- **GIVEN** a kernel of half-length h samples at 1000 Hz, envelope e[k] valid for k = h..k_last, and threshold e_thr
- **WHEN** the interval is chosen
- **THEN** k_start = h + 5 (the support of every fitted sample starts at least 5 ms after the onset)
- **AND** k_end = (first k >= k_start with e[k] < e_thr) - 1, with end cause "noise"; or k_last with end cause "recordingEnd" when no such k exists
- **AND** for T_h = 0.02 s (h = 10), t_start = (48*15 + 94)/48000 = 0.01696 s

#### Scenario: Tap ends before the resonance has decayed
- **GIVEN** a tap 0.5 * exp(-t / 0.6) * sin(2*pi*200*t), segment 0.6 s, noise RMS 0.0001, f0 = 200 Hz alone
- **WHEN** the interval is chosen and fitted
- **THEN** the fit ends with cause "recordingEnd" at about t = 0.588 s with a decay range of about 8.3 dB
- **AND** the tap result is DECAY_CUT_OFF
- **AND** with a 1.0 s segment the decay range is about 14 dB and Q_d = 377.0 within 1 %

### Requirement: Decay Fit Quality
The system SHALL fit a straight line to the envelope level in decibels against time, derive the time constant from its slope, and accept the tap only when the decay is long enough, falls, and follows a single exponential; otherwise the tap gets the reason of the first failing check.

#### Scenario: Fit formulas
- **GIVEN** levels l[k] = 20 * log10(e[k]) in dB at times t_k in s for k = k_start..k_end
- **WHEN** the line l = a + b * t is fitted by ordinary least squares
- **THEN** tau = -8.6859 / b seconds (b in dB/s), decay range D = -b * (t_end - t_start) dB, residual RMS r in dB
- **AND** tau_1 and tau_2 are fitted the same way on the first and second halves of the interval, and rho = tau_2 / tau_1

#### Scenario: Checks in order
- **WHEN** a tap is checked
- **THEN** fewer than 8 samples after the start in the segment gives DECAY_CUT_OFF
- **AND** e[k_start] < e_thr or fewer than 8 fitted samples gives NOT_ENOUGH_DECAY
- **AND** b >= 0 gives NO_DECAY
- **AND** D < 10 dB gives DECAY_CUT_OFF when the end cause is "recordingEnd", else NOT_ENOUGH_DECAY
- **AND** r > 1.0 dB, a half with non-negative slope, or rho outside 0.70..1.43 gives NOT_EXPONENTIAL
- **AND** NOT_ENOUGH_DECAY becomes NO_QUIET_REFERENCE when the noise source is "tapTail"

#### Scenario: Beating resonances
- **GIVEN** a tap 0.5*exp(-t/0.2)*sin(2*pi*180*t) + 0.25*exp(-t/0.2)*sin(2*pi*182.5*t), noise RMS 0.0001, and only the 180 Hz peak detected
- **WHEN** the tap is checked
- **THEN** r is about 3.2 dB and the result is NOT_EXPONENTIAL

#### Scenario: Pure noise
- **GIVEN** 1.0 s of white noise of RMS 0.001 and the matching quiet stretch, f0 = 180 Hz
- **WHEN** the tap is checked
- **THEN** the result is NOT_ENOUGH_DECAY

### Requirement: Decay Q Across Taps
The system SHALL report, for each peak, the median of the decay Q values of the taps that passed every check, together with how many of the used taps passed, and SHALL refuse with a reason when fewer than three taps are usable or when the usable taps disagree strongly.

#### Scenario: Median with an outlier
- **GIVEN** five used taps of a 180 Hz resonance with tau = 0.2, 0.2, 0.2, 0.2 and 0.35 s (noise RMS 0.001)
- **WHEN** the taps are combined
- **THEN** the per-tap Q_d are about 113.1, 113.1, 113.1, 113.1 and 197.9
- **AND** the peak decay Q is 113.1 within 1 %, from 5 of 5 taps (the mean, 129.9, is not used)

#### Scenario: Too few usable taps
- **GIVEN** five used taps of which 2 are valid and 3 are DECAY_CUT_OFF
- **WHEN** the taps are combined
- **THEN** no decay Q is reported, the reason is DECAY_CUT_OFF and "2 of 5 taps" is shown
- **AND** with only 2 used taps, both valid, the reason is TOO_FEW_VALID_TAPS

#### Scenario: Inconsistent taps
- **GIVEN** three valid taps with Q_d = 56.5, 113.1 and 169.6
- **WHEN** the taps are combined
- **THEN** median = 113.1, MAD = median(|Q_j - 113.1|) = 56.5 and MAD / median = 0.50 > 0.15
- **AND** the result is TAPS_INCONSISTENT

### Requirement: Peak Inspector Decay View
The system SHALL let the user inspect a peak's decay on any used tap: the isolated response, its envelope, the fitted decay, the fit interval, the noise floor, every tap's result and the median. When no decay Q can be given it SHALL show the reason in plain language in English or French instead of a number.

#### Scenario: Plotted series
- **GIVEN** a selected peak and tap with valid envelope samples k = h..k_last at 1000 Hz
- **WHEN** the inspector is shown
- **THEN** the isolated response 2*Re(y(t)*exp(j*2*pi*f0*t)) is drawn from 400 equal time buckets, each giving its minimum and maximum (at most 800 points)
- **AND** the envelope e[k] is drawn with every s-th sample, s = ceil(n_e / 800), n_e = number of valid samples
- **AND** the fitted curve 10^((a + b*t)/20) is drawn at the envelope times between t_start and t_end, with vertical markers at t_start and t_end and horizontal lines at N_eff and e_thr
- **AND** for a 1.5 s segment with T_h = 0.02 s, n_e = 1477, s = 2 and the envelope series has 739 points

#### Scenario: Not determinable
- **GIVEN** a peak whose result is NOT_EXPONENTIAL
- **WHEN** the inspector is shown in French
- **THEN** in place of the decay Q it reads "La décroissance ne suit pas une courbe régulière, souvent parce que deux résonances battent ensemble."
- **AND** the envelope and the fitted line are still drawn so the beating is visible

#### Scenario: Peak not isolated
- **GIVEN** a peak at 200.0 Hz refused as MODE_NOT_ISOLATED because of a peak at 205.0 Hz
- **WHEN** the inspector is shown
- **THEN** no series are drawn and the reason is shown with "205.0 Hz, 5.0 Hz away; at least 7.0 Hz needed"
