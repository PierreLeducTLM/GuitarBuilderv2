import { describe, expect, it } from "vitest";
import { isValidEmail, validateAuthForm } from "./validation";

const valid = { email: "luthier@example.com", password: "spruce123", confirmPassword: "" };

describe("validateAuthForm", () => {
  it("accepts valid sign-in credentials", () => {
    expect(validateAuthForm("signIn", valid)).toBeNull();
  });

  it("refuses an empty password or email with 'Please fill in all fields'", () => {
    expect(validateAuthForm("signIn", { ...valid, password: "" })).toEqual({
      key: "fillAllFields",
      field: null,
    });
    expect(validateAuthForm("signIn", { ...valid, email: "   " })).toEqual({
      key: "fillAllFields",
      field: null,
    });
    expect(validateAuthForm("signUp", { email: "", password: "", confirmPassword: "" })).toEqual({
      key: "fillAllFields",
      field: null,
    });
  });

  it("flags a malformed email on the email field", () => {
    expect(validateAuthForm("signIn", { ...valid, email: "not-an-email" })).toEqual({
      key: "invalidEmail",
      field: "email",
    });
  });

  it("refuses passwords shorter than 6 characters", () => {
    expect(validateAuthForm("signIn", { ...valid, password: "abc12" })).toEqual({
      key: "passwordTooShort",
      field: "password",
    });
  });

  it("lets a 6-character password through the length rule", () => {
    expect(validateAuthForm("signIn", { ...valid, password: "abc123" })).toBeNull();
  });

  it("refuses a different confirmation in sign-up mode only", () => {
    const values = { email: "new@example.com", password: "maple456", confirmPassword: "maple457" };
    expect(validateAuthForm("signUp", values)).toEqual({
      key: "passwordsDoNotMatch",
      field: "confirmPassword",
    });
    expect(validateAuthForm("signIn", values)).toBeNull();
    expect(validateAuthForm("signUp", { ...values, confirmPassword: "maple456" })).toBeNull();
  });
});

describe("isValidEmail", () => {
  it.each(["luthier@example.com", "a.b+c@sub.example.fr", " padded@example.com "])(
    "accepts %s",
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each([
    "not-an-email",
    "a@b",
    "a b@example.com",
    "@example.com",
    "a@example.",
    "a@@example.com",
  ])("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
