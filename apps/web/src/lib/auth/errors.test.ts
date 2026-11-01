import { describe, expect, it } from "vitest";
import { describeAuthError } from "./errors";

describe("describeAuthError", () => {
  it("maps known service codes to translated messages", () => {
    expect(
      describeAuthError({
        name: "AuthApiError",
        code: "invalid_credentials",
        status: 400,
        message: "Invalid login credentials",
      }),
    ).toEqual({ kind: "known", code: "invalid_credentials" });
    expect(
      describeAuthError({
        code: "email_not_confirmed",
        status: 400,
        message: "Email not confirmed",
      }),
    ).toEqual({
      kind: "known",
      code: "email_not_confirmed",
    });
  });

  it("shows the service's own reason for codes it does not know", () => {
    expect(
      describeAuthError({ code: "something_new", status: 422, message: "Something new happened" }),
    ).toEqual({
      kind: "service",
      text: "Something new happened",
    });
  });

  it("reports network failures and reasonless errors as unexpected", () => {
    expect(
      describeAuthError({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" }),
    ).toEqual({
      kind: "unexpected",
    });
    expect(describeAuthError(new TypeError("Failed to fetch"))).toEqual({ kind: "unexpected" });
    expect(describeAuthError({ status: 500, message: "{}" })).toEqual({ kind: "unexpected" });
    expect(describeAuthError({ status: 500 })).toEqual({ kind: "unexpected" });
    expect(describeAuthError(null)).toEqual({ kind: "unexpected" });
  });
});
