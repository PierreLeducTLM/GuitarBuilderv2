// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
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
