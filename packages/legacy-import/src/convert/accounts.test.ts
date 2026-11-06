import { describe, expect, it } from "vitest";
import { type AccountsInput, planAccounts } from "./accounts.ts";

const ADMIN_ID = "a0000000-0000-4000-8000-00000000000a";
const USER_ID = "b0000000-0000-4000-8000-00000000000b";

const legacyUser = (overrides: Record<string, unknown> = {}) => ({
  id: USER_ID,
  email: "luthier@example.com",
  encrypted_password: "$2a$10$hash",
  email_confirmed_at: "2025-01-02T00:00:00Z",
  confirmed_at: "2025-01-02T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
  confirmation_token: null,
  recovery_token: "",
  raw_user_meta_data: { full_name: "A" },
  ...overrides,
});

const legacyIdentity = (overrides: Record<string, unknown> = {}) => ({
  id: "c0000000-0000-4000-8000-00000000000c",
  provider_id: USER_ID,
  user_id: USER_ID,
  provider: "email",
  identity_data: { sub: USER_ID, email: "luthier@example.com" },
  email: "luthier@example.com",
  ...overrides,
});

const input = (overrides: Partial<AccountsInput> = {}): AccountsInput => ({
  legacyUsers: [legacyUser()],
  legacyIdentities: [legacyIdentity()],
  legacyProfiles: [{ id: USER_ID, role: "user" }],
  targetColumns: {
    users: {
      writable: [
        "id",
        "email",
        "encrypted_password",
        "email_confirmed_at",
        "created_at",
        "confirmation_token",
        "recovery_token",
        "email_change_token_new",
        "raw_user_meta_data",
      ],
      generated: ["confirmed_at"],
    },
    identities: {
      writable: ["id", "provider_id", "user_id", "provider", "identity_data"],
      generated: ["email"],
    },
  },
  targetAccounts: [],
  ...overrides,
});

describe("planAccounts", () => {
  it("keeps the identifier, email, password hash, confirmation and creation date", () => {
    const [plan] = planAccounts(input());

    expect(plan).toEqual({
      kind: "import",
      id: USER_ID,
      email: "luthier@example.com",
      user: {
        id: USER_ID,
        email: "luthier@example.com",
        encrypted_password: "$2a$10$hash",
        email_confirmed_at: "2025-01-02T00:00:00Z",
        created_at: "2025-01-01T00:00:00Z",
        confirmation_token: "",
        recovery_token: "",
        raw_user_meta_data: { full_name: "A" },
      },
      identities: [
        {
          id: "c0000000-0000-4000-8000-00000000000c",
          provider_id: USER_ID,
          user_id: USER_ID,
          provider: "email",
          identity_data: { sub: USER_ID, email: "luthier@example.com" },
        },
      ],
      role: "user",
      givenProfile: false,
      droppedColumns: [],
    });
  });

  it("fills every GoTrue token column the target has with an empty string when null", () => {
    const tokenColumns = [
      "confirmation_token",
      "recovery_token",
      "email_change_token_new",
      "email_change",
      "email_change_token_current",
      "phone_change",
      "phone_change_token",
      "reauthentication_token",
    ];
    const withTokens = input({
      legacyUsers: [legacyUser(Object.fromEntries(tokenColumns.map((column) => [column, null])))],
      targetColumns: {
        users: { writable: ["id", "email", ...tokenColumns, "phone"], generated: [] },
        identities: { writable: ["id"], generated: [] },
      },
    });

    const [plan] = planAccounts({
      ...withTokens,
      legacyUsers: [{ ...withTokens.legacyUsers[0], phone: null }],
    });

    expect(plan?.kind === "import" && plan.user).toEqual({
      id: USER_ID,
      email: "luthier@example.com",
      phone: null,
      ...Object.fromEntries(tokenColumns.map((column) => [column, ""])),
    });
  });

  it("keeps an admin as admin", () => {
    const [plan] = planAccounts(input({ legacyProfiles: [{ id: USER_ID, role: "admin" }] }));

    expect(plan).toMatchObject({ kind: "import", role: "admin", givenProfile: false });
  });

  it("imports an account without a profile as a user and flags it", () => {
    const [plan] = planAccounts(input({ legacyProfiles: [] }));

    expect(plan).toMatchObject({ kind: "import", role: "user", givenProfile: true });
  });

  it("reads an unknown legacy role as user", () => {
    const [plan] = planAccounts(input({ legacyProfiles: [{ id: USER_ID, role: "owner" }] }));

    expect(plan).toMatchObject({ kind: "import", role: "user", givenProfile: false });
  });

  it("drops and lists keys the target does not have, but not its generated columns", () => {
    const [plan] = planAccounts(
      input({
        legacyUsers: [legacyUser({ instance_note: "x" })],
        legacyIdentities: [legacyIdentity({ legacy_flag: true })],
      }),
    );

    expect(plan).toMatchObject({
      kind: "import",
      droppedColumns: ["auth.identities.legacy_flag", "auth.users.instance_note"],
    });
    expect(plan?.kind === "import" && plan.user).not.toHaveProperty("confirmed_at");
    expect(plan?.kind === "import" && plan.identities[0]).not.toHaveProperty("email");
  });

  it("attaches only the account's own identities", () => {
    const [admin, user] = planAccounts(
      input({
        legacyUsers: [legacyUser({ id: ADMIN_ID, email: "admin@example.com" }), legacyUser()],
        legacyIdentities: [
          legacyIdentity(),
          legacyIdentity({ id: "d0000000-0000-4000-8000-00000000000d", user_id: ADMIN_ID }),
        ],
      }),
    );

    expect(admin?.kind === "import" && admin.identities.map((row) => row.id)).toEqual([
      "d0000000-0000-4000-8000-00000000000d",
    ]);
    expect(user?.kind === "import" && user.identities.map((row) => row.id)).toEqual([
      "c0000000-0000-4000-8000-00000000000c",
    ]);
  });

  it("skips an account whose email belongs to a different v2 account, ignoring case", () => {
    const [plan] = planAccounts(
      input({
        targetAccounts: [
          { id: "e0000000-0000-4000-8000-00000000000e", email: "Luthier@Example.com" },
        ],
      }),
    );

    expect(plan).toEqual({
      kind: "skip",
      id: USER_ID,
      email: "luthier@example.com",
      reason: "email already used by another account",
    });
  });

  it("imports an account next to v2 accounts with other emails, or none", () => {
    const [plan] = planAccounts(
      input({
        targetAccounts: [
          { id: "e0000000-0000-4000-8000-00000000000e", email: "someone@example.com" },
          { id: "f0000000-0000-4000-8000-00000000000f", email: null },
        ],
      }),
    );

    expect(plan).toMatchObject({ kind: "import", id: USER_ID });
  });

  it("keeps token values that are set", () => {
    const [plan] = planAccounts(input({ legacyUsers: [legacyUser({ recovery_token: "r1" })] }));

    expect(plan?.kind === "import" && plan.user.recovery_token).toBe("r1");
  });

  it("reads a missing email as none", () => {
    const { email: _email, ...withoutEmail } = legacyUser();

    const [plan] = planAccounts(input({ legacyUsers: [withoutEmail] }));

    expect(plan).toMatchObject({ kind: "import", email: null });
  });

  it("updates an account imported earlier with the same identifier", () => {
    const [plan] = planAccounts(
      input({ targetAccounts: [{ id: USER_ID, email: "luthier@example.com" }] }),
    );

    expect(plan).toMatchObject({ kind: "import", id: USER_ID });
  });

  it("imports an account without an email", () => {
    const [plan] = planAccounts(
      input({
        legacyUsers: [legacyUser({ email: null })],
        targetAccounts: [{ id: "e0000000-0000-4000-8000-00000000000e", email: null }],
      }),
    );

    expect(plan).toMatchObject({ kind: "import", email: null });
  });
});
