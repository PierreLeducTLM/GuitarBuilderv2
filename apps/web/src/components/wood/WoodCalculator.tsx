"use client";

import { woodProperties } from "@gb/dsp";
import { Button, Panel } from "@gb/ui";
import { AudioLines } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useReducer, useState } from "react";
import { TapToneDialog } from "@/components/tap-tone/TapToneDialog";
import { parseInputs, validateInputs } from "@/lib/wood/calculator";
import { type CalculatorState, calculatorReducer, INITIAL_CALCULATOR } from "@/lib/wood/panel";
import type { WoodPanelSummary } from "@/lib/wood/types";
import { useWoodPanels } from "./useWoodPanels";
import { useWoodReport } from "./useWoodReport";
import { WoodInputs } from "./WoodInputs";
import { WoodLibrary } from "./WoodLibrary";
import { WoodResults } from "./WoodResults";
import { WoodSaveForm } from "./WoodSaveForm";

function Area({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <Panel padding="lg" className="flex flex-col gap-5">
        <h2 id={id} className="text-xl font-semibold text-fg">
          {title}
        </h2>
        {children}
      </Panel>
    </section>
  );
}

const positive = (value: number) => (value > 0 && Number.isFinite(value) ? [value] : []);

/** The fields' current values, as the reader preselects the nearest peak (Tap-Tone Spectrum Review). */
const plateValues = (inputs: CalculatorState["inputs"]) => {
  const values = parseInputs(inputs);
  return Object.fromEntries([
    ...positive(values.fLongHz).map((value) => ["longitudinal", value] as const),
    ...positive(values.fCrossHz).map((value) => ["crossGrain", value] as const),
    ...positive(values.fDiagHz).map((value) => ["diagonal", value] as const),
  ]);
};

/** wood-panel-properties: the calculator page with its three areas. */
export function WoodCalculator({ panels }: { panels: WoodPanelSummary[] | null }) {
  const t = useTranslations("wood");
  const [state, dispatch] = useReducer(calculatorReducer, INITIAL_CALCULATOR);
  const actions = useWoodPanels(state, dispatch);
  const downloadReport = useWoodReport(state);
  const [measuring, setMeasuring] = useState(false);
  const tTapTone = useTranslations("tapTone");
  const errors = validateInputs(state.inputs);
  const properties =
    Object.keys(errors).length === 0 ? woodProperties(parseInputs(state.inputs)) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">{t("title")}</h1>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Area id="wood-inputs-title" title={t("areas.inputs")}>
          <WoodInputs
            inputs={state.inputs}
            errors={errors}
            quality={state.quality}
            groupExtras={{
              frequency: (
                <div>
                  <Button
                    variant="secondary"
                    icon={<AudioLines className="size-4" />}
                    onClick={() => setMeasuring(true)}
                  >
                    {t("plate.measure")}
                  </Button>
                </div>
              ),
            }}
            onChange={(key, value) => dispatch({ type: "edited", key, value })}
            onReset={() => dispatch({ type: "reset" })}
          />
        </Area>
        <Area id="wood-results-title" title={t("areas.results")} className="lg:sticky lg:top-6">
          <WoodResults properties={properties}>
            <WoodSaveForm
              name={state.name}
              updating={state.loadedId !== null}
              saving={actions.saving}
              onNameChange={(name) => dispatch({ type: "named", name })}
              onSave={actions.save}
            />
          </WoodResults>
        </Area>
      </div>
      <Area id="wood-library-title" title={t("areas.library")}>
        <WoodLibrary
          panels={panels}
          loadedId={state.loadedId}
          onOpen={actions.open}
          onDelete={actions.remove}
          onLoadDefaults={actions.loadDefaults}
          loadingDefaults={actions.loadingDefaults}
          onReport={(panel) => downloadReport(panel.name)}
        />
      </Area>
      {measuring ? (
        <TapToneDialog
          open
          mode="plate"
          label={tTapTone("plateLabel")}
          currentValues={plateValues(state.inputs)}
          savedRecords={state.spectra}
          onConfirm={(takes) => {
            dispatch({ type: "measured", takes });
            setMeasuring(false);
          }}
          onCancel={() => setMeasuring(false)}
        />
      ) : null}
    </div>
  );
}
