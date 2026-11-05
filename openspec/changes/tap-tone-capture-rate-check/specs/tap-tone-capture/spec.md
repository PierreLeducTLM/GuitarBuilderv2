# Spec Delta

## ADDED Requirements

### Requirement: Capture Rate Check
The system SHALL check every recording to confirm that the audio arrived at the rate the browser states. When the rate is off by more than the tolerance, or too much audio was dropped, the take SHALL return to idle without analysing the audio or showing a frequency, and SHALL show the rate-mismatch message. Loaded audio files are not checked.

#### Scenario: Duration check
- **GIVEN** E is the real time in seconds from the moment the recording starts to the moment it stops, and D is the length in seconds of the decoded recording
- **WHEN** the recording is checked
- **THEN** it fails when |D - E| > max(0.03 * E, 0.2 s)

#### Scenario: Frame check
- **GIVEN** the browser reports, for the recording, F frames captured and X frames dropped at its stated sample rate fs (Hz), over the same E seconds
- **WHEN** the recording is checked
- **THEN** it fails when |F / (fs * E) - 1| > 0.03, or when X / (F + X) > 0.01
- **AND** when the browser reports no frame counts, only the duration check applies

#### Scenario: USB interface read at the wrong rate
- **GIVEN** the stated rate is 48,000 Hz
- **WHEN** a 5.0 s recording reports 220,500 frames captured (44,100 per second, a ratio of 0.919)
- **THEN** no frequency is shown, the take returns to idle, and the error banner shows "This audio input isn't being read at the right speed on this device, so the frequencies would be wrong. Record with an app that supports USB audio and load the WAV file here, or use another device."

#### Scenario: Duration alone reveals the mismatch
- **WHEN** a browser without frame counts records for 6.0 s of real time and the decoded recording lasts 5.51 s
- **THEN** |D - E| = 0.49 s exceeds max(0.18 s, 0.2 s), and the take returns to idle with the rate-mismatch message

#### Scenario: Dropped audio
- **WHEN** a recording reports 245,000 frames captured and 5,000 dropped (2% of the audio)
- **THEN** the take returns to idle with the rate-mismatch message

#### Scenario: Healthy recording
- **WHEN** a 5.0 s recording at a stated 48,000 Hz reports 240,000 frames captured and none dropped, and decodes to 4.95 s
- **THEN** the recording passes and is analysed as before

#### Scenario: Short recording timing margin
- **WHEN** a browser without frame counts records for 1.0 s of real time and the decoded recording lasts 0.85 s
- **THEN** |D - E| = 0.15 s is within max(0.03 s, 0.2 s), and the recording passes

#### Scenario: Loaded file
- **WHEN** the user loads a WAV file recorded with another app
- **THEN** it is analysed without the rate check

#### Scenario: French user
- **GIVEN** the interface language is French
- **WHEN** a recording fails the rate check
- **THEN** the banner shows "Cette entrée audio n'est pas lue à la bonne vitesse sur cet appareil, les fréquences seraient donc fausses. Enregistrez avec une application compatible avec l'audio USB et chargez le fichier WAV ici, ou utilisez un autre appareil."

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
The system SHALL display operation failures in an error banner at the top of the dialog without closing it: microphone access, a recording that fails the capture rate check, processing, no tap detected, file format or decoding, audio export ("Error generating audio file") and playback ("Error playing audio"). Starting a new recording or file load clears the banner.

#### Scenario: Export failure
- **WHEN** generating the WAV download fails
- **THEN** "Error generating audio file" is shown and the results remain on screen

#### Scenario: Rate mismatch cleared
- **GIVEN** the banner shows the rate-mismatch message
- **WHEN** the user loads an audio file
- **THEN** the banner is cleared and the file is analysed
