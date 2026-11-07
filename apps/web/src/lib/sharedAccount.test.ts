import { describe, expect, it } from "vitest";
import { parseSharedAccount } from "./sharedAccount";

describe("parseSharedAccount", () => {
  it("is the configured email and password", () => {
    expect(
      parseSharedAccount({
        SHARED_ACCOUNT_EMAIL: " bench@example.com ",
        SHARED_ACCOUNT_PASSWORD: "spruce123",
      }),
    ).toEqual({ email: "bench@example.com", password: "spruce123" });
  });

  it("keeps spaces that belong to the password", () => {
    expect(
      parseSharedAccount({
        SHARED_ACCOUNT_EMAIL: "bench@example.com",
        SHARED_ACCOUNT_PASSWORD: " spruce 123 ",
      })?.password,
    ).toBe(" spruce 123 ");
  });

  it("is absent unless both the email and the password are set", () => {
    expect(parseSharedAccount({})).toBeNull();
    expect(parseSharedAccount({ SHARED_ACCOUNT_EMAIL: "bench@example.com" })).toBeNull();
    expect(parseSharedAccount({ SHARED_ACCOUNT_PASSWORD: "spruce123" })).toBeNull();
    expect(
      parseSharedAccount({ SHARED_ACCOUNT_EMAIL: "  ", SHARED_ACCOUNT_PASSWORD: "spruce123" }),
    ).toBeNull();
    expect(
      parseSharedAccount({
        SHARED_ACCOUNT_EMAIL: "bench@example.com",
        SHARED_ACCOUNT_PASSWORD: "",
      }),
    ).toBeNull();
  });
});
