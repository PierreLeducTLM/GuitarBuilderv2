import { woodProperties } from "@gb/dsp";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { parseInputs, type WoodInputStrings } from "./calculator";
import { reportContent } from "./report";

const SPRUCE: WoodInputStrings = {
  sampleLength: "605",
  sampleWidth: "238",
  sampleThickness: "4.00",
  sampleMass: "228",
  freqLongitudinal: "61.6",
  freqCrossGrain: "105",
  freqDiagonal: "38.2",
  plateLength: "500",
  plateWidth: "380",
  stiffness: "75",
};

const content = (locale: "en" | "fr") =>
  reportContent({
    inputs: parseInputs(SPRUCE),
    properties: woodProperties(parseInputs(SPRUCE)),
    panelName: "Sitka #3",
    generatedAt: new Date("2026-03-14T23:30:00Z"),
    locale,
    timeZone: "America/Toronto",
    messages: (locale === "en" ? en : fr).wood.report,
  });

const rows = (section: {
  groups: { heading: string; rows: { label: string; value: string }[] }[];
}) =>
  section.groups.map((group) => [group.heading, group.rows.map((row) => [row.label, row.value])]);

describe("PDF report contents", () => {
  it("opens with the title, the panel name and the local date and time of generation", () => {
    const report = content("en");
    expect(report.title).toBe("Wood Panel Analysis Report");
    expect(report.panelName).toBe("Sitka #3");
    expect(report.generated.replace(/\s/g, " ")).toBe("Generated on March 14, 2026 at 7:30 PM");
    expect(report.sections.map((section) => section.heading)).toEqual([
      "Input Parameters",
      "Calculated Results",
    ]);
  });

  it("lists the input parameters with their units and precisions", () => {
    expect(rows(content("en").sections[0] ?? { groups: [] })).toEqual([
      [
        "Sample Measurements",
        [
          ["Length (L)", "605 mm"],
          ["Width (W)", "238 mm"],
          ["Thickness (h)", "4 mm"],
          ["Mass (m)", "228 g"],
          ["Density (ρ)", "395.9 kg/m³"],
        ],
      ],
      [
        "Frequency Measurements",
        [
          ["Longitudinal (f_L)", "61.6 Hz"],
          ["Cross-grain (f_C)", "105.0 Hz"],
          ["Diagonal (f_LC)", "38.2 Hz"],
        ],
      ],
      [
        "Target Plate Dimensions",
        [
          ["Plate Length (a)", "500 mm"],
          ["Plate Width (b)", "380 mm"],
        ],
      ],
      ["Vibrational Stiffness Parameter", [["Parameter (f)", "75"]]],
    ]);
  });

  it("lists the calculated results with their units and precisions", () => {
    expect(rows(content("en").sections[1] ?? { groups: [] })).toEqual([
      [
        "Elastic Properties",
        [
          ["Young's Modulus (Longitudinal, E_L)", "11.84 GPa"],
          ["Young's Modulus (Cross-grain, E_C)", "0.82 GPa"],
          ["Shear Modulus (G_LC)", "0.91 GPa"],
        ],
      ],
      [
        "Target Specifications",
        [
          ["Recommended Thickness", "2.77 mm"],
          ["Estimated Panel Mass", "157.5 g"],
        ],
      ],
    ]);
  });

  it("is in French for a French user, with French number formats", () => {
    const report = content("fr");
    expect(report.title).toBe("Rapport d'analyse du panneau de bois");
    expect(report.generated).toBe("Généré le 14 mars 2026 à 19:30");
    expect(report.sections.map((section) => section.heading)).toEqual([
      "Paramètres d'entrée",
      "Résultats calculés",
    ]);
    const [inputs, results] = report.sections;
    expect(inputs?.groups[0]?.rows[4]).toEqual({ label: "Densité (ρ)", value: "395,9 kg/m³" });
    expect(inputs?.groups[1]?.rows[1]).toEqual({ label: "Transversale (f_C)", value: "105,0 Hz" });
    expect(results?.groups.map((group) => group.heading)).toEqual([
      "Propriétés élastiques",
      "Spécifications cibles",
    ]);
    expect(results?.groups[0]?.rows[0]?.value).toBe("11,84 GPa");
    expect(results?.groups[1]?.rows).toEqual([
      { label: "Épaisseur recommandée", value: "2,77 mm" },
      { label: "Masse estimée du panneau", value: "157,5 g" },
    ]);
  });

  it("keeps decimals typed into the inputs, in the user's locale", () => {
    const report = reportContent({
      inputs: parseInputs({ ...SPRUCE, sampleThickness: "3.25", plateWidth: "380.5" }),
      properties: woodProperties(parseInputs(SPRUCE)),
      panelName: "Sitka #3",
      generatedAt: new Date("2026-03-14T12:00:00Z"),
      locale: "fr",
      timeZone: "UTC",
      messages: fr.wood.report,
    });
    expect(report.sections[0]?.groups[0]?.rows[2]?.value).toBe("3,25 mm");
    expect(report.sections[0]?.groups[2]?.rows[1]?.value).toBe("380,5 mm");
  });
});
