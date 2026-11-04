// @vitest-environment jsdom
import type { StepMeasurement } from "@gb/db";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { DialogProvider } from "@/components/DialogProvider";
import { formats } from "@/i18n/config";
import { StepStore } from "@/lib/sequence/store";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { StepMeasurements } from "./StepMeasurements";

const measurement = (overrides: Partial<StepMeasurement> = {}): StepMeasurement => ({
  id: "m1",
  timestamp: 1762257600000,
  description: "Box closed",
  frequency: 196.94,
  spectrum: {
    frequencies: [100, 200],
    magnitudes: [0.01, 0.1],
    magnitudesDb: [-40, -20],
    sampleRate: 48000,
    fftSize: 32768,
    binWidth: 1.46484375,
  },
  ...overrides,
});

const store = new StepStore({
  initial: {},
  save: async () => Promise.reject(new Error("not used")),
  onSaveFailed: () => undefined,
});

const renderList = (measurements: StepMeasurement[], locale: "en" | "fr" = "en") =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      formats={formats}
      timeZone="UTC"
    >
      <DialogProvider>
        <StepMeasurements
          stepKey="TapTestPanels"
          measurements={measurements}
          store={store}
          canEdit={false}
        />
      </DialogProvider>
    </NextIntlClientProvider>,
  );

const role = (frequency: number) => ({
  frequency,
  level: -20,
  spectralQ: 30,
  decayQ: null,
  origin: "auto" as const,
});

describe("StepMeasurements roles", () => {
  it("lists the identified roles under the peak, in body order", () => {
    renderList([measurement({ roles: { top: role(196.94), air: role(98.41) } })]);
    expect(screen.getByText("Peak: 196.9 Hz")).toBeTruthy();
    expect(screen.getByText("Air 98.4 Hz · Top 196.9 Hz")).toBeTruthy();
  });

  it("names the roles in French", () => {
    renderList(
      [measurement({ roles: { air: role(98.41), top: role(196.94), back: role(247.5) } })],
      "fr",
    );
    expect(screen.getByText("Air 98,4 Hz · Table 196,9 Hz · Fond 247,5 Hz")).toBeTruthy();
  });

  it("shows no roles line for a measurement without roles", () => {
    const { container } = renderList([measurement()]);
    expect(container.querySelector("[data-roles]")).toBeNull();
    expect(screen.getByText("Peak: 196.9 Hz")).toBeTruthy();
  });
});
