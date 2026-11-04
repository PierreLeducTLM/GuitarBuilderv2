// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, type ConfirmSeverity } from "./ConfirmDialog.tsx";
import { DialogFrame } from "./Dialog.tsx";
import { TextInputDialog } from "./TextInputDialog.tsx";
import { ToastProvider, useToast } from "./Toast.tsx";
import { Tooltip } from "./Tooltip.tsx";

function ConfirmHarness({
  onConfirm,
  variant,
}: {
  onConfirm: () => void;
  variant?: ConfirmSeverity;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete"
        message="Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        closeLabel="Close"
        variant={variant}
        onConfirm={onConfirm}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("performs the action and closes when confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onConfirm={onConfirm} variant="danger" />);
    const dialog = screen.getByRole("dialog", { name: "Delete" });
    const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1);
    expect(confirm?.getAttribute("data-severity")).toBe("danger");
    expect(dialog.textContent).toContain("Are you sure?");
    if (!confirm) throw new Error("confirm button missing");
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it.each([
    ["cancel button", () => screen.getByRole("button", { name: "Cancel" })],
    ["close button", () => screen.getByRole("button", { name: "Close" })],
    ["backdrop", () => screen.getByTestId("dialog-backdrop")],
  ])("is dismissed by the %s without performing the action", async (_name, target) => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onConfirm={onConfirm} />);
    await user.click(target());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it("uses warning emphasis by default", () => {
    render(<ConfirmHarness onConfirm={() => {}} />);
    const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1);
    expect(confirm?.getAttribute("data-severity")).toBe("warning");
  });
});

function InputHarness({ onConfirm }: { onConfirm: (value: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <TextInputDialog
        open={open}
        onOpenChange={setOpen}
        title="Rename analysis"
        inputLabel="Name"
        initialValue="Resonance Analysis"
        confirmLabel="Save"
        cancelLabel="Cancel"
        closeLabel="Close"
        onConfirm={onConfirm}
      />
    </>
  );
}

describe("TextInputDialog", () => {
  it("opens with the initial value focused and selected", () => {
    render(<InputHarness onConfirm={() => {}} />);
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.value).toBe("Resonance Analysis");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Resonance Analysis".length);
  });

  it("returns the trimmed value when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<InputHarness onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "  Top tap test  {Enter}");
    expect(onConfirm).toHaveBeenCalledWith("Top tap test");
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it("disables confirming while the value is blank", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<InputHarness onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "   ");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("returns nothing when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<InputHarness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });
});

function ToastButtons() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.show({ type: "error", message: "Save failed" })}>
        error
      </button>
      <button type="button" onClick={() => toast.show({ type: "success", message: "Saved" })}>
        success
      </button>
    </>
  );
}

function renderToasts() {
  return render(
    <ToastProvider
      closeLabel="Dismiss"
      regionLabel="Notifications"
      typeLabels={{ success: "Success", error: "Error", warning: "Warning", info: "Information" }}
    >
      <ToastButtons />
    </ToastProvider>,
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an error toast with its message as an alert", () => {
    renderToasts();
    act(() => screen.getByText("error").click());
    const toast = screen.getByRole("alert");
    expect(toast.textContent).toContain("Save failed");
    expect(toast.getAttribute("data-type")).toBe("error");
  });

  it("fades out after 3 seconds and is removed about 300 ms later", () => {
    renderToasts();
    act(() => screen.getByText("success").click());
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole("status").hasAttribute("data-leaving")).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status").hasAttribute("data-leaving")).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stacks several toasts and removes one at once with its close button", () => {
    renderToasts();
    act(() => screen.getByText("error").click());
    act(() => screen.getByText("success").click());
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(2);
    act(() => screen.getAllByRole("button", { name: "Dismiss" })[0]?.click());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Saved");
  });

  it("does not block the page behind it", () => {
    renderToasts();
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.className).toContain("pointer-events-none");
  });
});

const Help = () => (
  <Tooltip content="Tap the bridge firmly">
    <button type="button" aria-label="Help">
      ?
    </button>
  </Tooltip>
);

describe("Tooltip", () => {
  it("opens when the pointer rests on its trigger", async () => {
    const user = userEvent.setup();
    render(<Help />);
    await user.hover(screen.getByRole("button", { name: "Help" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("Tap the bridge firmly");
  });

  it("opens when its trigger gets keyboard focus", async () => {
    const user = userEvent.setup();
    render(<Help />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });

  it("toggles on a tap, for touch screens without hover", async () => {
    const user = userEvent.setup();
    render(<Help />);
    const trigger = screen.getByRole("button", { name: "Help" });
    await user.pointer({ keys: "[TouchA]", target: trigger });
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    await user.pointer({ keys: "[TouchA]", target: trigger });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Help />);
    await user.tab();
    await screen.findByRole("tooltip");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});

const Frame = ({ dismissOnOutsideClick }: { dismissOnOutsideClick?: boolean }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="frame-state">{open ? "open" : "closed"}</span>
      <DialogFrame
        open={open}
        onOpenChange={setOpen}
        title="Frequency Detector"
        closeLabel="Close"
        size="xl"
        {...(dismissOnOutsideClick === undefined ? {} : { dismissOnOutsideClick })}
      >
        content
      </DialogFrame>
    </>
  );
};

describe("DialogFrame", () => {
  it("closes on an outside click by default", async () => {
    const user = userEvent.setup();
    render(<Frame />);
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(screen.getByTestId("frame-state").textContent).toBe("closed");
  });

  it("can ignore outside clicks while still closing with its close button", async () => {
    const user = userEvent.setup();
    render(<Frame dismissOnOutsideClick={false} />);
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(screen.getByTestId("frame-state").textContent).toBe("open");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByTestId("frame-state").textContent).toBe("closed");
  });

  it("fills a phone's screen at the extra-large size", () => {
    render(<Frame />);
    expect(screen.getByRole("dialog").className).toContain("max-sm:inset-0");
  });
});
