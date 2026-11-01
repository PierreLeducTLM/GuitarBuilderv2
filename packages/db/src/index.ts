export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types.ts";

/** The two roles of user-auth. A missing or unreadable profile counts as `user`. */
export const appRoles = ["user", "admin"] as const;
export type AppRole = (typeof appRoles)[number];

export function toAppRole(value: unknown): AppRole {
  return value === "admin" ? "admin" : "user";
}
