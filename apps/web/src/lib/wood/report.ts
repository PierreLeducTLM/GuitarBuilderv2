import type { WoodInputs, WoodProperties } from "@gb/dsp";
import { formats } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatValue } from "./calculator";

export type ReportMessages = Messages["wood"]["report"];

export interface ReportRow {
  label: string;
  value: string;
}

export interface ReportGroup {
  heading: string;
  rows: ReportRow[];
}

export interface ReportSection {
  heading: string;
  groups: ReportGroup[];
}

/** wood-panel-properties: PDF Report Contents, as text ready to lay out. */
export interface ReportContent {
  title: string;
  panelName: string;
  generated: string;
  sections: ReportSection[];
  /** The AI analysis as plain paragraphs, added by `knowledge-assistant`. */
  analysis?: { heading: string; paragraphs: string[] };
}

export function reportContent(options: {
  inputs: WoodInputs;
  properties: WoodProperties;
  panelName: string;
  generatedAt: Date;
  locale: string;
  timeZone: string;
  messages: ReportMessages;
}): ReportContent {
  const { inputs, properties, locale, messages } = options;
  const labels = messages.labels;
  const fixed = (value: number, decimals: number, unit: string) =>
    `${formatValue(value, decimals, locale)} ${unit}`;
  const typed = (value: number, unit: string) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)} ${unit}`;
  const date = new Intl.DateTimeFormat(locale, {
    ...formats.dateTime.long,
    timeZone: options.timeZone,
  }).format(options.generatedAt);

  return {
    title: messages.title,
    panelName: options.panelName,
    generated: messages.generatedOn.replace("{date}", date),
    sections: [
      {
        heading: messages.inputParameters,
        groups: [
          {
            heading: messages.groups.sample,
            rows: [
              { label: labels.length, value: typed(inputs.lengthMm, "mm") },
              { label: labels.width, value: typed(inputs.widthMm, "mm") },
              { label: labels.thickness, value: typed(inputs.thicknessMm, "mm") },
              { label: labels.mass, value: typed(inputs.massG, "g") },
              { label: labels.density, value: fixed(properties.density, 1, "kg/m³") },
            ],
          },
          {
            heading: messages.groups.frequency,
            rows: [
              { label: labels.longitudinal, value: fixed(inputs.fLongHz, 1, "Hz") },
              { label: labels.crossGrain, value: fixed(inputs.fCrossHz, 1, "Hz") },
              { label: labels.diagonal, value: fixed(inputs.fDiagHz, 1, "Hz") },
            ],
          },
          {
            heading: messages.groups.plate,
            rows: [
              { label: labels.plateLength, value: typed(inputs.plateLengthMm, "mm") },
              { label: labels.plateWidth, value: typed(inputs.plateWidthMm, "mm") },
            ],
          },
          {
            heading: messages.groups.stiffness,
            rows: [{ label: labels.stiffness, value: typed(inputs.stiffness, "").trim() }],
          },
        ],
      },
      {
        heading: messages.calculatedResults,
        groups: [
          {
            heading: messages.groups.elastic,
            rows: [
              { label: labels.eLong, value: fixed(properties.eLong, 2, "GPa") },
              { label: labels.eCross, value: fixed(properties.eCross, 2, "GPa") },
              { label: labels.shear, value: fixed(properties.gLc, 2, "GPa") },
            ],
          },
          {
            heading: messages.groups.target,
            rows: [
              { label: labels.targetThickness, value: fixed(properties.targetThickness, 2, "mm") },
              { label: labels.estimatedMass, value: fixed(properties.estimatedMass, 1, "g") },
            ],
          },
        ],
      },
    ],
  };
}
