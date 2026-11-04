// @vitest-environment jsdom
import type { Tap } from "@gb/dsp";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { formats } from "@/i18n/config";
import en from "../../../messages/en.json";
import { TapWaveform } from "./TapWaveform";

const SECONDS = 3.4;
const signal = new Float64Array(Math.round(SECONDS * 48000));
const taps: readonly Tap[] = [
  { number: 1, onset: 24000, rejection: null },
  { number: 2, onset: 76800, rejection: null },
  { number: 3, onset: 132000, rejection: "clipped" },
];

function Harness() {
  const [excluded, setExcluded] = useState<readonly number[]>([]);
  return (
    <NextIntlClientProvider locale="en" messages={en} formats={formats} timeZone="UTC">
      <TapWaveform
        signal={signal}
        sampleRate={48000}
        taps={taps}
        excluded={excluded}
        onToggle={(number) =>
          setExcluded((current) =>
            current.includes(number) ? current.filter((n) => n !== number) : [...current, number],
          )
        }
      />
    </NextIntlClientProvider>
  );
}

describe("TapWaveform", () => {
  it("spans the recording with time labels in seconds and numbers each tap at its onset", () => {
    const { container } = render(<Harness />);
    expect([...container.querySelectorAll("[data-time]")].map((l) => l.textContent)).toEqual([
      "0 s",
      "1 s",
      "2 s",
      "3 s",
    ]);
    expect(screen.getByRole("button", { name: "Tap 1" }).style.left).toBe(
      `${(24000 / signal.length) * 100}%`,
    );
    expect(screen.getByText("2 of 3 taps used")).toBeTruthy();
  });

  it("shades each tap's spectrum window", () => {
    const { container } = render(<Harness />);
    const window = container.querySelector("[data-window='2']");
    expect(Number(window?.getAttribute("x"))).toBeCloseTo(
      ((76800 - 8192) / signal.length) * 640,
      6,
    );
    expect(Number(window?.getAttribute("width"))).toBeCloseTo((32768 / signal.length) * 640, 6);
  });

  it("excludes and re-includes a used tap", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tap2 = screen.getByRole("button", { name: "Tap 2" });
    expect(tap2.getAttribute("aria-pressed")).toBe("true");
    await user.click(tap2);
    expect(tap2.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("1 of 3 taps used")).toBeTruthy();
    await user.click(tap2);
    expect(screen.getByText("2 of 3 taps used")).toBeTruthy();
  });

  it("toggles a focused tap with Space and announces it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "Tap 2" }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("status").textContent).toBe("Tap 2 excluded");
    await user.keyboard(" ");
    expect(screen.getByRole("status").textContent).toBe("Tap 2 included");
  });

  it("shows why a tap was rejected and never uses it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tap3 = screen.getByRole("button", { name: "Tap 3" });
    expect(tap3.getAttribute("aria-disabled")).toBe("true");
    await user.hover(tap3);
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("Clipped"));
    await user.click(tap3);
    expect(screen.getByText("2 of 3 taps used")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
