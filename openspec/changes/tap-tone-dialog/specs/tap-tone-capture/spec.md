# Spec Delta

## MODIFIED Requirements

### Requirement: Cancelling the Dialog
The system SHALL discard everything and return nothing to the caller when the user clicks Cancel or the close button: an ongoing recording is stopped without analysis, the microphone is released and playback is stopped. Reopening afterwards starts from idle unless the caller supplies a saved spectrum.

#### Scenario: Cancel during recording
- **WHEN** the user clicks Cancel while recording
- **THEN** the recording is discarded, the microphone is released, the dialog closes and the caller's value is unchanged

#### Scenario: Cancel during analysis
- **GIVEN** the user loaded a long audio file and the dialog shows "Analyzing..."
- **WHEN** the user clicks Cancel
- **THEN** the dialog closes at once, the analysis result is discarded when it completes, and the caller's value is unchanged
- **AND** reopening the dialog shows the idle state, not the discarded results

## ADDED Requirements

### Requirement: Spectrum Record Validation
The server SHALL refuse to store a Tap-Tone Spectrum Record that is malformed or oversized, wherever a caller persists one, and SHALL store nothing from that request. A refused record is reported to the user as the caller's usual save failure.

#### Scenario: Accepted record
- **WHEN** a client stores a 48 kHz record with sampleRate 48000, fftSize 16384, binWidth 2.9296875 and three lists of 331 numbers from 32.2265625 Hz to 999.0234375 Hz
- **THEN** the record is stored unchanged

#### Scenario: Shape rules
- **WHEN** a client stores a record
- **THEN** it is refused unless frequencies, magnitudes and magnitudesDb are lists of numbers with the same length, from 1 to 1024 entries
- **AND** unless the frequencies are strictly ascending, greater than 0 Hz and at most 2000 Hz, and every magnitude is at least 0
- **AND** unless sampleRate is a number greater than 0 (Hz), fftSize is a power of two no larger than 16384 (samples), and binWidth (Hz) equals sampleRate / fftSize to within one part in a billion

#### Scenario: Oversized record
- **WHEN** a modified client stores a record with 5000 points on a build step
- **THEN** the step change is refused, the step keeps its earlier measurements, and the user sees "Failed to save changes"
