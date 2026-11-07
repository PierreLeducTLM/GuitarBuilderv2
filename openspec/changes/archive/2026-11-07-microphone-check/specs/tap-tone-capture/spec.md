# Spec Delta

## ADDED Requirements

### Requirement: Capture Rate Check
The system SHALL judge every recording per the Rate Verdict of `microphone-check` after decoding and before analysis. An Accurate recording is analysed as before. A Corrected recording is analysed at its real rate, with a note in the results. A Mismatch recording returns the take to idle with the rate-mismatch message, and no frequency is shown. Loaded audio files are not judged.

#### Scenario: Correction applied
- **GIVEN** a recording judged Corrected to the standard rate S (Hz), while the browser stated fs (Hz)
- **WHEN** it is prepared for analysis
- **THEN** its decoded samples are taken as sampled at S Hz and resampled to 48,000 Hz, and the rest of the analysis is unchanged
- **AND** the results show "Corrected: this input runs at <S> Hz, not the <fs> Hz the browser reports."

#### Scenario: Tone read through a mislabelled interface
- **GIVEN** an input that delivers 44,100 frames per second while the browser states 48,000 Hz
- **WHEN** a steady 440 Hz tone is recorded and analysed
- **THEN** the peak reads 440 Hz within 0.5 Hz, not 478.9 Hz, and the corrected note names 44,100 Hz and 48,000 Hz

#### Scenario: Saved record of a corrected take
- **WHEN** a corrected take is confirmed
- **THEN** its spectrum record has sampleRate 48000, fftSize 32768 and binWidth 1.46484375, like any other capture

#### Scenario: Mismatch refused
- **WHEN** a recording is judged Mismatch
- **THEN** no frequency is shown, the take returns to idle, and the error banner shows "This audio input does not deliver audio at a rate the app can correct, so the frequencies would be wrong. Set the interface to 48 kHz in your computer's audio settings (Audio MIDI Setup on a Mac), or record with another app and load the WAV file here."

#### Scenario: Accurate recording
- **WHEN** a recording is judged Accurate
- **THEN** it is analysed as before and no corrected note is shown

#### Scenario: Loaded file
- **WHEN** the user loads a WAV file recorded with another app
- **THEN** it is analysed without the rate check

#### Scenario: French user
- **GIVEN** the interface language is French
- **WHEN** a recording is judged Corrected to 44,100 Hz for a stated 48,000 Hz
- **THEN** the note reads "Corrigé : cette entrée fonctionne à 44 100 Hz, et non aux 48 000 Hz annoncés par le navigateur."
- **AND** a Mismatch recording's banner reads "Cette entrée audio ne fournit pas le son à une fréquence que l'application peut corriger, les fréquences seraient donc fausses. Réglez l'interface sur 48 kHz dans les réglages audio de votre ordinateur (Configuration audio et MIDI sur Mac), ou enregistrez avec une autre application et chargez le fichier WAV ici."

### Requirement: Input Check Status
The system SHALL show beside the input selector the selected input's remembered Microphone Check result, or "Not checked", and a "Check this input" link that opens the Microphone Check for that input. The link is disabled while recording. The status updates when a check finishes.

#### Scenario: Unchecked input
- **WHEN** the idle state shows an input that has never been checked in this browser
- **THEN** it reads "Not checked" next to the "Check this input" link

#### Scenario: Checked input
- **GIVEN** "FastTrack Pro" was checked on Nov 7, 2026 with the verdict Accurate
- **WHEN** the user selects it
- **THEN** it reads "Checked Nov 7, 2026: Accurate"

#### Scenario: Status after a check
- **WHEN** the user runs a check from "Check this input" and closes the Microphone Check
- **THEN** the status beside the selector shows that check's date and verdict

### Requirement: Clipping Warnings
The system SHALL warn the user when the input clips. While recording, a "Clipping" indicator appears beside the oscilloscope whenever the input reaches full scale. In the results of a recorded or loaded take, a notice says how many taps were rejected as clipped and asks the user to tap more lightly or turn the input gain down.

#### Scenario: Live indicator
- **WHEN** an input sample with |x| >= 0.999 arrives during a recording
- **THEN** a "Clipping" indicator, shown as text and not by colour alone, appears beside the oscilloscope and stays until 1 s has passed without another such sample

#### Scenario: Results notice
- **GIVEN** a take with three detected taps, two of them rejected as "Clipped"
- **WHEN** the results are shown
- **THEN** a notice reads "2 of 3 taps clipped. Tap more lightly or turn the input gain down."
- **AND** in French it reads "2 taps sur 3 ont saturé. Tapez plus doucement ou baissez le gain d'entrée."

#### Scenario: No clipping
- **WHEN** no detected tap was rejected as "Clipped"
- **THEN** no clipping notice is shown

## MODIFIED Requirements

### Requirement: Error Banner
The system SHALL display operation failures in an error banner at the top of the dialog without closing it: microphone access, a recording judged Mismatch by the capture rate check, processing, no tap detected, file format or decoding, audio export ("Error generating audio file") and playback ("Error playing audio"). Starting a new recording or file load clears the banner.

#### Scenario: Export failure
- **WHEN** generating the WAV download fails
- **THEN** "Error generating audio file" is shown and the results remain on screen

#### Scenario: Rate mismatch cleared
- **GIVEN** the banner shows the rate-mismatch message
- **WHEN** the user loads an audio file
- **THEN** the banner is cleared and the file is analysed
