// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageBar } from "./PageBar";

describe("PageBar", () => {
  it("shows the page title as the page heading", () => {
    render(<PageBar title="Tools" />);
    expect(screen.getByRole("heading", { level: 1, name: "Tools" })).toBeTruthy();
  });

  it("has no return control on a top-level page", () => {
    render(<PageBar title="Tools" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers a control back to the parent page", () => {
    render(<PageBar title="Wood Panel Properties" back={{ href: "/tools", label: "Tools" }} />);
    const back = screen.getByRole("link", { name: "Tools" });
    expect(back.getAttribute("href")).toBe("/tools");
  });

  it("shows the page's actions and details", () => {
    render(
      <PageBar title="OM #3" actions={<button type="button">More actions</button>}>
        <span>Steel-string</span>
      </PageBar>,
    );
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
    expect(screen.getByText("Steel-string")).toBeTruthy();
  });
});
