# build-acoustic-analysis Specification

## Purpose
Gives a luthier an acoustic spectrum analyzer on each guitar build's page: capture a tap test from the microphone or an audio file, inspect the spectrum, its resonance peaks, Q-factor and damping, and keep named spectra per build to overlay and compare as construction progresses. All formulas live in `acoustic-signal-analysis`; the build page itself belongs to `guitar-builds`.

## Requirements

### Requirement: Analyzer on the Build Page
The system SHALL show the acoustic analyzer, titled "Enhanced FFT Analyzer", on the overview tab of a build's detail page, below the build's saved FFT results list. The analyzer is not available on the sequence tab nor on publicly shared build pages.

#### Scenario: Owner opens a build
- **WHEN** a signed-in user opens one of their builds on the overview tab
- **THEN** the saved FFT results list (if any) and the analyzer are shown

#### Scenario: Sequence tab
- **WHEN** the user switches the build to the sequence tab
- **THEN** neither the analyzer nor the saved FFT results are shown

### Requirement: Live Microphone Capture
The system SHALL capture live audio from the microphone when the user presses Start and stop when they press Stop. It SHALL request raw audio (echo cancellation, noise suppression and automatic gain control off) at 48000 Hz, accept the rate the device provides, and pass it through a 2nd-order Butterworth high-pass filter at 30 Hz (Q 0.7) before analysis.

#### Scenario: Start capture
- **WHEN** the user presses Start and grants microphone access
- **THEN** the button changes to Stop and the spectrum updates continuously (peak hold per `acoustic-signal-analysis`)
- **AND** the input source becomes the microphone

#### Scenario: Stop capture
- **WHEN** the user presses Stop
- **THEN** the microphone is released and the last held spectrum stays displayed and available for saving and export

#### Scenario: Leaving the page
- **WHEN** the user leaves the build page while capturing or playing a file
- **THEN** the microphone is released and playback stops

#### Scenario: Rumble removed
- **WHEN** the input contains energy below 30 Hz
- **THEN** it is attenuated (12 dB per octave below 30 Hz) before the spectrum is computed

### Requirement: Microphone Access Errors
The system MUST show an inline error and stay idle when the microphone cannot be opened (permission denied, no device, or unsupported browser). The message is "Unable to access microphone. Please grant permission and try again." (localized).

#### Scenario: Permission denied
- **WHEN** the user presses Start and denies microphone permission
- **THEN** the error message is shown above the settings and the analyzer remains stopped

#### Scenario: Error cleared on retry
- **GIVEN** a microphone error is shown
- **WHEN** the user presses Start again or loads a file
- **THEN** the previous error is cleared before the new attempt

### Requirement: Audio File Loading
The system SHALL let the user load one audio file ("Load Audio File") in WAV, MP3 or OGG format of at most 50 MB, decode it, mix it down to mono, analyze the whole file at its own sample rate (per `acoustic-signal-analysis`) and run standard peak detection on the result. No trimming is offered.

#### Scenario: Accepted file
- **WHEN** the user picks "tap.wav" (stereo, 44100 Hz, 3.5 s)
- **THEN** the samples are mixed to mono as x[i] = (sum over channels c of x_c[i]) / C, where C is the channel count
- **AND** the file's name, duration in seconds (2 decimals) and sample rate in Hz are shown
- **AND** the spectrum of the whole file and its peaks are displayed

#### Scenario: Format recognition
- **WHEN** a file is picked
- **THEN** it is accepted if its name ends with .wav, .mp3 or .ogg (case-insensitive) or its media type contains "wav", "mpeg", "mp3" or "ogg"

#### Scenario: Remove the file
- **WHEN** the user clicks the remove control next to the file info
- **THEN** playback stops, the file is unloaded and the analyzer is reset

### Requirement: Audio File Errors
The system MUST reject unusable files with an inline error and leave the current analysis untouched.

#### Scenario: Unsupported format
- **WHEN** the user picks "notes.flac"
- **THEN** the error "Unsupported audio format. Supported formats: WAV, MP3, OGG" is shown

#### Scenario: File too large
- **WHEN** the user picks a WAV file larger than 50 MB (52428800 bytes)
- **THEN** the error "File size exceeds maximum of 50MB" is shown

#### Scenario: Corrupt file
- **WHEN** a file with a supported extension cannot be decoded
- **THEN** the error "Failed to decode audio file: <reason>" is shown

### Requirement: Audio File Playback
The system SHALL let the user play and pause a loaded file through the speakers; playback does not change the displayed analysis.

#### Scenario: Pause and resume
- **WHEN** the user presses Play, then Pause after 1.2 s, then Play again
- **THEN** playback resumes from 1.2 s

#### Scenario: End of file
- **WHEN** playback reaches the end of the file
- **THEN** the control returns to Play and the next Play starts from the beginning

### Requirement: Analysis Settings
The system SHALL offer a collapsible Settings panel with: FFT size, window function, frequency range, display range, averaging window size, peak detection sensitivity, Q-factor bandwidth level, and logarithmic decrement (enable plus minimum cycles). Defaults and allowed values are listed in the scenarios. Invalid values MUST be rejected, keeping the previous value.

#### Scenario: Visible settings and defaults
- **WHEN** the user opens Settings for the first time
- **THEN** FFT size is 16384 (choices 512, 1024, 2048, 4096, 8192, 16384, 32768) with "Resolution: <fs/N> Hz" shown beneath
- **AND** window is Hanning (choices Hanning, Hamming, Blackman, Blackman-Harris, Rectangular), each with a one-line trade-off description
- **AND** frequency range is 10 to 1000 Hz; display range is -60 to 0 dB
- **AND** averaging window size is 10 (integer 1..100); sensitivity is 0.5 (slider 0..1, step 0.1, shown with 1 decimal)
- **AND** Q-factor bandwidth level is -3 dB; logarithmic decrement is off, with minimum cycles 3 (integer >= 3)

#### Scenario: Settings only in the configuration file
- **WHEN** the configuration is exported
- **THEN** it also contains smoothing time constant 0.3 (0..1), peak minimum prominence 3 dB and Q-factor search half-width 50 Hz, which are not shown in the panel but take effect when imported

#### Scenario: Invalid ranges rejected
- **WHEN** the user enters a frequency range minimum >= maximum, a negative minimum, a maximum above fs/2, a display minimum >= maximum, or a bandwidth level >= 0
- **THEN** the value is not applied and the previous value remains in effect

#### Scenario: Changes apply
- **WHEN** the user changes the frequency or display range
- **THEN** the display uses it immediately; an FFT size change takes effect no later than the next Start or file load

### Requirement: Settings Persistence and Configuration Files
The system SHALL remember the analysis settings in the user's browser across sessions (shared by all builds) and SHALL let the user export them as a JSON file ("Export Config", named fft-config-<epoch ms>.json) and import such a file ("Import Config"), where missing keys take default values.

#### Scenario: Settings survive reload
- **WHEN** the user sets FFT size 32768 and reloads the page
- **THEN** FFT size is still 32768

#### Scenario: Import a configuration
- **WHEN** the user imports a JSON file containing only {"fftSize": 8192}
- **THEN** FFT size becomes 8192 and every other setting takes its default

#### Scenario: Invalid configuration file
- **WHEN** the imported file is not valid JSON
- **THEN** the error "Failed to parse configuration file" is shown and settings are unchanged

### Requirement: Spectrum Display
The system SHALL plot amplitude (dB) against frequency (Hz) with a linear frequency axis from the range minimum (left) to maximum (right) and a linear dB axis from the display minimum (bottom) to maximum (top), clamping values outside the display range to its edges, with a labelled grid and a hover cursor readout.

#### Scenario: Grid lines
- **WHEN** the spectrum is drawn with range 10..1000 Hz and -60..0 dB
- **THEN** horizontal lines labelled "<n> dB" appear every 10 dB from the display minimum up to the maximum
- **AND** vertical lines labelled "<f> Hz" appear every 10^floor(log10(f_max - f_min)) Hz (here 100 Hz) starting at the first multiple >= f_min

#### Scenario: Hover readout
- **WHEN** the pointer hovers over the plot
- **THEN** a vertical cursor shows the frequency under it, f_min + (x / width) * (f_max - f_min), with 1 decimal

#### Scenario: Status line
- **WHEN** the analyzer is shown
- **THEN** a status line shows FFT size, window, sample rate (Hz) and resolution (fs/N, 2 decimals)

### Requirement: Analysis Modes
The system SHALL offer two modes, Standard (default) and Resonance Detection, selected by a toggle. Switching mode MUST clear recorded taps, the current main peak and the averaged tap spectrum.

#### Scenario: Switch to Resonance Detection
- **WHEN** the user selects Resonance Detection
- **THEN** the Resonance Detection panel appears with zero recorded peaks

### Requirement: Standard Mode Peaks
The system SHALL, in Standard mode, detect peaks in the current spectrum within the frequency range (per `acoustic-signal-analysis`) and mark the 10 strongest on the plot labelled P1..P10 by descending amplitude with their frequency (1 decimal). A collapsible "Detected Peaks" panel lists the same 10 with frequency (2 decimals) and amplitude (1 decimal dB).

#### Scenario: Peaks shown
- **WHEN** a spectrum with 14 qualifying peaks is displayed
- **THEN** only the 10 strongest are marked and listed, the strongest as P1 / "Peak 1"

#### Scenario: No peaks
- **WHEN** no peak qualifies
- **THEN** no markers are drawn and the Detected Peaks panel is hidden

### Requirement: Peak Selection and Q-Factor Display
The system SHALL let the user select a peak by clicking the plot (the detected peak nearest in frequency to the click is chosen) or a peak in the list, highlight it, and show a collapsible "Q-Factor Analysis" panel with peak frequency (2 decimals Hz), Q (2 decimals), bandwidth (2 decimals Hz) and bandwidth range (1 decimal Hz), computed per `acoustic-signal-analysis`.

#### Scenario: Click near a peak
- **GIVEN** detected peaks at 102.3 Hz and 215.8 Hz
- **WHEN** the user clicks the plot at 190 Hz
- **THEN** the 215.8 Hz peak is selected and highlighted and its Q-factor is shown

#### Scenario: Q not determinable
- **WHEN** the selected peak's bandwidth points cannot be found
- **THEN** no Q values are shown and the user is told the Q-factor could not be determined for that peak

### Requirement: Resonance Detection Mode
The system SHALL, in Resonance Detection mode with live microphone input, track the main resonance peak each frame and record one frequency per tap. A tap is recorded when the main peak exceeds -40 dB, at least 1000 ms have passed since the last recorded tap, and the response has dropped to -40 dB or below since that tap. At most 10 taps are recorded.

#### Scenario: Live main peak
- **WHEN** a main peak exists
- **THEN** "Current Main Peak" shows its frequency (2 decimals Hz) and amplitude (1 decimal dB), and the plot marks only that peak, labelled "Main Resonance" with its frequency (2 decimals)
- **AND** when there is none, "No peak detected" is shown

#### Scenario: Recording taps
- **WHEN** the user taps the guitar three times about 2 seconds apart
- **THEN** three taps are recorded and listed as "Peak 1: <f> Hz", "Peak 2: ...", "Peak 3: ..."
- **AND** the held spectrum at each tap is added to the averaged spectrum (per `acoustic-signal-analysis`), which then replaces the live curve on the plot with "<n> spectra averaged" shown

#### Scenario: Counter and guidance
- **WHEN** fewer than 3 taps are recorded
- **THEN** the counter reads "<n> / 4" with the hint "Record 3-4 peaks for best results", changing to "Ready for average" from 3 taps

#### Scenario: Average frequency
- **WHEN** 2 or more taps are recorded
- **THEN** "Average Frequency" shows their mean (2 decimals Hz) and "Based on <n> peaks"; with fewer it shows "Need 2+ peaks"

#### Scenario: Reset taps
- **WHEN** the user presses "Reset Taps"
- **THEN** recorded taps, the main peak and the averaged spectrum are cleared

#### Scenario: File input
- **WHEN** the input source is a file
- **THEN** resonance tap recording does not run and standard peaks are shown

### Requirement: Body Resonance Identification
The system SHALL offer an "Identify body resonances" switch, off by default and kept with the analysis settings, meant for an assembled guitar tapped at the bridge. While it is on, the system SHALL identify the Air, Top and Back resonances of the displayed spectrum per `acoustic-signal-analysis`, in either mode, and update them whenever the spectrum changes.

#### Scenario: Off by default
- **WHEN** a user opens the analyzer for the first time
- **THEN** the switch is off and no resonance roles are shown

#### Scenario: Plate measurement
- **GIVEN** the user measures a free top plate and leaves the switch off
- **WHEN** the spectrum is displayed
- **THEN** no peak is labelled Air, Top or Back

### Requirement: Body Resonance Display
The system SHALL, while identification is on, mark each identified resonance on the plot with its role ("Air", "Top" or "Back") and list all three in a "Body Resonances" panel with frequency (1 decimal Hz), amplitude (1 decimal dB) and Q (1 decimal). A role that is not identified reads "Not identified"; the system SHALL NOT show a guessed value.

#### Scenario: Two of three identified
- **GIVEN** Air is identified at 98.4 Hz with Q 21.3, Top at 196.9 Hz with Q 34.0, and Back is not identified
- **WHEN** the panel is shown
- **THEN** it reads "Air 98.4 Hz", "Top 196.9 Hz" with their amplitudes and Q values, and "Back: Not identified"
- **AND** only the 98.4 Hz and 196.9 Hz peaks carry role labels on the plot

### Requirement: Reset Analysis
The system SHALL offer a Reset action, shown once a spectrum exists, that clears the held spectrum, detected peaks, the selected peak and its Q-factor, the decrement result, and in Resonance Detection mode the recorded taps and averaged spectrum.

#### Scenario: Reset during capture
- **WHEN** the user presses Reset while capturing
- **THEN** peak hold restarts from empty and new frames rebuild the spectrum

### Requirement: Time-Domain View
The system SHALL let the user toggle between the frequency-domain plot and a time-domain plot (the button names the other view). The time-domain signal is the most recent N-sample frame of the filtered microphone input (as of Stop, or now if capturing), or the whole mono file for file input.

#### Scenario: Waveform plot
- **WHEN** the time-domain view is shown
- **THEN** amplitude is plotted against time with a dashed zero line, full scale (+/-1) spanning +/-40% of the plot height
- **AND** at most 10000 points are drawn, taking every floor(length / 10000)-th sample when longer

#### Scenario: Decay envelope overlay
- **WHEN** a logarithmic decrement has been calculated
- **THEN** the decay envelope (per `acoustic-signal-analysis`) is drawn as a dashed curve over the waveform

### Requirement: Logarithmic Decrement Measurement
The system SHALL, when "Enable Logarithmic Decrement" is on, offer "Calculate Log Decrement" in the time-domain view and show a collapsible "Logarithmic Decrement Analysis" panel with delta (4 decimals), damping ratio zeta (4 decimals), cycles measured, time constant tau (4 decimals s), initial and final amplitude (2 decimals dB), per `acoustic-signal-analysis`.

#### Scenario: Successful measurement
- **GIVEN** a captured decaying tap response with at least the minimum number of cycles
- **WHEN** the user presses "Calculate Log Decrement"
- **THEN** the results panel is shown and the envelope is drawn on the waveform

#### Scenario: Not enough cycles
- **WHEN** fewer cycles than the configured minimum are found, or the signal does not decay
- **THEN** no result panel is shown and the user is told the decrement could not be determined

#### Scenario: Feature disabled
- **WHEN** logarithmic decrement is disabled
- **THEN** the "Calculate Log Decrement" action is not offered

### Requirement: Spectrum Export
The system SHALL let the user download the displayed spectrum ("Export JSON", "Export CSV") over the bins of the current frequency range; both actions are disabled until a spectrum exists.

#### Scenario: CSV export
- **WHEN** the user exports CSV
- **THEN** a file fft-spectrum-<epoch ms>.csv is downloaded with header "Frequency (Hz),Amplitude (dB)" and one row per bin, both values with 2 decimals

#### Scenario: JSON export
- **WHEN** the user exports JSON
- **THEN** a file fft-spectrum-<epoch ms>.json is downloaded containing the points (frequency Hz, amplitude dB), sample rate, FFT size, window, export timestamp (epoch ms) and the full settings

### Requirement: Save Spectrum to Build
The system SHALL let the user save the displayed spectrum (the averaged tap spectrum in Resonance Detection mode once it exists, otherwise the held spectrum) to the current build under a required name. Save is offered only when not capturing and a spectrum exists.

#### Scenario: Save with a name
- **WHEN** the user presses Save, enters "After bracing" in the "Save FFT Result" dialog and confirms
- **THEN** a saved result named "After bracing" (trimmed) is created with one point per bin of the current frequency range, appended at the end of the build's list
- **AND** the dialog closes and the list refreshes

#### Scenario: Name required
- **WHEN** the name is empty or only spaces
- **THEN** the dialog's Save button is disabled

#### Scenario: Cancel
- **WHEN** the user presses Cancel
- **THEN** nothing is saved and the name field is cleared

#### Scenario: Save failure
- **WHEN** the server rejects the save
- **THEN** the message "Failed to save FFT result" is shown and the dialog stays open

### Requirement: Saved FFT Result Data
The system SHALL persist each saved FFT result belonging to exactly one build with: identifier, build, name (non-empty text), spectrum points (ordered list of {frequency Hz, amplitude dB}), optional air, top and back resonances (each {frequency Hz, amplitude dB, Q}), order position (integer, lower first), created and updated timestamps.

#### Scenario: Results follow their build
- **WHEN** a build is deleted
- **THEN** all its saved FFT results are deleted with it

#### Scenario: Identified resonances are saved
- **GIVEN** body resonance identification is on, Air and Top are identified and Back is not
- **WHEN** the result is saved
- **THEN** its air and top resonances are stored with their frequency, amplitude and Q, and its back resonance is stored empty

#### Scenario: Identification off
- **WHEN** a result is saved while body resonance identification is off
- **THEN** its air, top and back resonances are stored empty

### Requirement: Saved Results List
The system SHALL list a build's saved FFT results under the heading "Saved FFT Results", above the analyzer, ordered by ascending order position (ties by creation time), each showing its name and creation date in the user's language. The section is hidden when the build has no saved results.

#### Scenario: List order
- **GIVEN** results "Raw top" (position 0) and "Braced" (position 1)
- **WHEN** the build page opens
- **THEN** "Raw top" is listed before "Braced"

### Requirement: Reorder Saved Results
The system SHALL let the user reorder saved results by dragging an item onto another, placing the dragged item at the target's position, and SHALL persist positions 0..n-1 in the new order.

#### Scenario: Drag to reorder
- **GIVEN** results A, B, C
- **WHEN** the user drags C onto A
- **THEN** the order becomes C, A, B immediately and persists after reload

#### Scenario: Reorder failure
- **WHEN** saving the new order fails
- **THEN** the list is reloaded from the server, showing the stored order

### Requirement: Delete Saved Result
The system SHALL let the user delete a saved result only after confirming in a "Delete FFT Result" dialog ("Are you sure you want to delete this FFT result? This action cannot be undone.").

#### Scenario: Confirm deletion
- **WHEN** the user confirms Delete
- **THEN** the result is removed, also from any overlay selection, and the list refreshes

#### Scenario: Cancel deletion
- **WHEN** the user presses Cancel
- **THEN** nothing is deleted

#### Scenario: Deletion failure
- **WHEN** the server rejects the deletion
- **THEN** the message "Failed to delete FFT result" is shown and the result remains

### Requirement: Overlay Comparison of Saved Results
The system SHALL let the user select any number of saved results (checkbox per item) and draw each selected spectrum behind the current one on the same axes, in distinct colours (hue = i * 360 / count for the i-th selected), showing only points inside the current frequency range. Clicking an item's name selects only that item, or clears it if it was the sole selection.

#### Scenario: Compare two readings
- **WHEN** the user ticks "Raw top" and "Braced"
- **THEN** both curves appear immediately, in different colours, even when no capture is running

#### Scenario: Exclusive select by name
- **GIVEN** "Raw top" and "Braced" are selected
- **WHEN** the user clicks the name "Braced"
- **THEN** only "Braced" remains selected

### Requirement: Saved Result Access Control
The system SHALL let only the owner of a build view, save, reorder and delete that build's FFT results. An administrator SHALL be able to view, but not save, reorder or delete, the FFT results of another user's build. Anonymous visitors, including viewers of a publicly shared build, MUST NOT read or change saved FFT results.

#### Scenario: Other user's build
- **WHEN** a signed-in non-admin user requests the FFT results of a build they do not own
- **THEN** no results are returned and any save, reorder or delete is refused

#### Scenario: Anonymous request
- **WHEN** an unauthenticated client requests or modifies FFT results
- **THEN** the request is refused

#### Scenario: Administrator
- **WHEN** an administrator opens another user's build
- **THEN** that build's saved FFT results are listed

### Requirement: Analyzer Localization
The system SHALL present all analyzer and saved-results text (buttons, labels, settings help, panel titles, messages, dialogs) in English and French according to the user's language choice, and SHALL format dates in that language.

#### Scenario: French interface
- **WHEN** the user's language is French
- **THEN** the saved list heading reads "Résultats FFT enregistrés" and the analyzer controls and messages are in French
