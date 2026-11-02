// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { OpenStepContext, StepNode, stepNumberLabel } from "./StepNode";

type Props = ComponentProps<typeof StepNode>;

function renderNode(data: Props["data"], { locale = "en" as "en" | "fr", onOpen = vi.fn() } = {}) {
  const props = { id: data.stepKey, data, type: "step" } as unknown as Props;
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <ReactFlowProvider>
        <OpenStepContext.Provider value={onOpen}>
          <StepNode {...props} />
        </OpenStepContext.Provider>
      </ReactFlowProvider>
    </NextIntlClientProvider>,
  );
  return onOpen;
}

describe("StepNode", () => {
  it("pads step numbers to three digits", () => {
    expect(stepNumberLabel(7)).toBe("007");
    expect(stepNumberLabel(36)).toBe("036");
    expect(stepNumberLabel(132)).toBe("132");
  });

  it("names the step with its number, label and state, and opens it when activated", async () => {
    const onOpen = renderNode({
      stepKey: "FitGlueBraces",
      number: 36,
      status: "ready",
      highlight: null,
    });
    const button = screen.getByRole("button", { name: "Step 036: Fit and glue braces, Ready" });
    expect(button).toHaveProperty("dataset.status", "ready");
    expect(button.textContent).toContain("036");
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith("FitGlueBraces");
  });

  it("shows the completion badge only on completed steps", () => {
    renderNode({ stepKey: "Neck", number: 17, status: "completed", highlight: null });
    expect(screen.getByRole("button", { name: "Step 017: Neck, Completed" })).toBeDefined();
    expect(screen.getByTestId("completion-badge")).toBeDefined();
  });

  it("marks the variant highlight and is not started by default", () => {
    renderNode({ stepKey: "CLCutBOBO", number: 19, status: "notStarted", highlight: "variant" });
    const button = screen.getByRole("button", {
      name: "Step 019: CL cut off BOBO slat, Not started",
    });
    expect(button.dataset.highlight).toBe("variant");
    expect(screen.queryByTestId("completion-badge")).toBeNull();
  });

  it("uses the French label and state names", () => {
    renderNode(
      { stepKey: "TrussRod", number: 1, status: "ready", highlight: null },
      { locale: "fr" },
    );
    expect(
      screen.getByRole("button", { name: "Étape 001 : Tige de réglage, Prête" }),
    ).toBeDefined();
  });
});
