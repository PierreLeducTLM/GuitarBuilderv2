# Spec Delta

## Purpose

Lets a luthier check, using only the laptop or phone in hand, that an audio input delivers samples at the rate the browser reports and at a usable level. The rate rules defined here also judge every tap-tone recording.

## ADDED Requirements

### Requirement: Opening the Microphone Check
The system SHALL provide a modal "Microphone Check" dialog, opened from the Frequency Detector's "Check this input" link or from the You page. It shows an input selector, the selected input's remembered result, a "Start check" button and a "Play test tone" button. Opening it SHALL NOT trigger a microphone permission prompt. Its input choice is the same page-wide choice the Frequency Detector uses.

#### Scenario: Open from the Frequency Detector
- **GIVEN** the Frequency Detector is idle with "FastTrack Pro" selected
- **WHEN** the user clicks "Check this input"
- **THEN** the Microphone Check opens over it with "FastTrack Pro" selected, and the browser has not asked for microphone permission yet
- **AND** closing the Microphone Check returns to the Frequency Detector with its take unchanged

#### Scenario: Open from the You page
- **WHEN** the user clicks "Check microphone" on the You page
- **THEN** the Microphone Check opens with the page's current input choice, or the browser's default input when none was made

#### Scenario: Choice carried back
- **GIVEN** the Microphone Check was opened from the Frequency Detector
- **WHEN** the user selects "MacBook Pro Microphone" in the check and closes it
- **THEN** the Frequency Detector's selector shows "MacBook Pro Microphone"

### Requirement: Check Recording
The system SHALL, on "Start check", record the selected input for 5.0 s with the same capture settings as the Frequency Detector, asking for permission at that moment. While it records, the dialog shows "Tap a part 2 or 3 times while the check records", a countdown and the live oscilloscope. Afterwards it shows the Clock Result and the Level Result together.

#### Scenario: Check run
- **WHEN** the user clicks "Start check" and grants permission
- **THEN** the input records for 5.0 s, the microphone is released, and the clock and level results appear
- **AND** "Start check" reads "Check again"

#### Scenario: Permission denied
- **WHEN** the user denies the permission prompt
- **THEN** no result is shown and the dialog shows "Unable to access microphone. Please check permissions."

### Requirement: Rate Verdict
The system SHALL judge a recording's sample rate as Accurate, Corrected or Mismatch by comparing the audio delivered with the real time elapsed. Corrected means the real rate is another standard rate, which the system can apply. The verdict uses the browser's frame counts when it reports them, and the length of the decoded audio otherwise.

#### Scenario: Measured rate
- **GIVEN** E is the real time in seconds between the recording's start and stop, fs the rate the browser states (Hz), F and X the frames the browser reports as delivered and dropped during E, and D the length in seconds of the decoded recording
- **WHEN** the recording is judged
- **THEN** the ratio is r = F / (fs * E) when frame counts are reported, otherwise r = D / E, and the measured rate is R = r * fs Hz

#### Scenario: Verdict rules
- **GIVEN** the standard rates 8000, 11025, 16000, 22050, 24000, 32000, 44100, 48000, 88200 and 96000 Hz, and S the standard rate nearest to R
- **WHEN** the recording is judged
- **THEN** it is Mismatch when frame counts are reported and X / (F + X) > 0.01
- **AND** otherwise it is Accurate when |r - 1| <= 0.03 with frame counts, or when |D - E| <= max(0.03 * E, 0.2 s) without them
- **AND** otherwise it is Corrected to S when S is not fs and |R / S - 1| <= 0.01, and Mismatch in every other case

#### Scenario: Error in cents
- **WHEN** the verdict is shown
- **THEN** the error is c = 1200 * log2(fs / R) cents, rounded to a whole number with its sign: how far every frequency would read off if nothing were corrected

#### Scenario: Interface read at the wrong rate
- **WHEN** a 5.0 s recording at a stated 48,000 Hz reports 220,500 frames delivered and none dropped
- **THEN** r = 0.91875, R = 44,100 Hz, c = +147 cents, and the verdict is Corrected to 44,100 Hz

#### Scenario: Healthy input
- **WHEN** a 5.0 s recording at a stated 48,000 Hz reports 240,000 frames delivered and none dropped
- **THEN** the verdict is Accurate

#### Scenario: Dropped audio
- **WHEN** a recording reports 245,000 frames delivered and 5,000 dropped (2%)
- **THEN** the verdict is Mismatch

#### Scenario: Non-standard rate
- **WHEN** a 5.0 s recording at a stated 48,000 Hz reports 210,000 frames delivered (R = 42,000 Hz, 4.8% from 44,100 Hz)
- **THEN** the verdict is Mismatch

#### Scenario: Duration only
- **WHEN** a browser without frame counts records for E = 6.0 s and the decoded recording lasts D = 5.51 s
- **THEN** |D - E| = 0.49 s exceeds 0.2 s, R = 44,080 Hz is within 1% of 44,100 Hz, and the verdict is Corrected to 44,100 Hz

#### Scenario: Short recording timing margin
- **WHEN** a browser without frame counts records for E = 1.0 s and the decoded recording lasts D = 0.85 s
- **THEN** |D - E| = 0.15 s is within max(0.03 s, 0.2 s), and the verdict is Accurate

### Requirement: Clock Result
The system SHALL show, after a check, the stated rate, the measured rate rounded to the nearest whole Hz, the error in cents and the verdict with its explanation. The verdict is given in words, not by colour alone.

#### Scenario: Accurate
- **WHEN** the check measures 47,999 Hz for a stated 48,000 Hz
- **THEN** it shows "Stated 48,000 Hz", "Measured 47,999 Hz", "0 cents" and "Accurate: frequencies from this input are correct."

#### Scenario: Corrected
- **WHEN** the check measures 44,100 Hz for a stated 48,000 Hz
- **THEN** it shows "+147 cents" and "Corrected: this input runs at 44,100 Hz, not the 48,000 Hz the browser reports. The app corrects its recordings automatically. To remove the correction, set the interface to 48 kHz in your computer's audio settings (Audio MIDI Setup on a Mac)."

#### Scenario: Mismatch
- **WHEN** the check's verdict is Mismatch
- **THEN** it shows "Mismatch: this input does not deliver audio at a rate the app can correct, so its frequencies would be wrong. Set the interface to 48 kHz in your computer's audio settings, or record with another app and load the WAV file."

### Requirement: Level Result
The system SHALL show, after a check, the input's noise floor and the loudest sample's level in dBFS, with one decimal, and a level verdict: No tap heard, Clipping, Low or Good. The level verdict comes with advice and is given in words, not by colour alone.

#### Scenario: Level measures
- **GIVEN** x[n] is the recorded signal before the high-pass filter (full scale +/-1), cut into blocks of 240 samples whose RMS values are r_b
- **WHEN** the level is measured
- **THEN** the noise floor is 20 * log10(max(nf, 1e-10)) dBFS, where nf is the 10th percentile of the r_b
- **AND** the peak is 20 * log10(max(P, 1e-10)) dBFS, where P is the largest |x[n]|

#### Scenario: Level verdict rules
- **WHEN** the level verdict is chosen
- **THEN** it is No tap heard when the Frequency Detector's Tap Detection finds no tap in the recording
- **AND** otherwise Clipping when P >= 0.999, Low when P < 0.05 (-26.0 dBFS), and Good in every other case

#### Scenario: Advice
- **WHEN** the level verdict is shown
- **THEN** No tap heard reads "No tap heard. Tap a part firmly during the check."
- **AND** Clipping reads "Clipping: turn the input gain down or tap more lightly."
- **AND** Low reads "Low: raise the input gain or move the microphone closer."
- **AND** Good reads "Good level."

### Requirement: Test Tone
The system SHALL, on "Play test tone", play a 440 Hz tone through the device's speaker for 3.0 s while recording the selected input, then show the frequency heard and its deviation in cents. A note SHALL say the clock result is the reference, because a speaker and microphone sharing one clock hide a rate error.

#### Scenario: Tone measurement
- **GIVEN** the tone is a sine of amplitude 0.5 at 440 Hz, and the recording has been judged per Rate Verdict and corrected when the verdict is Corrected
- **WHEN** the heard frequency is measured
- **THEN** the 32768 samples at the centre of the recording are transformed as in the Frequency Detector's Tap Spectrum, and the strongest point from 220 Hz to 880 Hz is refined per Sub-Bin Peak Refinement
- **AND** the deviation is d = 1200 * log2(f / 440) cents, f being the refined frequency (Hz)

#### Scenario: Tone matches
- **WHEN** the heard frequency is 440.2 Hz
- **THEN** it shows "Heard 440.2 Hz (+1 cent)" and "Matches"

#### Scenario: Tone heard after correction
- **GIVEN** an input delivering 44,100 frames per second while the browser states 48,000 Hz
- **WHEN** the test tone is played and recorded
- **THEN** the uncorrected audio would read about 478.9 Hz, and the result shows "Heard 440.0 Hz (0 cents)" with "Corrected from 478.9 Hz"

#### Scenario: Tone off
- **WHEN** |d| > 10 cents
- **THEN** it shows the heard frequency and "Off by <d> cents"
- **AND** when the clock verdict for that recording is Accurate or Corrected it adds "The clock check is the reference: recordings from this input are not affected. The speaker's own rate may be off."

#### Scenario: Tone not heard
- **WHEN** the strongest point from 220 Hz to 880 Hz is below -60 dB
- **THEN** it shows "Tone not heard. Turn the volume up or bring the microphone closer to the speaker."

#### Scenario: Reference note
- **WHEN** any tone result is shown
- **THEN** it reads "If the speaker and the microphone are on the same device, a rate error can go unnoticed here. The clock check is the reference."

### Requirement: Remembered Check Results
The system SHALL remember in the browser the latest check result of each input: date, rate verdict, measured rate and level verdict. A new check replaces it. Results SHALL NOT be sent to the server, and the dialogs work normally when browser storage is unavailable. A remembered result is shown only; it never decides how a recording is judged.

#### Scenario: Result shown on reopening
- **GIVEN** "FastTrack Pro" was checked on Nov 7, 2026 with the verdict Corrected to 44,100 Hz
- **WHEN** the Microphone Check opens with that input selected
- **THEN** it shows "Last check: Nov 7, 2026. Corrected (44,100 Hz)"

#### Scenario: Input identified across visits
- **WHEN** the browser lists an input whose identifier or, failing that, name matches a remembered result
- **THEN** that result belongs to the input

#### Scenario: Storage unavailable
- **GIVEN** the browser blocks site storage
- **WHEN** the user runs a check
- **THEN** the results are shown, and the input shows "Not checked" on reopening

### Requirement: Localized Microphone Check
The system SHALL present all Microphone Check text in English and French according to the user's language, including verdicts, explanations, advice, the tone note, dates and numbers.

#### Scenario: French user
- **GIVEN** the interface language is French
- **WHEN** a check measures 44,100 Hz for a stated 48,000 Hz
- **THEN** it shows "Mesuré 44 100 Hz", "+147 cents" and "Corrigé : cette entrée fonctionne à 44 100 Hz, et non aux 48 000 Hz annoncés par le navigateur. L'application corrige ses enregistrements automatiquement. Pour supprimer la correction, réglez l'interface sur 48 kHz dans les réglages audio de votre ordinateur (Configuration audio et MIDI sur Mac)."
- **AND** the dialog title reads "Vérification du micro"
