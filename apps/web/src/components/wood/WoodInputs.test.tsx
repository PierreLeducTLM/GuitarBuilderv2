// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_INPUTS } from "@/lib/wood/calculator";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { WoodInputs } from "./WoodInputs";

type Props = ComponentProps<typeof WoodInputs>;

function renderInputs(quality: Props["quality"], locale: "en" | "fr" = "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <WoodInputs
        inputs={DEFAULT_INPUTS}
        errors={{}}
        quality={quality}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

const fieldFrame = (label: string) => {
  const frame = screen
    .getByRole("spinbutton", { name: new RegExp(`^${label.replace(/[()]/g, "\\$&")}`) })
    .closest("[data-field]");
  if (!(frame instanceof HTMLElement)) throw new Error(`no frame for ${label}`);
  return within(frame);
};

describe("measured Q line", () => {
  it("shows each measured take's spectral and decay Q under its field, without decimals", () => {
    renderInputs({
      longitudinal: { spectralQ: 64.3, decayQ: 71.8 },
      crossGrain: { spectralQ: 41.2, decayQ: null },
    });
    expect(
      fieldFrame(en.wood.fields.freqLongitudinal).getByText("Spectral Q 64 · Decay Q 72"),
    ).toBeDefined();
    expect(
      fieldFrame(en.wood.fields.freqCrossGrain).getByText("Spectral Q 41 · Decay Q —"),
    ).toBeDefined();
    expect(fieldFrame(en.wood.fields.freqDiagonal).queryByText(/Spectral Q/)).toBeNull();
    expect(screen.getAllByText(/Spectral Q/)).toHaveLength(2);
  });

  it("shows a missing spectral Q as a dash, in French", () => {
    renderInputs({ diagonal: { spectralQ: null, decayQ: 12.5 } }, "fr");
    expect(
      fieldFrame(fr.wood.fields.freqDiagonal).getByText("Q spectral — · Q de décroissance 13"),
    ).toBeDefined();
  });

  it("shows no Q line without measured takes", () => {
    renderInputs({});
    expect(screen.queryByText(/Spectral Q/)).toBeNull();
  });
});

describe("frequency tiles", () => {
  const frequencyGroup = () =>
    within(screen.getByRole("group", { name: en.wood.groups.frequency }));

  it("shows the three takes in the reader's order, names and symbols", () => {
    renderInputs({});
    const tiles = frequencyGroup()
      .getAllByRole("spinbutton")
      .map((input) => input.closest("[data-field]")?.textContent ?? "");
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toMatch(/^Longitudinal.*fL/);
    expect(tiles[1]).toMatch(/^Cross-grain.*fC/);
    expect(tiles[2]).toMatch(/^Diagonal.*fLC/);
  });

  it("uses the reader's take names in French", () => {
    renderInputs({}, "fr");
    expect(
      fieldFrame(fr.wood.fields.freqCrossGrain).getByText(fr.tapTone.takes.name.crossGrain),
    ).toBeDefined();
  });

  it("keeps each input's name, value and unit", () => {
    renderInputs({});
    const longitudinal = screen.getByRole("spinbutton", {
      name: `${en.wood.fields.freqLongitudinal} Hz`,
    });
    expect(longitudinal).toHaveProperty("value", "180");
  });

  it("reports what the user types", async () => {
    const onChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <WoodInputs
          inputs={DEFAULT_INPUTS}
          errors={{}}
          quality={{}}
          onChange={onChange}
          onReset={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    const diagonal = screen.getByRole("spinbutton", { name: /^Diagonal/ });
    await userEvent.type(diagonal, "5");
    expect(onChange).toHaveBeenLastCalledWith("freqDiagonal", "1205");
  });

  it("shows the note of a valid frequency", () => {
    renderInputs({});
    expect(fieldFrame(en.wood.fields.freqLongitudinal).getByText("F#3 -47 c")).toBeDefined();
    expect(fieldFrame(en.wood.fields.freqDiagonal).getByText("B2 -49 c")).toBeDefined();
  });

  it("shows the hint and, for an invalid value, the error instead of a note", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <WoodInputs
          inputs={{ ...DEFAULT_INPUTS, freqCrossGrain: "" }}
          errors={{ freqCrossGrain: "freqCrossGrain" }}
          quality={{}}
          onChange={vi.fn()}
          onReset={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    const crossGrain = screen.getByRole("spinbutton", { name: /^Cross-grain/ });
    const tile = fieldFrame(en.wood.fields.freqCrossGrain);
    expect(crossGrain.getAttribute("aria-invalid")).toBe("true");
    expect(tile.getByText(en.wood.validation.freqCrossGrain)).toBeDefined();
    expect(tile.getByText(en.wood.hints.freqCrossGrain)).toBeDefined();
    expect(tile.queryByText(/ c$/)).toBeNull();
  });
});

describe("measurement tiles", () => {
  it("shows every other field as a tile with a short name, symbol, value and unit", () => {
    renderInputs({});
    const tiles = screen
      .getAllByRole("spinbutton")
      .map((input) => input.closest("[data-field]")?.textContent ?? "");
    expect(tiles).toHaveLength(10);
    expect(
      fieldFrame(en.wood.fields.sampleThickness).getByText(en.wood.tiles.sampleThickness),
    ).toBeDefined();
    expect(fieldFrame(en.wood.fields.sampleThickness).getByText("h")).toBeDefined();
    expect(fieldFrame(en.wood.fields.sampleMass).getByText("g")).toBeDefined();
    expect(fieldFrame(en.wood.fields.plateWidth).getByText("b")).toBeDefined();
  });

  it("names each tile in French", () => {
    renderInputs({}, "fr");
    expect(fieldFrame(fr.wood.fields.sampleMass).getByText(fr.wood.tiles.sampleMass)).toBeDefined();
  });

  it("keeps each input's name with its unit, and none for the stiffness parameter", () => {
    renderInputs({});
    expect(
      screen.getByRole("spinbutton", { name: `${en.wood.fields.sampleLength} mm` }),
    ).toHaveProperty("value", "280");
    expect(screen.getByRole("spinbutton", { name: en.wood.fields.stiffness })).toHaveProperty(
      "value",
      "75",
    );
  });

  it("shows the hint and the error in the tile, without a note", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <WoodInputs
          inputs={{ ...DEFAULT_INPUTS, stiffness: "-5" }}
          errors={{ stiffness: "stiffness" }}
          quality={{}}
          onChange={vi.fn()}
          onReset={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    const tile = fieldFrame(en.wood.fields.stiffness);
    expect(tile.getByText(en.wood.validation.stiffness)).toBeDefined();
    expect(tile.getByText(en.wood.hints.stiffness)).toBeDefined();
    expect(fieldFrame(en.wood.fields.sampleLength).queryByText(/ c$/)).toBeNull();
  });
});
