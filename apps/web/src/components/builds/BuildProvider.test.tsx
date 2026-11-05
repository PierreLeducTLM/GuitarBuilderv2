// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BuildDetailData } from "@/lib/builds/types";
import { BuildProvider, useBuild } from "./BuildProvider";

vi.mock("@gb/ui", async (original) => ({
  ...(await original<typeof import("@gb/ui")>()),
  useToast: () => ({ show: vi.fn() }),
}));
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const build = (overrides: Partial<BuildDetailData> = {}): BuildDetailData => ({
  id: "b1",
  ownerId: "u1",
  name: "OM #3",
  guitarType: "steel_string",
  boboNeck: false,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  sequenceState: [{ key: "TrussRod", completed: true }],
  ...overrides,
});

function Probe() {
  const { build, canEdit, graph, states, setVariant } = useBuild();
  return (
    <div>
      <p>{`${build.name} ${canEdit} ${graph.steps.length} ${states.TrussRod?.completed}`}</p>
      <button type="button" onClick={() => setVariant({ guitarType: "classical", boboNeck: true })}>
        classical
      </button>
    </div>
  );
}

describe("BuildProvider", () => {
  it("gives its pages the build, the edit right, the displayed steps and the step state", () => {
    render(
      <BuildProvider build={build()} canEdit>
        <Probe />
      </BuildProvider>,
    );
    expect(screen.getByText("OM #3 true 114 true")).toBeTruthy();
  });

  it("recomputes the displayed steps when the variant changes", () => {
    render(
      <BuildProvider build={build()} canEdit={false}>
        <Probe />
      </BuildProvider>,
    );
    act(() => screen.getByRole("button", { name: "classical" }).click());
    expect(screen.getByText("OM #3 false 120 true")).toBeTruthy();
  });

  it("refuses to be used outside a build", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useBuild/);
  });
});
