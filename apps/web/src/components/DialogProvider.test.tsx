// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { DialogProvider, useConfirm, usePrompt } from "./DialogProvider";

const results: Array<boolean | string | null> = [];

function Triggers() {
  const confirm = useConfirm();
  const prompt = usePrompt();
  return (
    <>
      <button
        type="button"
        onClick={async () => results.push(await confirm({ title: "Question", message: "Sûr ?" }))}
      >
        ask
      </button>
      <button
        type="button"
        onClick={async () =>
          results.push(
            await confirm({
              title: "Supprimer",
              message: "Définitif.",
              confirmLabel: "Supprimer",
              variant: "danger",
            }),
          )
        }
      >
        delete
      </button>
      <button
        type="button"
        onClick={async () => results.push(await prompt({ title: "Nom", initialValue: "Analyse" }))}
      >
        rename
      </button>
    </>
  );
}

function renderIn(locale: "en" | "fr") {
  results.length = 0;
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en} timeZone="UTC">
      <DialogProvider>
        <Triggers />
      </DialogProvider>
    </NextIntlClientProvider>,
  );
}

describe("DialogProvider", () => {
  it("labels the confirmation dialog Confirmer / Annuler in French and resolves false on cancel", async () => {
    const user = userEvent.setup();
    renderIn("fr");
    await user.click(screen.getByText("ask"));
    expect(screen.getByRole("button", { name: "Confirmer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(results).toEqual([false]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses a feature's own confirm label and resolves true on confirm", async () => {
    const user = userEvent.setup();
    renderIn("fr");
    await user.click(screen.getByText("delete"));
    const confirm = screen.getByRole("button", { name: "Supprimer" });
    expect(confirm.getAttribute("data-severity")).toBe("danger");
    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();
    await user.click(confirm);
    expect(results).toEqual([true]);
  });

  it("labels the text-input dialog Enregistrer / Annuler in French and returns the trimmed text", async () => {
    const user = userEvent.setup();
    renderIn("fr");
    await user.click(screen.getByText("rename"));
    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();
    const input = screen.getByRole("textbox", { name: "Nom" });
    await user.clear(input);
    await user.type(input, "  Essai de tap  ");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(results).toEqual(["Essai de tap"]);
  });

  it("uses Confirm / Cancel and Save in English", async () => {
    const user = userEvent.setup();
    renderIn("en");
    await user.click(screen.getByText("ask"));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByText("rename"));
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
