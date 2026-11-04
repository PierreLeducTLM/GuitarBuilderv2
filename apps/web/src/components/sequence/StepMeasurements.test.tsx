// @vitest-environment jsdom
import type { StepChange, StepMeasurement } from "@gb/db";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogProvider } from "@/components/DialogProvider";
import { formats } from "@/i18n/config";
import { StepStore, type StepStoreOptions } from "@/lib/sequence/store";
import { bodyTaps, stubTapToneBrowser } from "@/test/tap-tone-browser";
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
          stepLabel="Tap test panels"
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

describe("Add Analysis", () => {
  const decodes: Float32Array[] = [];
  afterEach(() => {
    vi.unstubAllGlobals();
    decodes.length = 0;
  });

  const ownerList = (save: StepStoreOptions["save"]) =>
    render(
      <NextIntlClientProvider locale="en" messages={en} formats={formats} timeZone="UTC">
        <DialogProvider>
          <StepMeasurements
            stepKey="TapTestPanels"
            stepLabel="Tap test panels"
            measurements={[]}
            store={new StepStore({ initial: {}, save, onSaveFailed: () => undefined })}
            canEdit
          />
        </DialogProvider>
      </NextIntlClientProvider>,
    );

  it("is offered to the owner even without measurements, and not to read-only viewers", () => {
    renderList([]);
    expect(screen.queryByRole("button", { name: "Add Analysis" })).toBeNull();
    ownerList(vi.fn());
    expect(screen.getByRole("button", { name: "Add Analysis" })).toBeTruthy();
    expect(screen.getAllByText("No sound analysis recorded.")).toHaveLength(2);
  });

  it("records an Instrument analysis and attaches it with its roles under the description", async () => {
    stubTapToneBrowser(decodes);
    decodes.push(bodyTaps());
    const save = vi.fn(async (key: string, _change: StepChange) => ({
      key,
      completed: false,
      notes: "",
      photos: [],
      measurements: [],
    }));
    ownerList(save);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Analysis" }));
    expect(screen.getByText("Analysis for Tap test panels")).toBeTruthy();
    await user.upload(
      screen.getByLabelText("Upload Audio File"),
      new File([new Uint8Array(8)], "tap.wav", { type: "audio/wav" }),
    );
    await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    const description = await screen.findByRole("textbox", { name: "Description" });
    expect(description).toHaveProperty("value", "Resonance Analysis");
    await user.clear(description);
    await user.type(description, "Box closed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [key, change] = save.mock.calls[0] ?? [];
    expect(key).toBe("TapTestPanels");
    if (change?.op !== "add_measurement") throw new Error("expected add_measurement");
    const { measurement } = change;
    expect(measurement.description).toBe("Box closed");
    expect(Math.round(measurement.frequency)).toBe(197);
    expect(measurement.spectrum.fftSize).toBe(32768);
    expect(Object.keys(measurement.roles ?? {}).sort()).toEqual(["air", "back", "top"]);
    expect(measurement.id).toMatch(/^[A-Za-z0-9-]{1,64}$/);
  }, 30000);

  it("attaches nothing when the description is cancelled", async () => {
    stubTapToneBrowser(decodes);
    decodes.push(bodyTaps());
    const save = vi.fn();
    ownerList(save);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Analysis" }));
    await user.upload(
      screen.getByLabelText("Upload Audio File"),
      new File([new Uint8Array(8)], "tap.wav", { type: "audio/wav" }),
    );
    await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("textbox", { name: "Description" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(save).not.toHaveBeenCalled();
  }, 30000);
});
