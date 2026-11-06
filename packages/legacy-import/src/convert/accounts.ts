import { type AppRole, toAppRole } from "@gb/db";
import type { Row } from "../transport/sql.ts";

export type TableColumns = { writable: readonly string[]; generated: readonly string[] };

export type AccountsInput = {
  legacyUsers: readonly Row[];
  legacyIdentities: readonly Row[];
  legacyProfiles: readonly { id: string; role: unknown }[];
  targetColumns: { users: TableColumns; identities: TableColumns };
  targetAccounts: readonly { id: string; email: string | null }[];
};

export const EMAIL_CONFLICT = "email already used by another account";

export type AccountPlan =
  | {
      kind: "import";
      id: string;
      email: string | null;
      user: Row;
      identities: Row[];
      role: AppRole;
      givenProfile: boolean;
      droppedColumns: string[];
    }
  | { kind: "skip"; id: string; email: string | null; reason: typeof EMAIL_CONFLICT };

/** Columns GoTrue scans into non-null strings; a null there breaks sign-in. */
const TOKEN_COLUMNS = new Set([
  "confirmation_token",
  "recovery_token",
  "email_change_token_new",
  "email_change",
  "email_change_token_current",
  "phone_change",
  "phone_change_token",
  "reauthentication_token",
]);

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

const keepColumns = (row: Row, columns: TableColumns): Row =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => columns.writable.includes(key))
      .map(([key, value]) => [key, TOKEN_COLUMNS.has(key) && value === null ? "" : value]),
  );

const droppedKeys = (row: Row, columns: TableColumns, table: string): string[] =>
  Object.keys(row)
    .filter((key) => !columns.writable.includes(key) && !columns.generated.includes(key))
    .map((key) => `${table}.${key}`);

const lower = (email: string | null): string | null => email?.toLowerCase() ?? null;

export function planAccounts(input: AccountsInput): AccountPlan[] {
  const roles = new Map(input.legacyProfiles.map((profile) => [profile.id, profile.role]));
  return input.legacyUsers.map((legacy): AccountPlan => {
    const id = String(legacy.id);
    const email = textOrNull(legacy.email);
    const conflict = input.targetAccounts.some(
      (account) => account.id !== id && email !== null && lower(account.email) === lower(email),
    );
    if (conflict) {
      return { kind: "skip", id, email, reason: EMAIL_CONFLICT };
    }
    const identities = input.legacyIdentities.filter((identity) => identity.user_id === id);
    const { users, identities: identityColumns } = input.targetColumns;
    return {
      kind: "import",
      id,
      email,
      user: keepColumns(legacy, users),
      identities: identities.map((identity) => keepColumns(identity, identityColumns)),
      role: toAppRole(roles.get(id)),
      givenProfile: !roles.has(id),
      droppedColumns: [
        ...new Set([
          ...droppedKeys(legacy, users, "auth.users"),
          ...identities.flatMap((identity) =>
            droppedKeys(identity, identityColumns, "auth.identities"),
          ),
        ]),
      ].sort(),
    };
  });
}
