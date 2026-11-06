// The legacy import rehearsal (legacy-account-and-build-import, task 6.1), run by rehearse.sh:
// seeds a first-version stack through its Auth, Storage and SQL, runs the import in local mode
// (dry run, apply, apply again) against a fresh v2 stack, and checks sign-in, roles, builds,
// steps, photos, wood panels, the skipped email conflict, repeat runs and the untouched source.
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dollarQuote,
  psqlExecutor,
  type Row,
} from "../../packages/legacy-import/src/transport/sql.ts";

type Status = {
  API_URL: string;
  DB_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  SECRET_KEY: string;
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WORK = process.env.REHEARSAL_WORK ?? "";
const v1: Status = JSON.parse(process.env.V1_STATUS ?? "{}");
const v2: Status = JSON.parse(process.env.V2_STATUS ?? "{}");
const v1Sql = psqlExecutor({ databaseUrl: v1.DB_URL });
const v2Sql = psqlExecutor({ databaseUrl: v2.DB_URL });

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = ""): void => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` (${JSON.stringify(detail)})`}`);
  if (!ok) failures.push(label);
};

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const PASSWORDS = {
  admin: "Admin-pass-1!",
  luthier: "Luthier-pass-2!",
  conflict: "Conflict-pass-3!",
  conflictInV2: "Someone-else-4!",
};
const B1 = "e1000000-0000-4000-8000-000000000001";
const B2 = "e2000000-0000-4000-8000-000000000002";
const B3 = "e3000000-0000-4000-8000-000000000003";
const B4 = "e4000000-0000-4000-8000-000000000004";
const T1 = "71000000-0000-4000-8000-000000000001";
const T2 = "72000000-0000-4000-8000-000000000002";
const P1 = "f1000000-0000-4000-8000-000000000001";
const P2 = "f2000000-0000-4000-8000-000000000002";
const P3 = "f3000000-0000-4000-8000-000000000003";
const P4 = "f4000000-0000-4000-8000-000000000004";
const D1 = "d1000000-0000-4000-8000-000000000001";
const D2 = "d2000000-0000-4000-8000-000000000002";

/** A spectrum of `count` half-hertz bins from 20 Hz, its peak at bin 100 (70 Hz). */
const spectrum = (count: number) => ({
  frequencies: Array.from({ length: count }, (_, i) => 20 + i * 0.5),
  magnitudes: Array.from({ length: count }, (_, i) => (i === 100 ? 0.5 : 0.001)),
  magnitudesDb: Array.from({ length: count }, (_, i) => (i === 100 ? -6 : -60)),
  sampleRate: 16384,
  fftSize: 32768,
  binWidth: 0.5,
});

// A 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const headers = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  ...extra,
});

const createUser = async (api: Status, email: string, password: string): Promise<string> => {
  const response = await fetch(`${api.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: headers(api.SERVICE_ROLE_KEY, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`creating ${email}: ${JSON.stringify(body)}`);
  return body.id;
};

const signIn = async (api: Status, email: string, password: string): Promise<boolean> => {
  const response = await fetch(`${api.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: api.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  return response.ok && typeof body.access_token === "string";
};

const uploadV1Photo = async (path: string, contentType: string): Promise<void> => {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${v1.API_URL}/storage/v1/object/step-photos/${encoded}`, {
    method: "POST",
    headers: headers(v1.SERVICE_ROLE_KEY, { "Content-Type": contentType }),
    body: PNG,
  });
  if (!response.ok) throw new Error(`uploading ${path}: ${await response.text()}`);
};

const json = (value: unknown): string => `${dollarQuote(JSON.stringify(value))}::jsonb`;

const legacyPanel = (
  id: string,
  userId: string | null,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  user_id: userId,
  build_id: null,
  name: "Sitka #3",
  sample_length: 602,
  sample_width: 283,
  sample_thickness: 3.8,
  sample_mass: 270,
  freq_longitudinal: 140,
  freq_cross_grain: 57,
  freq_diagonal: 90,
  target_plate_length: 520,
  target_plate_width: 200,
  vibrational_stiffness_param: 75,
  young_modulus_longitudinal: 12.1,
  young_modulus_cross: 0.28,
  shear_modulus: 0.7,
  target_thickness: 2.9,
  estimated_panel_mass: 150,
  fft_data: null,
  created_at: "2025-02-01T00:00:00Z",
  updated_at: "2025-02-02T00:00:00Z",
  ...overrides,
});

const seedFirstVersion = async () => {
  const admin = await createUser(v1, "admin@rehearsal.test", PASSWORDS.admin);
  const luthier = await createUser(v1, "luthier@rehearsal.test", PASSWORDS.luthier);
  const conflict = await createUser(v1, "conflict@rehearsal.test", PASSWORDS.conflict);

  await v1Sql.execute(`
    alter table public.guitar_builds add column if not exists sequence_diagram jsonb;
    insert into public.user_profiles (id, email, role) values ('${admin}', 'admin@rehearsal.test', 'admin')
      on conflict (id) do update set role = 'admin';
    delete from public.user_profiles where id = '${luthier}';
    insert into storage.buckets (id, name, public) values ('step-photos', 'step-photos', true)
      on conflict (id) do update set public = true;
  `);

  const photo = (build: string, step: string, name: string) => `${build}/${step}/${name}`;
  await uploadV1Photo(photo(B1, "TrussRod", "1733500000000_k3j9x.jpg"), "image/jpeg");
  await uploadV1Photo(photo(B1, "TrussRod", "1733500000001_ab.my photo"), "image/png");
  await uploadV1Photo(photo(B1, "TapTestPanels", "IMG_0001.HEIC"), "image/heic");
  await uploadV1Photo(photo(B3, "TrussRod", "1733500000009_cf.jpg"), "image/jpeg");
  await uploadV1Photo(
    photo("e9000000-0000-4000-8000-000000000009", "Old", "1700000000000_zz.jpg"),
    "image/jpeg",
  );

  const photoRef = (path: string) => ({
    url: `${v1.API_URL}/storage/v1/object/public/step-photos/${path}`,
    fileName: path,
  });
  const analysis = (id: string, fftData: unknown, description = "Top tap") => ({
    id,
    timestamp: 1733500000000,
    description,
    peakFrequency: 70,
    fftData,
  });
  const builds = [
    {
      id: B1,
      user_id: luthier,
      text_identifier: "OM #1",
      model_name: "OM",
      width: 380,
      length: 495,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-03-01T12:00:00Z",
      share_token: T1,
      share_enabled: true,
      sequence_diagram: {
        nodes: [
          {
            id: "TrussRod",
            completed: true,
            notes: "Two-way rod, 440 mm\n",
            photos: [
              photoRef(photo(B1, "TrussRod", "1733500000000_k3j9x.jpg")),
              photoRef(photo(B1, "TrussRod", "1733500000001_ab.my photo")),
              photoRef(photo(B1, "TrussRod", "1733500000002_gone.jpg")),
            ],
            fftAnalyses: [],
          },
          { id: "FabricateCLBridge", completed: true, notes: "", photos: [], fftAnalyses: [] },
          {
            id: "TapTestPanels",
            completed: false,
            notes: "",
            photos: [photoRef(photo(B1, "TapTestPanels", "IMG_0001.HEIC"))],
            fftAnalyses: [
              analysis("m1", spectrum(300)),
              analysis("m2", spectrum(1366), "  "),
              analysis("m3", { ...spectrum(5), magnitudes: [1] }),
            ],
          },
          { id: "OldCustomStep", completed: false, notes: "kept", photos: [], fftAnalyses: [] },
          { id: "Fretboard", completed: false, notes: "  ", photos: [], fftAnalyses: [] },
        ],
      },
    },
    {
      id: B2,
      user_id: admin,
      text_identifier: "   ",
      model_name: "",
      width: null,
      length: null,
      created_at: "2025-01-05T00:00:00Z",
      updated_at: "2025-01-06T00:00:00Z",
      share_token: T2,
      share_enabled: false,
      sequence_diagram: {
        nodes: [
          { id: "SSCutBridge", completed: true },
          { id: "FabricateCLBridge", completed: true },
        ],
      },
    },
    {
      id: B3,
      user_id: conflict,
      text_identifier: "Conflict build",
      model_name: "",
      created_at: "2025-01-07T00:00:00Z",
      updated_at: "2025-01-07T00:00:00Z",
      share_enabled: false,
      sequence_diagram: {
        nodes: [
          {
            id: "TrussRod",
            completed: true,
            photos: [photoRef(photo(B3, "TrussRod", "1733500000009_cf.jpg"))],
          },
        ],
      },
    },
    {
      id: B4,
      user_id: admin,
      text_identifier: "No diagram",
      model_name: "",
      created_at: "2025-01-08T00:00:00Z",
      updated_at: "2025-01-08T00:00:00Z",
      share_enabled: false,
      sequence_diagram: null,
    },
  ];
  await v1Sql.execute(
    `insert into public.guitar_builds select * from jsonb_populate_recordset(null::public.guitar_builds, ${json(builds)});`,
  );

  const panels = [
    legacyPanel(P1, luthier, {
      build_id: B1,
      fft_data: {
        freqLongitudinal: spectrum(200),
        freqCrossGrain: spectrum(2048),
        freqDiagonal: { ...spectrum(5), magnitudes: [1] },
        freqTwist: spectrum(10),
      },
    }),
    legacyPanel(P2, null, { name: "Ownerless" }),
    legacyPanel(P3, conflict, { name: "Conflict panel" }),
    legacyPanel(P4, luthier, { name: "Zero mass", sample_mass: 0 }),
  ];
  await v1Sql.execute(
    `insert into public.wood_panels select * from jsonb_populate_recordset(null::public.wood_panels, ${json(panels)});`,
  );
  const defaults = [D1, D2].map((id, index) => {
    const {
      user_id: _u,
      build_id: _b,
      fft_data: _f,
      ...rest
    } = legacyPanel(id, null, {
      name: `Reference ${index + 1}`,
    });
    return rest;
  });
  await v1Sql.execute(
    `insert into public.default_wood_panels select * from jsonb_populate_recordset(null::public.default_wood_panels, ${json(defaults)});`,
  );

  return { admin, luthier, conflict };
};

// ---------------------------------------------------------------------------------------------
// Running the import
// ---------------------------------------------------------------------------------------------

const runCli = (args: readonly string[]): Promise<{ code: number; output: string }> =>
  new Promise((resolve) => {
    const child = spawn("node", [join(ROOT, "packages/legacy-import/src/cli.ts"), ...args], {
      cwd: WORK,
      env: {
        PATH: process.env.PATH,
        LEGACY_DATABASE_URL: v1.DB_URL,
        LEGACY_SUPABASE_URL: v1.API_URL,
        TARGET_DATABASE_URL: v2.DB_URL,
        TARGET_SUPABASE_URL: v2.API_URL,
        TARGET_SERVICE_KEY: v2.SECRET_KEY,
      },
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("close", (code) =>
      resolve({ code: code ?? -1, output: Buffer.concat(chunks).toString() }),
    );
  });

const latestReport = async (mode: "dry-run" | "apply"): Promise<string> => {
  const dir = join(WORK, "reports/legacy-import");
  const names = (await readdir(dir)).filter((name) => name.endsWith(`-${mode}.md`)).sort();
  return readFile(join(dir, names.at(-1) ?? ""), "utf8");
};

const v2Counts = async (): Promise<Row> =>
  (
    await v2Sql.query(`select
      (select count(*)::int from auth.users) as users,
      (select count(*)::int from auth.identities) as identities,
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.builds) as builds,
      (select count(*)::int from public.wood_panels) as panels,
      (select count(*)::int from public.default_wood_panels) as default_panels,
      (select count(*)::int from storage.objects where bucket_id = 'step-photos') as photos`)
  )[0] ?? {};

const v1Checksum = async (): Promise<unknown> =>
  (
    await v1Sql.query(`select md5(string_agg(t, '|' order by t)) as sum from (
      select to_jsonb(x)::text as t from auth.users x union all
      select to_jsonb(x)::text from auth.identities x union all
      select to_jsonb(x)::text from public.user_profiles x union all
      select to_jsonb(x)::text from public.guitar_builds x union all
      select to_jsonb(x)::text from public.wood_panels x union all
      select to_jsonb(x)::text from public.default_wood_panels x union all
      select to_jsonb(x)::text from storage.objects x) s`)
  )[0]?.sum;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------------------------
// Rehearsal
// ---------------------------------------------------------------------------------------------

const ids = await seedFirstVersion();
const v2Conflict = await createUser(v2, "conflict@rehearsal.test", PASSWORDS.conflictInV2);
const sourceBefore = await v1Checksum();
const targetBefore = await v2Counts();

console.log("\n== dry run");
const dry = await runCli([]);
console.log(dry.output);
check("the dry run succeeds", dry.code === 0, dry.code);
check("the dry run writes nothing to v2", same(await v2Counts(), targetBefore), await v2Counts());
const dryReport = await latestReport("dry-run");
check("the dry run reports the missing photo", dryReport.includes("1733500000002_gone.jpg"));
check(
  "the dry run reports the email conflict with its build and panel",
  dryReport.includes("conflict@rehearsal.test") && dryReport.includes(B3) && dryReport.includes(P3),
);
check("the dry run lists the corrected panel", dryReport.includes("0.280 → 0.567"));

console.log("\n== apply");
const applied = await runCli(["--apply"]);
console.log(applied.output);
check("the import succeeds", applied.code === 0, applied.code);
const afterApply = await v2Counts();

console.log("\n== checks");
check(
  "the admin signs in to v2 with the first-version password",
  await signIn(v2, "admin@rehearsal.test", PASSWORDS.admin),
);
check(
  "the luthier signs in to v2 with the first-version password",
  await signIn(v2, "luthier@rehearsal.test", PASSWORDS.luthier),
);
check(
  "a wrong password is refused",
  !(await signIn(v2, "luthier@rehearsal.test", "wrong-password")),
);
check(
  "the v2 conflict account keeps its own password",
  await signIn(v2, "conflict@rehearsal.test", PASSWORDS.conflictInV2),
);
check(
  "the first-version conflict password does not sign in",
  !(await signIn(v2, "conflict@rehearsal.test", PASSWORDS.conflict)),
);

const roles = await v2Sql.query("select id, role from public.profiles");
const roleOf = (id: string) => roles.find((row) => row.id === id)?.role;
check("the admin is admin", roleOf(ids.admin) === "admin", roles);
check("the account without a profile is a user", roleOf(ids.luthier) === "user", roles);
check(
  "the v2 conflict account is unchanged",
  roleOf(v2Conflict) !== undefined && roleOf(ids.conflict) === undefined,
  roles,
);

const builds = await v2Sql.query(
  "select id, owner_id, name, guitar_type, bobo_neck, share_enabled, share_token, created_at, updated_at, sequence_state from public.builds order by created_at",
);
const build = (id: string) => builds.find((row) => row.id === id);
const b1 = build(B1);
check(
  "build 1 keeps its identifier, owner and name",
  b1?.owner_id === ids.luthier && b1?.name === "OM #1",
  b1,
);
check(
  "build 1 is classical with a BOBO neck",
  b1?.guitar_type === "classical" && b1?.bobo_neck === true,
  b1,
);
check("build 1 keeps its share token", b1?.share_enabled === true && b1?.share_token === T1, b1);
check(
  "build 1 keeps its first-version times",
  String(b1?.updated_at).startsWith("2025-03-01T12:00:00"),
  b1?.updated_at,
);
type Entry = {
  key: string;
  completed: boolean;
  notes: string;
  photos: { url: string; name: string }[];
  measurements: { id: string; description: string; spectrum: { frequencies: number[] } }[];
};
const state = (b1?.sequence_state ?? []) as Entry[];
check(
  "build 1 has an entry per step with data, unknown keys kept",
  same(
    state.map((entry) => entry.key),
    ["TrussRod", "FabricateCLBridge", "TapTestPanels", "OldCustomStep"],
  ),
  state.map((entry) => entry.key),
);
const truss = state.find((entry) => entry.key === "TrussRod");
check("notes are copied exactly", truss?.notes === "Two-way rod, 440 mm\n", truss?.notes);
check(
  "copied photos keep their order and the missing one is left out",
  same(
    truss?.photos.map((p) => p.name.split("_")[0]),
    ["1733500000000", "1733500000001"],
  ) && truss?.photos[0]?.name === "1733500000000_k3j9x.jpg",
  truss?.photos,
);
const tapTest = state.find((entry) => entry.key === "TapTestPanels");
check(
  "a HEIC photo without a v2 name is renamed",
  /^1735689600000_[0-9a-z]{8}\.HEIC$/.test(tapTest?.photos[0]?.name ?? ""),
  tapTest?.photos,
);
check(
  "measurements: valid kept, oversized reduced, invalid skipped, blank description named",
  same(
    tapTest?.measurements.map((m) => [m.id, m.spectrum.frequencies.length, m.description]),
    [
      ["m1", 300, "Top tap"],
      ["m2", 683, "Untitled Analysis"],
    ],
  ),
  tapTest?.measurements.map((m) => [m.id, m.spectrum.frequencies.length, m.description]),
);
const photoUrls = state.flatMap((entry) => entry.photos.map((p) => p.url));
const fetched = await Promise.all(photoUrls.map(async (url) => (await fetch(url)).status));
check(
  "every copied photo is served from v2's public bucket",
  fetched.length === 3 && fetched.every((s) => s === 200),
  fetched,
);
check(
  "photo URLs point at v2 under build/step/name",
  photoUrls.every((url) =>
    url.startsWith(`${v2.API_URL}/storage/v1/object/public/step-photos/${B1}/`),
  ),
  photoUrls,
);
const b2 = build(B2);
check("a blank name becomes Untitled build", b2?.name === "Untitled build", b2?.name);
check("a build with both variants has no guitar type", b2?.guitar_type === null, b2?.guitar_type);
check(
  "an unshared build loses its leftover token",
  b2?.share_enabled === false && b2?.share_token === null,
  b2,
);
check("the conflict account's build is skipped", build(B3) === undefined);
check(
  "a build without a diagram is imported with no steps",
  same(build(B4)?.sequence_state, []),
  build(B4),
);

const panels = await v2Sql.query(
  "select id, owner_id, name, e_cross_gpa, spectra, updated_at from public.wood_panels",
);
const p1 = panels.find((row) => row.id === P1);
check(
  "the panel's E_C is corrected to the width formula",
  Math.abs(Number(p1?.e_cross_gpa) - 0.567) < 0.001,
  p1?.e_cross_gpa,
);
check(
  "the panel keeps its first-version update time",
  String(p1?.updated_at).startsWith("2025-02-02"),
  p1?.updated_at,
);
const spectra = (p1?.spectra ?? {}) as Record<string, { frequencies: number[] }>;
check(
  "spectra are mapped, the oversized one reduced, the invalid and unknown ones left out",
  same(Object.keys(spectra).sort(), ["crossGrain", "longitudinal"]) &&
    spectra.crossGrain?.frequencies.length === 1024,
  Object.keys(spectra),
);
check(
  "ownerless, conflicting and invalid panels are skipped",
  panels.length === 1,
  panels.map((row) => row.name),
);
const defaults = await v2Sql.query("select id from public.default_wood_panels order by id");
check(
  "default panels are imported",
  same(
    defaults.map((row) => row.id),
    [D1, D2],
  ),
  defaults,
);

console.log("\n== apply again");
const again = await runCli(["--apply"]);
check("a second import succeeds", again.code === 0, again.code);
check("a second import duplicates nothing", same(await v2Counts(), afterApply), [
  await v2Counts(),
  afterApply,
]);
check("the first-version project is unchanged", (await v1Checksum()) === sourceBefore);

console.log(
  failures.length === 0
    ? "\nrehearsal: all checks passed"
    : `\nrehearsal: ${failures.length} check(s) failed`,
);
process.exitCode = failures.length === 0 ? 0 : 1;
