# acoustic-signal-analysis Specification

## Purpose
Defines the signal-processing math behind the build acoustic analyzer (`build-acoustic-analysis`): window functions, the decibel amplitude spectrum, live peak-hold, peak detection, Q-factor, logarithmic decrement, tap averaging and the identification of the air, top and back body resonances. It exists so the numbers a luthier reads on screen can be reproduced exactly. It does not cover the separate tap-tone modal math owned by `tap-tone-capture`.

## Requirements

### Requirement: Window Functions
The system SHALL multiply each analysis frame of N samples by the user-selected window w[n], n = 0..N-1, before the transform. The available windows are Hann (labelled "Hanning", the default), Hamming, Blackman, Blackman-Harris (4-term) and Rectangular. An unknown window name SHALL fall back to Hann. In the formulas, D = N - 1 and cos arguments are in radians.

#### Scenario: Window formulas
- **WHEN** a frame of N samples is windowed
- **THEN** Rectangular uses w[n] = 1
- **AND** Hann uses w[n] = 0.5 * (1 - cos(2*pi*n/D))
- **AND** Hamming uses w[n] = 0.54 - 0.46 * cos(2*pi*n/D)
- **AND** Blackman uses w[n] = 0.42 - 0.5 * cos(2*pi*n/D) + 0.08 * cos(4*pi*n/D)
- **AND** Blackman-Harris uses w[n] = 0.35875 - 0.48829 * cos(2*pi*n/D) + 0.14128 * cos(4*pi*n/D) - 0.01168 * cos(6*pi*n/D)

#### Scenario: Changing the window changes the spectrum
- **GIVEN** the same captured frame
- **WHEN** the user switches the window from Hann to Rectangular
- **THEN** the computed spectrum SHALL differ (wider leakage skirts around strong peaks)

### Requirement: Frequency Bin Mapping
The system SHALL map FFT bin k to frequency f_k = k * fs / N, where fs is the sample rate in Hz and N the FFT size, and SHALL report the frequency resolution as fs / N Hz. Bin k exists for k = 0..N/2 - 1.

#### Scenario: Default resolution
- **GIVEN** fs = 48000 Hz and N = 16384
- **WHEN** the resolution is displayed
- **THEN** it reads 2.93 Hz (48000 / 16384 = 2.9297)

#### Scenario: Bin range for a frequency range
- **WHEN** the system needs the bins covering a frequency range [f_min, f_max]
- **THEN** k_min = max(0, round(f_min * N / fs))
- **AND** k_max = min(N/2 - 1, round(f_max * N / fs))
- **AND** every bin from k_min to k_max inclusive is analyzed, displayed, saved or exported

### Requirement: Decibel Amplitude Spectrum
The system SHALL express spectrum amplitudes in decibels relative to digital full scale, using a coherent-gain-normalized magnitude so that a full-scale sinusoid centred on a bin reads 0 dB, with a floor of -200 dB (epsilon 1e-10 on the linear magnitude).

#### Scenario: Amplitude of one frame
- **GIVEN** a windowed frame x[n] * w[n], n = 0..N-1, with samples in the range -1..+1
- **WHEN** its spectrum is computed
- **THEN** X[k] = sum over n of x[n] * w[n] * exp(-i * 2*pi * k * n / N)
- **AND** the linear magnitude is m[k] = 2 * |X[k]| / (sum over n of w[n])
- **AND** the amplitude is A[k] = 20 * log10(max(m[k], 1e-10)) dB

#### Scenario: Silent input
- **WHEN** a frame contains only zeros
- **THEN** every bin reads -200 dB

### Requirement: Live Spectrum Smoothing and Peak Hold
The system SHALL, for live microphone input, recompute the spectrum on every display refresh from the most recent N samples, smooth linear magnitudes across frames with time constant tau = 0.3, and display a peak-hold spectrum whose release is set by the averaging window size N_avg (integer 1..100, default 10). The held spectrum starts empty (minus infinity) and is cleared by Reset.

#### Scenario: Frame-to-frame smoothing
- **WHEN** a new frame t is analyzed
- **THEN** the smoothed magnitude is ms_t[k] = tau * ms_(t-1)[k] + (1 - tau) * m_t[k] with tau = 0.3
- **AND** the frame amplitude is A_t[k] = 20 * log10(max(ms_t[k], 1e-10)) dB

#### Scenario: Louder bin is captured immediately
- **WHEN** A_t[k] is greater than the held value H_(t-1)[k]
- **THEN** H_t[k] = A_t[k]

#### Scenario: Quieter bin releases gradually
- **GIVEN** N_avg greater than 1
- **WHEN** A_t[k] is less than or equal to H_(t-1)[k]
- **THEN** H_t[k] = (1 - 1/N_avg) * H_(t-1)[k] + (1/N_avg) * A_t[k]

#### Scenario: Pure peak hold
- **GIVEN** N_avg = 1
- **WHEN** A_t[k] is less than or equal to H_(t-1)[k]
- **THEN** H_t[k] = H_(t-1)[k] (the maximum is held until Reset)

### Requirement: Audio File Spectrum
The system SHALL compute the spectrum of a loaded audio file over the whole file by analyzing consecutive N-sample frames with 50% overlap (hop N/2), zero-padding the final partial frame, and keeping per bin the maximum amplitude over all frames (peak hold, no frame-to-frame smoothing). The file is analyzed at its own sample rate.

#### Scenario: Tap anywhere in the file is captured
- **GIVEN** a 10-second recording containing one tap at 7.2 s
- **WHEN** the file is analyzed
- **THEN** the resulting spectrum contains the tap's resonance peaks

#### Scenario: File shorter than one frame
- **GIVEN** a file with fewer than N samples
- **WHEN** it is analyzed
- **THEN** a single zero-padded frame is analyzed

### Requirement: Peak Detection
The system SHALL detect spectral peaks within the analyzed bin range [k_min, k_max] using a relative threshold s (sensitivity, 0..1, default 0.5), a local-maximum half-width w = 3 bins, a prominence window of 2w = 6 bins with minimum prominence P (default 3 dB), and a minimum spacing of 3 bins. Peaks SHALL be returned sorted by descending amplitude; rank 1 is the strongest.

#### Scenario: Candidate bins
- **WHEN** peaks are searched
- **THEN** only bins k with max(k_min, w) <= k <= min(k_max, N/2 - 1 - w) are candidates

#### Scenario: Relative threshold
- **GIVEN** A_max is the highest amplitude among bins k_min..k_max
- **WHEN** a candidate bin is tested
- **THEN** it is rejected unless 10^(A[k]/20) >= s * 10^(A_max/20), i.e. A[k] >= A_max + 20 * log10(s)
- **AND** s = 0 disables the threshold and s = 0.5 keeps only peaks within 6.02 dB of the strongest

#### Scenario: Strict local maximum
- **WHEN** a candidate bin passes the threshold
- **THEN** it is rejected unless A[k] is strictly greater than every existing neighbour A[k-j] and A[k+j] for j = 1..3

#### Scenario: Prominence
- **WHEN** a local maximum is tested
- **THEN** L = minimum of A[k] and A[k-j] for j = 1..6 (existing bins only), and R = minimum of A[k] and A[k+j] for j = 1..6
- **AND** prominence = A[k] - max(L, R)
- **AND** the bin is rejected if prominence < P dB

#### Scenario: Minimum spacing
- **GIVEN** candidates are scanned from low to high frequency
- **WHEN** a candidate lies fewer than 3 bins from an already accepted peak
- **THEN** it is rejected

#### Scenario: Reported peak values
- **WHEN** a peak is accepted at bin k
- **THEN** its frequency is the sub-bin interpolated frequency, its amplitude is A[k] in dB (not interpolated), and its bin index is k

### Requirement: Sub-Bin Peak Frequency Interpolation
The system SHALL refine each peak's frequency by fitting a parabola through the dB amplitudes of bins k-1, k and k+1, clamping the offset to half a bin.

#### Scenario: Parabolic interpolation
- **GIVEN** a = A[k-1], b = A[k], c = A[k+1] and d = a - 2b + c
- **WHEN** the peak frequency is computed
- **THEN** p = 0.5 * (a - c) / d, clamped to the range -0.5..+0.5
- **AND** the frequency is (k + p) * fs / N Hz

#### Scenario: Degenerate parabola or edge bin
- **WHEN** |d| < 1e-10, or k is the first or last bin of the spectrum
- **THEN** the frequency is k * fs / N Hz

### Requirement: Main Resonance Peak
The system SHALL define the main resonance peak of a spectrum as the highest-amplitude peak (per Peak Detection) whose interpolated frequency lies inside the selected frequency range [f_min, f_max]; if there is none, there is no main peak.

#### Scenario: Strongest in range wins
- **GIVEN** detected peaks at 98 Hz (-22 dB), 205 Hz (-18 dB) and 1500 Hz (-10 dB) with range 10..1000 Hz
- **WHEN** the main peak is determined
- **THEN** it is the 205 Hz peak

### Requirement: Q-Factor by Bandwidth Method
The system SHALL compute the Q-factor of a peak as Q = f0 / BW, where f0 is the peak's interpolated frequency and BW the width between the points where the spectrum falls L dB below the peak amplitude A0 (L = bandwidth level, default -3 dB). Crossings SHALL be searched within +/- R Hz of the peak (R = 50 Hz) and interpolated linearly in linear amplitude.

#### Scenario: Locating the bandwidth points
- **GIVEN** a[k] = 10^(A[k]/20), threshold T = 10^((A0 + L)/20), peak bin k0, and W = floor(R / (fs/N)) bins
- **WHEN** the lower point is searched from k = k0-1 down to max(0, k0-W)
- **THEN** at the first k with a[k] <= T, b_low = k + (T - a[k]) / (a[k+1] - a[k])
- **AND** the upper point is searched from k = k0+1 up to min(N/2 - 1, k0+W), and at the first k with a[k] <= T, b_high = (k-1) + (T - a[k-1]) / (a[k] - a[k-1])
- **AND** when the two amplitudes used for an interpolation differ by less than 1e-10, the crossing is placed at the bin found at or below the threshold

#### Scenario: Q-factor result
- **WHEN** both bandwidth points are found
- **THEN** f_low = b_low * fs / N, f_high = b_high * fs / N and BW = f_high - f_low (Hz)
- **AND** Q = f0 / BW
- **AND** the result reports f0, Q, BW, f_low, f_high and A0

#### Scenario: Q-factor not determinable
- **WHEN** the threshold is not crossed on either side within +/- R Hz, or BW < 0.1 Hz
- **THEN** no Q-factor is produced

#### Scenario: Example
- **GIVEN** a peak at f0 = 200 Hz whose -3 dB points interpolate to 195 Hz and 205 Hz
- **WHEN** Q is computed
- **THEN** BW = 10 Hz and Q = 20

### Requirement: Decay Cycle Extraction
The system SHALL extract decay cycles from a time-domain signal s[i] (sample rate fs) using interpolated zero crossings, taking one same-polarity lobe per period, and SHALL require at least 2*M zero crossings and at least M lobes, where M is the minimum cycle count (integer >= 3, default 3).

#### Scenario: Zero crossings
- **WHEN** consecutive samples change sign, i.e. (s[i-1] >= 0 and s[i] < 0) or (s[i-1] < 0 and s[i] >= 0)
- **THEN** a crossing is recorded at time c = (i - 1 + |s[i-1]| / (|s[i-1]| + |s[i]|)) / fs seconds

#### Scenario: Lobes
- **GIVEN** crossings c_0, c_1, c_2, ...
- **WHEN** lobes are built
- **THEN** lobe j spans c_(2j) to c_(2j+1) for j = 0, 1, 2, ... while both exist and floor(c_(2j+1) * fs) is inside the signal
- **AND** its peak amplitude a_j is the maximum |s[i]| for i from floor(c_(2j) * fs) to floor(c_(2j+1) * fs) - 1, expressed as 20 * log10(max(a_j, 1e-10)) dB
- **AND** its time t_j is the index of that maximum divided by fs
- **AND** its frequency is f_j = 1 / (2 * (c_(2j+1) - c_(2j))) Hz (a lobe lasts half a period)

#### Scenario: Too few cycles
- **WHEN** fewer than 2*M crossings or fewer than M lobes are found
- **THEN** no decay measurement is produced

### Requirement: Logarithmic Decrement and Damping
The system SHALL compute the logarithmic decrement from the first and last extracted lobes, and derive the damping ratio and decay time constant from it. No result SHALL be produced when the last lobe is not quieter than the first.

#### Scenario: Decrement formulas
- **GIVEN** lobes 0..n (n >= 1) with peak amplitudes A_0 and A_n in dB and frequencies f_0..f_n
- **WHEN** the decrement is computed
- **THEN** delta = (1/n) * ln(10^((A_0 - A_n)/20)) = (A_0 - A_n) * ln(10) / (20 * n)
- **AND** damping ratio zeta = delta / (2*pi)
- **AND** f_avg = (f_0 + ... + f_n) / (n + 1)
- **AND** time constant tau = 1 / (2*pi * zeta * f_avg) = 1 / (delta * f_avg) seconds, or not available when f_avg = 0
- **AND** the result reports delta, zeta, cycles measured n, tau, initial amplitude A_0 (dB) and final amplitude A_n (dB)

#### Scenario: Example
- **GIVEN** 11 lobes (n = 10) with A_0 = -6 dB, A_10 = -26 dB and f_avg = 100 Hz
- **WHEN** the decrement is computed
- **THEN** delta = 20 * ln(10) / 200 = 0.2303, zeta = 0.0367 and tau = 0.0434 s

#### Scenario: Growing signal
- **WHEN** A_n >= A_0
- **THEN** no decrement is produced

### Requirement: Decay Envelope
The system SHALL generate an exponential decay envelope for display from the extracted lobes, as 101 points evenly spaced in time from the first lobe time t_0 to the last lobe time t_n.

#### Scenario: Envelope curve
- **GIVEN** at least 2 lobes, t_n > t_0 and linear peak a_n < a_0
- **WHEN** the envelope is generated
- **THEN** for i = 0..100, t = t_0 + (i/100) * (t_n - t_0) and the linear amplitude is a_0 * exp(-delta * f_avg * (t - t_0))

#### Scenario: Envelope fallback
- **WHEN** there are fewer than 2 lobes, or the signal does not decay
- **THEN** the envelope is just the lobe peak points (t_j, a_j)

### Requirement: Resonance Tap Averaging
The system SHALL, in resonance detection mode, average the recorded tap frequencies arithmetically and maintain a per-bin running mean of the held spectra captured at each recorded tap, computed on dB values.

#### Scenario: Average frequency
- **GIVEN** recorded tap frequencies f_1..f_n with n >= 2
- **WHEN** the average is displayed
- **THEN** it equals (f_1 + ... + f_n) / n

#### Scenario: Averaged spectrum
- **GIVEN** S_(n-1) is the averaged spectrum after n-1 taps and H is the held spectrum at tap n
- **WHEN** tap n is recorded
- **THEN** S_n[k] = (S_(n-1)[k] * (n-1) + H[k]) / n for every bin, with S_1 = H

### Requirement: Body Resonance Candidates
The system SHALL find body resonance candidates with its own fixed settings, independent of the user's peak settings: Peak Detection over 60–400 Hz with sensitivity s = 0.0316 (within 30 dB of the strongest peak in that band), prominence P = 6 dB, half-width 3 bins and minimum spacing 3 bins. Each candidate's Q-factor is computed by the bandwidth method with L = -3 dB and R = 50 Hz.

#### Scenario: Weak peak rejected
- **GIVEN** the strongest peak between 60 and 400 Hz is at -20 dB
- **WHEN** candidates are found
- **THEN** a peak at -52 dB is not a candidate

#### Scenario: Shallow peak rejected
- **WHEN** a local maximum rises only 4 dB above its surroundings
- **THEN** it is not a candidate, whatever the user's prominence setting

### Requirement: Body Resonance Assignment
The system SHALL assign body resonance roles by mode order: Air, T(1,1)1, is the lowest candidate from 70 to 130 Hz; Top, T(1,1)2, is the lowest candidate from max(140 Hz, 1.4 × f_air) to 300 Hz; Back, T(1,1)3, is the lowest candidate from f_top + 15 Hz to 400 Hz. Each role reports the candidate's interpolated frequency (Hz), amplitude (dB) and Q.

#### Scenario: Typical assembled body
- **GIVEN** candidates at 98.4 Hz, 196.9 Hz and 247.5 Hz, each with a determinable Q
- **WHEN** roles are assigned
- **THEN** Air is 98.4 Hz, Top is 196.9 Hz and Back is 247.5 Hz

#### Scenario: Candidate too close above the air resonance
- **GIVEN** candidates at 110 Hz, 150 Hz, 212 Hz and 262 Hz, each with a determinable Q
- **WHEN** roles are assigned
- **THEN** Air is 110 Hz, Top is 212 Hz (150 Hz is below 1.4 × 110 = 154 Hz) and Back is 262 Hz

### Requirement: Body Resonance Reliability
The system SHALL report a role as not identified, rather than guess, when no candidate lies in its range, when the chosen candidate's Q cannot be determined, when another candidate lies within 15 Hz of it, or when the spectrum's resolution fs/N is coarser than 3 Hz. Top requires an identified Air and Back requires an identified Top; otherwise they are not identified either.

#### Scenario: No air resonance
- **GIVEN** a free-plate spectrum with candidates at 152 Hz and 233 Hz only
- **WHEN** roles are assigned
- **THEN** Air, Top and Back are all not identified

#### Scenario: Top Q not determinable
- **GIVEN** candidates at 101 Hz and 205 Hz, and the 205 Hz peak's -3 dB points cannot be found within 50 Hz
- **WHEN** roles are assigned
- **THEN** Air is 101 Hz, and Top and Back are not identified

#### Scenario: Split peak
- **GIVEN** air-range candidates at 96 Hz and 108 Hz
- **WHEN** roles are assigned
- **THEN** Air is not identified, and neither are Top and Back

#### Scenario: Coarse resolution
- **GIVEN** a spectrum at fs = 48000 Hz with N = 8192, a resolution of 5.86 Hz
- **WHEN** roles are assigned
- **THEN** no role is identified
