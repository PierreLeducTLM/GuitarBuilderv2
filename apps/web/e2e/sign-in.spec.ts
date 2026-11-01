import { expect, type Page, test } from "@playwright/test";
import { en, fillCredentials, formAlert, fr, watchAuthRequests } from "./support";

type Catalog = typeof en;

async function submit(page: Page, t: Catalog, signUp = false) {
  await page
    .getByRole("button", { name: signUp ? t.auth.signUp : t.auth.signIn, exact: true })
    .click();
}

async function checkValidation(page: Page, t: Catalog) {
  const authRequests = watchAuthRequests(page);
  const email = page.getByLabel(t.auth.email, { exact: true });
  const password = page.getByLabel(t.auth.password, { exact: true });

  // Required fields
  await email.fill("luthier@example.com");
  await submit(page, t);
  await expect(formAlert(page)).toHaveText(t.auth.errors.fillAllFields);

  // Malformed email: the field is flagged
  await email.fill("not-an-email");
  await password.fill("spruce123");
  await submit(page, t);
  await expect(page.getByText(t.auth.errors.invalidEmail)).toBeVisible();
  await expect(email).toHaveAttribute("aria-invalid", "true");

  // Password length
  await email.fill("luthier@example.com");
  await password.fill("abc12");
  await submit(page, t);
  await expect(page.getByText(t.auth.errors.passwordTooShort)).toBeVisible();
  await expect(email).not.toHaveAttribute("aria-invalid", "true");

  // Sign-up mode: hint and confirmation mismatch
  await expect(page.getByText(t.auth.passwordHint)).toHaveCount(0);
  await page.getByRole("button", { name: t.auth.switchToSignUp }).click();
  await expect(page.getByText(t.auth.errors.passwordTooShort)).toHaveCount(0);
  await expect(page.getByText(t.auth.passwordHint)).toBeVisible();
  await expect(page.getByTestId("auth-subtitle")).toHaveText(t.auth.subtitleSignUp);
  await password.fill("maple456");
  await page.getByLabel(t.auth.confirmPassword, { exact: true }).fill("maple457");
  await submit(page, t, true);
  await expect(page.getByText(t.auth.errors.passwordsDoNotMatch)).toBeVisible();

  expect(authRequests, "validation must not contact the authentication service").toEqual([]);
}

test.describe("sign-in screen", () => {
  test("opens in sign-in mode with every element of the spec", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveTitle(en.app.documentTitle);
    await expect(page.getByRole("heading", { name: en.app.title })).toBeVisible();
    await expect(page.getByTestId("auth-subtitle")).toHaveText(en.auth.subtitleSignIn);
    await expect(page.getByLabel(en.auth.email, { exact: true })).toBeVisible();
    await expect(page.getByLabel(en.auth.password, { exact: true })).toBeVisible();
    await expect(page.getByLabel(en.auth.confirmPassword)).toHaveCount(0);
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: en.auth.switchToSignUp })).toBeVisible();
    await expect(page.getByText(en.auth.note)).toBeVisible();
  });

  test("shows the validation messages in English", async ({ page }) => {
    await page.goto("/sign-in");
    await checkValidation(page, en);
  });

  test("shows the validation messages in French", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("radio", { name: en.language.frName }).check();
    await expect(page.getByTestId("auth-subtitle")).toHaveText(fr.auth.subtitleSignIn);
    await checkValidation(page, fr);
  });

  test("switching modes clears messages and toggles the confirmation field", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(formAlert(page)).toHaveText(en.auth.errors.fillAllFields);
    await page.getByRole("button", { name: en.auth.switchToSignUp }).click();
    await expect(formAlert(page)).toHaveCount(0);
    await expect(page.getByLabel(en.auth.confirmPassword, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: en.auth.signUp, exact: true })).toBeVisible();
    await page.getByRole("button", { name: en.auth.switchToSignIn }).click();
    await expect(page.getByLabel(en.auth.confirmPassword)).toHaveCount(0);
  });

  test("keeps typed values when validation fails", async ({ page }) => {
    await page.goto("/sign-in");
    await fillCredentials(page, "luthier@example.com", "abc12");
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(page.getByLabel(en.auth.email, { exact: true })).toHaveValue(
      "luthier@example.com",
    );
    await expect(page.getByLabel(en.auth.password, { exact: true })).toHaveValue("abc12");
  });
});
