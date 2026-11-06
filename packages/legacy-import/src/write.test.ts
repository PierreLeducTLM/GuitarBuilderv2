import { describe, expect, it } from "vitest";
import type { BuildRow } from "./convert/builds.ts";
import type { DefaultPanelRow, PanelRow } from "./convert/panels.ts";
import {
  accountScript,
  buildScript,
  defaultPanelsScript,
  panelsScript,
  verificationQuery,
} from "./write.ts";

const ID = "b0000000-0000-4000-8000-00000000000b";

/** The script with every dollar-quote tag replaced by $q$, so it can be compared. */
const normalized = (sql: string): string => sql.replaceAll(/\$gb_[0-9a-f]+\$/g, "$q$");

const inputs = {
  sample_length_mm: 602,
  sample_width_mm: 283,
  sample_thickness_mm: 3.8,
  sample_mass_g: 270,
  freq_longitudinal_hz: 140,
  freq_cross_grain_hz: 57,
  freq_diagonal_hz: 90,
  plate_length_mm: 520,
  plate_width_mm: 200,
  stiffness_parameter: 75,
};
const INPUT_COLUMNS = Object.keys(inputs)
  .map((column) => `"${column}"`)
  .join(", ");
const INPUT_UPDATES = Object.keys(inputs)
  .map((column) => `"${column}" = excluded."${column}"`)
  .join(", ");

describe("accountScript", () => {
  it("upserts the user, its identities and its role in one transaction", () => {
    const user = { id: ID, email: "o'neil@example.com", encrypted_password: "$2a$10$x" };
    const identities = [{ id: "i1", user_id: ID, provider: "email" }];

    expect(normalized(accountScript({ id: ID, user, identities, role: "admin" }))).toBe(
      [
        "begin;",
        `insert into auth.users ("id", "email", "encrypted_password") select "id", "email", "encrypted_password" from jsonb_populate_record(null::auth.users, $q$${JSON.stringify(user)}$q$::jsonb) on conflict (id) do update set "email" = excluded."email", "encrypted_password" = excluded."encrypted_password";`,
        `insert into auth.identities ("id", "user_id", "provider") select "id", "user_id", "provider" from jsonb_populate_recordset(null::auth.identities, $q$${JSON.stringify(identities)}$q$::jsonb) on conflict (id) do update set "user_id" = excluded."user_id", "provider" = excluded."provider";`,
        `insert into public.profiles (id, email, role) select u.id, u.email, 'admin' from auth.users u where u.id = $q$${ID}$q$::uuid on conflict (id) do update set email = excluded.email, role = excluded.role;`,
        "commit;",
      ].join("\n"),
    );
  });

  it("writes no identity statement for an account without identities", () => {
    const script = accountScript({ id: ID, user: { id: ID }, identities: [], role: "user" });

    expect(script).not.toContain("auth.identities");
    expect(script).toContain("'user' from auth.users");
  });

  it("quotes a column name containing a double quote", () => {
    const script = accountScript({
      id: ID,
      user: { id: ID, 'odd"name': 1 },
      identities: [],
      role: "user",
    });

    expect(script).toContain('("id", "odd""name")');
  });
});

describe("buildScript", () => {
  it("upserts the build with the step state, keeping its first-version update time", () => {
    const row: BuildRow = {
      id: ID,
      owner_id: ID,
      name: "OM",
      guitar_type: null,
      bobo_neck: true,
      share_enabled: false,
      share_token: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-02-01T00:00:00Z",
    };
    const state = [{ key: "TrussRod", completed: true, notes: "", photos: [], measurements: [] }];
    const columns = [
      "id",
      "owner_id",
      "name",
      "guitar_type",
      "bobo_neck",
      "share_enabled",
      "share_token",
      "created_at",
      "updated_at",
      "sequence_state",
    ];

    expect(normalized(buildScript(row, state))).toBe(
      [
        "begin;",
        "set local gb.keep_updated_at = 'on';",
        `insert into public.builds (${columns.map((c) => `"${c}"`).join(", ")}) select ${columns.map((c) => `"${c}"`).join(", ")} from jsonb_populate_record(null::public.builds, $q$${JSON.stringify({ ...row, sequence_state: state })}$q$::jsonb) on conflict (id) do update set ${columns
          .slice(1)
          .map((c) => `"${c}" = excluded."${c}"`)
          .join(", ")};`,
        "commit;",
      ].join("\n"),
    );
  });
});

describe("panelsScript", () => {
  it("upserts a batch of panels, keeping their first-version update times", () => {
    const rows: PanelRow[] = [
      {
        id: "p1",
        owner_id: ID,
        name: "Sitka",
        ...inputs,
        spectra: {},
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-02-01T00:00:00Z",
      },
    ];

    expect(normalized(panelsScript(rows))).toBe(
      [
        "begin;",
        "set local gb.keep_updated_at = 'on';",
        `insert into public.wood_panels ("id", "owner_id", "name", ${INPUT_COLUMNS}, "spectra", "created_at", "updated_at") select "id", "owner_id", "name", ${INPUT_COLUMNS}, "spectra", "created_at", "updated_at" from jsonb_populate_recordset(null::public.wood_panels, $q$${JSON.stringify(rows)}$q$::jsonb) on conflict (id) do update set "owner_id" = excluded."owner_id", "name" = excluded."name", ${INPUT_UPDATES}, "spectra" = excluded."spectra", "created_at" = excluded."created_at", "updated_at" = excluded."updated_at";`,
        "commit;",
      ].join("\n"),
    );
  });
});

describe("defaultPanelsScript", () => {
  it("upserts the default panels in one transaction", () => {
    const rows: DefaultPanelRow[] = [
      { id: "d1", name: "Sitka", ...inputs, created_at: "2025-01-01T00:00:00Z" },
    ];

    expect(normalized(defaultPanelsScript(rows))).toBe(
      [
        "begin;",
        `insert into public.default_wood_panels ("id", "name", ${INPUT_COLUMNS}, "created_at") select "id", "name", ${INPUT_COLUMNS}, "created_at" from jsonb_populate_recordset(null::public.default_wood_panels, $q$${JSON.stringify(rows)}$q$::jsonb) on conflict (id) do update set "name" = excluded."name", ${INPUT_UPDATES}, "created_at" = excluded."created_at";`,
        "commit;",
      ].join("\n"),
    );
  });
});

describe("verificationQuery", () => {
  it("counts what v2 holds of the imported records", () => {
    const ids = {
      accounts: [ID],
      builds: ["e1"],
      panels: ["p1"],
      defaultPanels: ["d1"],
      photoPaths: ["e1/TrussRod/1_a.jpg"],
    };
    const list = (key: string) => `(select jsonb_array_elements_text(ids.j -> '${key}'))`;

    expect(normalized(verificationQuery(ids))).toBe(
      `with ids as (select $q$${JSON.stringify(ids)}$q$::jsonb as j) select (select count(*)::int from auth.users t, ids where t.id::text in ${list("accounts")}) as accounts, (select count(*)::int from public.profiles t, ids where t.role = 'admin' and t.id::text in ${list("accounts")}) as admins, (select count(*)::int from public.profiles t, ids where t.role = 'user' and t.id::text in ${list("accounts")}) as users, (select count(*)::int from public.builds t, ids where t.id::text in ${list("builds")}) as builds, (select count(*)::int from public.wood_panels t, ids where t.id::text in ${list("panels")}) as panels, (select count(*)::int from public.default_wood_panels t, ids where t.id::text in ${list("defaultPanels")}) as default_panels, (select count(*)::int from storage.objects t, ids where t.bucket_id = 'step-photos' and t.name in ${list("photoPaths")}) as photos from ids`,
    );
  });
});
