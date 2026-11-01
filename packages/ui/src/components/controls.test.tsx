// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.tsx";
import { TextField } from "./Field.tsx";
import { IconButton } from "./IconButton.tsx";
import { LedProgress, litSegments } from "./LedProgress.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

describe("Button", () => {
  it("is a real button that does not submit forms by default", () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("min-h-11");
  });
});

describe("IconButton", () => {
  it("exposes its label as the accessible name and tooltip", () => {
    render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.getAttribute("title")).toBe("Close");
    expect(button.className).toContain("size-11");
  });
});

describe("TextField", () => {
  it("associates the label, hint and error with the input", () => {
    render(<TextField label="Password" hint="Minimum 6 characters" error="Too short" />);
    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = (input.getAttribute("aria-describedby") ?? "").split(" ");
    const texts = describedBy.map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual(["Too short", "Minimum 6 characters"]);
  });

  it("is not flagged without an error", () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText("Email").hasAttribute("aria-invalid")).toBe(false);
  });
});

function ThemePicker({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<"light" | "system" | "dark">("system");
  return (
    <SegmentedControl
      label="Theme"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      options={[
        { value: "light", label: "L", ariaLabel: "Light Mode", title: "Light Mode" },
        { value: "system", label: "S", ariaLabel: "System Theme", title: "System Theme" },
        { value: "dark", label: "D", ariaLabel: "Dark Mode", title: "Dark Mode" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a named group of native radio buttons with the value checked", () => {
    render(<ThemePicker />);
    expect(screen.getByRole("group", { name: "Theme" })).toBeTruthy();
    const system = screen.getByRole("radio", { name: "System Theme" }) as HTMLInputElement;
    expect(system.checked).toBe(true);
    expect(system.closest("label")?.getAttribute("title")).toBe("System Theme");
    expect(system.closest("label")?.hasAttribute("data-checked")).toBe(true);
  });

  it("selects with clicks and the arrow keys, wrapping around", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThemePicker onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Dark Mode" }));
    expect(onChange).toHaveBeenLastCalledWith("dark");
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("light");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Light Mode" }));
  });
});

describe("LedProgress", () => {
  it("exposes progressbar values and lights the right number of segments", () => {
    render(<LedProgress label="Build progress" value={30} max={120} valueText="30 / 120" />);
    const bar = screen.getByRole("progressbar", { name: "Build progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("30");
    expect(bar.getAttribute("aria-valuemax")).toBe("120");
    expect(bar.getAttribute("aria-valuetext")).toBe("30 / 120");
    expect(bar.querySelectorAll("[data-lit]").length).toBe(6);
  });

  it("lights at least one segment once there is progress, and none without", () => {
    expect(litSegments(1, 132, 24)).toBe(1);
    expect(litSegments(0, 132, 24)).toBe(0);
    expect(litSegments(200, 100, 24)).toBe(24);
    expect(litSegments(5, 0, 24)).toBe(0);
  });
});
