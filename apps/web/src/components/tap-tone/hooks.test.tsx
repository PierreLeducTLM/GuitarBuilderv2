// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetChosenInput, useAudioInputs, usePlayback, useRecorder } from "./hooks";

type FakeDevice = { deviceId: string; kind: MediaDeviceKind; label: string };

const fakeMediaDevices = (initial: readonly FakeDevice[]) => {
  const state = { devices: [...initial], listeners: [] as (() => void)[] };
  const tracks = [{ stop: vi.fn() }];
  const getUserMedia = vi.fn(async () => ({ getTracks: () => tracks }));
  const mediaDevices = {
    enumerateDevices: vi.fn(async () => state.devices),
    getUserMedia,
    addEventListener: (_: string, listener: () => void) => state.listeners.push(listener),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("navigator", { ...navigator, mediaDevices });
  return {
    mediaDevices,
    tracks,
    plugIn: (device: FakeDevice) => {
      state.devices = [...state.devices, device];
      for (const listener of state.listeners) listener();
    },
    nameAll: () => {
      state.devices = state.devices.map((d, i) => ({ ...d, label: `Mic ${i + 1} real` }));
    },
  };
};

const input = (deviceId: string, label = ""): FakeDevice => ({
  deviceId,
  kind: "audioinput",
  label,
});

afterEach(() => {
  forgetChosenInput();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useAudioInputs", () => {
  it("lists the inputs without asking for the microphone", async () => {
    const media = fakeMediaDevices([
      input("a"),
      input("b"),
      { deviceId: "cam", kind: "videoinput", label: "" },
    ]);
    const { result } = renderHook(() => useAudioInputs());
    await waitFor(() => expect(result.current.inputs).toHaveLength(2));
    expect(result.current.inputs).toEqual([
      { id: "a", label: null },
      { id: "b", label: null },
    ]);
    expect(media.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("selects the default input, else the first, and remembers the choice while the page stays open", async () => {
    fakeMediaDevices([input("a", "A"), input("default", "Default"), input("b", "B")]);
    const first = renderHook(() => useAudioInputs());
    await waitFor(() => expect(first.result.current.selected).toBe("default"));
    act(() => first.result.current.select("b"));
    first.unmount();
    const second = renderHook(() => useAudioInputs());
    await waitFor(() => expect(second.result.current.inputs).toHaveLength(3));
    expect(second.result.current.selected).toBe("b");
  });

  it("falls back to the first input without a default", async () => {
    fakeMediaDevices([input("a"), input("b")]);
    const { result } = renderHook(() => useAudioInputs());
    await waitFor(() => expect(result.current.selected).toBe("a"));
  });

  it("adds a microphone plugged in while open, and shows real names after a refresh", async () => {
    const media = fakeMediaDevices([input("a")]);
    const { result } = renderHook(() => useAudioInputs());
    await waitFor(() => expect(result.current.inputs).toHaveLength(1));
    act(() => media.plugIn(input("usb")));
    await waitFor(() => expect(result.current.inputs).toHaveLength(2));
    media.nameAll();
    await act(() => result.current.refresh());
    expect(result.current.inputs.map((i) => i.label)).toEqual(["Mic 1 real", "Mic 2 real"]);
  });
});

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  readonly mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  started: number | null = null;
  constructor(_stream: unknown, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
    FakeRecorder.instances.push(this);
  }
  start(timeslice: number) {
    this.started = timeslice;
    this.ondataavailable?.({ data: new Blob(["chunk"]) });
  }
  stop() {
    this.onstop?.();
  }
}

const fakeAudioContext = () => {
  const closed = vi.fn(async () => undefined);
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const contexts: unknown[] = [];
  class FakeContext {
    constructor() {
      contexts.push(this);
    }
    destination = {};
    createMediaStreamSource() {
      return { connect: vi.fn() };
    }
    createAnalyser() {
      return { fftSize: 0, getFloatTimeDomainData: vi.fn() };
    }
    createBuffer(_channels: number, length: number, sampleRate: number) {
      return { length, sampleRate, copyToChannel: vi.fn() };
    }
    createBufferSource() {
      const source = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      sources.push(source);
      return source;
    }
    close = closed;
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return { closed, sources, contexts };
};

describe("useRecorder", () => {
  const setup = () => {
    FakeRecorder.instances = [];
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    fakeAudioContext();
    const media = fakeMediaDevices([input("usb", "USB")]);
    const onFinished = vi.fn();
    const onError = vi.fn();
    const hook = renderHook(() => useRecorder({ deviceId: "usb", onFinished, onError }));
    return { media, onFinished, onError, hook };
  };

  it("opens the chosen microphone raw, records in 100 ms chunks of the best supported type", async () => {
    const { media, hook } = setup();
    await act(() => hook.result.current.start());
    expect(media.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: "usb" },
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    expect(FakeRecorder.instances[0]?.mimeType).toBe("audio/webm;codecs=opus");
    expect(FakeRecorder.instances[0]?.started).toBe(100);
    expect(hook.result.current.recording).toBe(true);
  });

  it("counts elapsed time every 0.1 s and stops by itself at 10.0 s", async () => {
    vi.useFakeTimers();
    const { media, onFinished, hook } = setup();
    await act(() => hook.result.current.start());
    act(() => vi.advanceTimersByTime(2300));
    expect(hook.result.current.elapsed).toBeCloseTo(2.3, 5);
    act(() => vi.advanceTimersByTime(7700));
    expect(hook.result.current.recording).toBe(false);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0]?.[0]).toMatchObject({ type: "audio/webm;codecs=opus" });
    expect(media.tracks[0]?.stop).toHaveBeenCalled();
  });

  it("hands over the recording and releases the microphone on Stop", async () => {
    const { media, onFinished, hook } = setup();
    await act(() => hook.result.current.start());
    act(() => hook.result.current.stop());
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(media.tracks[0]?.stop).toHaveBeenCalled();
  });

  it("discards the recording and releases the microphone on cancel", async () => {
    const { media, onFinished, hook } = setup();
    await act(() => hook.result.current.start());
    act(() => hook.result.current.cancel());
    expect(onFinished).not.toHaveBeenCalled();
    expect(media.tracks[0]?.stop).toHaveBeenCalled();
    expect(hook.result.current.recording).toBe(false);
  });

  it("reports a microphone that cannot be opened", async () => {
    const { media, onError, hook } = setup();
    media.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error("NotAllowedError"));
    await act(() => hook.result.current.start());
    expect(onError).toHaveBeenCalledWith("microphone");
    expect(hook.result.current.recording).toBe(false);
  });
});

describe("usePlayback", () => {
  it("plays through one audio context, turns back to Play at the end and closes it on unmount", async () => {
    const audio = fakeAudioContext();
    const { result, unmount } = renderHook(() => usePlayback());
    const clip = { channels: [new Float64Array(480)], sampleRate: 48000 };
    act(() => result.current.play(clip));
    expect(result.current.playing).toBe(true);
    expect(audio.sources[0]?.start).toHaveBeenCalled();
    act(() => audio.sources[0]?.onended?.());
    expect(result.current.playing).toBe(false);
    act(() => result.current.play(clip));
    act(() => result.current.stop());
    expect(audio.sources[1]?.stop).toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
    expect(audio.contexts).toHaveLength(1);
    unmount();
    expect(audio.closed).toHaveBeenCalled();
  });
});
