/**
 * Test double for the few Supabase endpoints the app calls, so the end-to-end tests
 * can sign in and exercise the shell without Docker. It is NOT a model of the
 * database rules: those are covered by the pgTAP suite (supabase/tests/database).
 *
 * Auth:    POST /auth/v1/token?grant_type=password|refresh_token, POST /auth/v1/signup,
 *          GET /auth/v1/user, POST /auth/v1/logout
 * REST:    GET /rest/v1/profiles?id=eq.<uuid>
 *          GET|POST|PATCH|DELETE /rest/v1/builds (the select, eq, order and
 *          object-response forms the app sends)
 *          POST /rest/v1/rpc/update_build_step, POST /rest/v1/rpc/build_photo_paths
 *          GET|POST|PATCH|DELETE /rest/v1/wood_panels, GET /rest/v1/default_wood_panels,
 *          POST /rest/v1/rpc/load_default_wood_panels
 * Storage: POST /storage/v1/object/step-photos/<path> (upload),
 *          DELETE /storage/v1/object/step-photos (remove),
 *          GET|HEAD /storage/v1/object/public/step-photos/<path> (public read)
 * Test control: POST /__test/reset, POST /__test/users, POST /__test/config,
 *          POST /__test/builds, GET /__test/builds, GET /__test/objects,
 *          POST /__test/wood_panels, GET /__test/wood_panels, POST /__test/default_wood_panels
 *
 * Builds, steps and photos follow the same rules as the database (owner writes,
 * administrators read, one step change at a time, owner-only photo files), and the
 * Storage answers observed on a real stack: a refused remove returns [], a missing
 * public object answers 400, and only images are accepted.
 *
 * Run: node e2e/fake-supabase.ts [port]   (Node >= 22.18 strips the types)
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { woodProperties } from "@gb/dsp";

interface User {
  id: string;
  email: string;
  password: string;
  role: "user" | "admin";
  confirmed: boolean;
  createdAt: string;
}

interface Build {
  id: string;
  owner_id: string;
  name: string;
  guitar_type: "classical" | "steel_string" | null;
  bobo_neck: boolean;
  sequence_state: Record<string, unknown>[];
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface StoredObject {
  ownerId: string;
  contentType: string;
  data: Buffer;
}

interface Config {
  /** Answer sign-out with a server error (app-shell: sign-out failure). */
  failLogout: boolean;
  /** Answer the builds list with a server error (guitar-builds: list fails to load). */
  failBuildList: boolean;
  /** Refuse new builds (guitar-builds: creation fails). */
  failBuildInsert: boolean;
  /** Delay before answering a new build, to observe "Adding...". */
  buildInsertDelayMs: number;
  /** Refuse build deletion (guitar-builds: deletion fails). */
  failBuildDelete: boolean;
  /** Refuse every step change (build-sequence: Step Save Failures). */
  failStepChanges: boolean;
  /** Refuse uploads whose original file name matches this pattern. */
  failUploadsMatching: string | null;
  /** Delay before answering an upload, to observe "Uploading...". */
  uploadDelayMs: number;
  /** Answer photo removals as a refusal (an empty list). */
  failStorageRemove: boolean;
  /** Answer sign-in with 503, which supabase-js treats as a network failure. */
  failSignIn: boolean;
  /** Sign-ups need email verification (no session until confirmed). */
  requireConfirmation: boolean;
  /** Delay before answering sign-in, to observe the pending state. */
  signInDelayMs: number;
  /** Answer the wood panel library with a server error (Library Load Failures). */
  failWoodList: boolean;
  /** Answer loading one wood panel with a server error. */
  failWoodLoad: boolean;
  /** Refuse wood panel saves and updates (Save Outcome). */
  failWoodSave: boolean;
  /** Delay before answering a wood panel save, to observe "Saving...". */
  woodSaveDelayMs: number;
  /** Refuse wood panel deletion (Delete Outcome). */
  failWoodDelete: boolean;
  /** Answer "Load Default Panels" with a server error. */
  failLoadDefaults: boolean;
  /** Delay before answering "Load Default Panels", to observe "Loading...". */
  loadDefaultsDelayMs: number;
}

const users = new Map<string, User>();
const accessTokens = new Map<string, string>();
const refreshTokens = new Map<string, string>();
const builds = new Map<string, Build>();
const objects = new Map<string, StoredObject>();
const woodPanels = new Map<string, WoodPanel>();
const referencePanels = new Map<string, WoodPanel>();
const defaults: Config = {
  failLogout: false,
  failBuildList: false,
  failBuildInsert: false,
  buildInsertDelayMs: 0,
  failBuildDelete: false,
  failStepChanges: false,
  failUploadsMatching: null,
  uploadDelayMs: 0,
  failStorageRemove: false,
  failSignIn: false,
  requireConfirmation: false,
  signInDelayMs: 0,
  failWoodList: false,
  failWoodLoad: false,
  failWoodSave: false,
  woodSaveDelayMs: 0,
  failWoodDelete: false,
  failLoadDefaults: false,
  loadDefaultsDelayMs: 0,
};
let config: Config = { ...defaults };

function reset() {
  users.clear();
  builds.clear();
  objects.clear();
  woodPanels.clear();
  referencePanels.clear();
  accessTokens.clear();
  refreshTokens.clear();
  config = { ...defaults };
}

function addUser(email: string, password: string, role?: "user" | "admin", confirmed = true): User {
  const user: User = {
    id: randomUUID(),
    email: email.toLowerCase(),
    password,
    // Same rule as the database trigger: the first account is the administrator.
    role: role ?? (users.size === 0 ? "admin" : "user"),
    confirmed,
    createdAt: new Date().toISOString(),
  };
  users.set(user.email, user);
  return user;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

function userJson(user: User) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.confirmed ? user.createdAt : null,
    confirmed_at: user.confirmed ? user.createdAt : null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: user.createdAt,
    updated_at: user.createdAt,
  };
}

function session(user: User) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
      session_id: randomUUID(),
    }),
  );
  const accessToken = `${header}.${payload}.${base64url(randomBytes(32))}`;
  const refreshToken = base64url(randomBytes(24));
  accessTokens.set(accessToken, user.id);
  refreshTokens.set(refreshToken, user.id);
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refreshToken,
    user: userJson(user),
  };
}

function userById(id: string | undefined): User | undefined {
  if (!id) return undefined;
  for (const user of users.values()) if (user.id === id) return user;
  return undefined;
}

function bearerUser(request: IncomingMessage): User | undefined {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  return token ? userById(accessTokens.get(token)) : undefined;
}

async function rawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const text = (await rawBody(request)).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function send(response: ServerResponse, status: number, data?: unknown) {
  response.statusCode = status;
  if (data === undefined) return response.end();
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(data));
}

function authError(response: ServerResponse, status: number, code: string, message: string) {
  send(response, status, { code: status, error_code: code, msg: message });
}

/** A PostgREST error body. */
function restError(response: ServerResponse, status: number, code: string, message: string) {
  send(response, status, { code, message, details: null, hint: null });
}

// ---------------------------------------------------------------------------
// Builds (mirrors supabase/migrations/20261102120000_builds_and_steps.sql)
// ---------------------------------------------------------------------------

const BUILD_COLUMNS = [
  "id",
  "owner_id",
  "name",
  "guitar_type",
  "bobo_neck",
  "sequence_state",
  "share_enabled",
  "created_at",
  "updated_at",
] as const;

/** Builds the viewer may read: their own, or every build for an administrator. */
function readableBuilds(viewer: User | undefined): Build[] {
  if (!viewer) return [];
  return [...builds.values()].filter((b) => b.owner_id === viewer.id || viewer.role === "admin");
}

/** Applies the `column=eq.value` filters of a PostgREST query. */
function filterRows(rows: Build[], params: URLSearchParams): Build[] {
  let result = rows;
  for (const [column, value] of params) {
    if (!value.startsWith("eq.")) continue;
    const wanted = value.slice(3);
    result = result.filter((row) => String(row[column as keyof Build]) === wanted);
  }
  return result;
}

function project(row: Build, params: URLSearchParams): Record<string, unknown> {
  const columns = (params.get("select") ?? "*").split(",").map((c) => c.trim());
  if (columns.includes("*")) return { ...row };
  const projected: Record<string, unknown> = {};
  for (const column of columns) {
    if (!(BUILD_COLUMNS as readonly string[]).includes(column)) {
      throw Object.assign(new Error(`permission denied for column ${column}`), { status: 401 });
    }
    projected[column] = row[column as keyof Build];
  }
  return projected;
}

function sendRows(
  request: IncomingMessage,
  response: ServerResponse,
  rows: Record<string, unknown>[],
  status = 200,
) {
  if (request.headers.accept?.includes("application/vnd.pgrst.object+json")) {
    if (rows.length !== 1) {
      return restError(
        response,
        406,
        "PGRST116",
        "JSON object requested, multiple (or no) rows returned",
      );
    }
    return send(response, status, rows[0]);
  }
  return send(response, status, rows);
}

function sortRows(rows: Build[], params: URLSearchParams): Build[] {
  const order = params.get("order");
  if (!order) return rows;
  const [column, direction] = order.split(".");
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = String(a[column as keyof Build]);
    const right = String(b[column as keyof Build]);
    return left < right ? -sign : left > right ? sign : 0;
  });
}

function isGuitarType(value: unknown): value is Build["guitar_type"] {
  return value === "classical" || value === "steel_string";
}

/** One step change, as update_build_step applies it. Throws a message on bad input. */
function applyStepChange(build: Build, key: string, change: Record<string, unknown>) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(key)) throw new Error("Invalid step key");
  const index = build.sequence_state.findIndex((entry) => entry.key === key);
  const stored = index >= 0 ? (build.sequence_state[index] as Record<string, unknown>) : {};
  const entry = {
    key,
    completed: stored.completed === true,
    notes: typeof stored.notes === "string" ? stored.notes : "",
    photos: Array.isArray(stored.photos) ? [...stored.photos] : [],
    measurements: Array.isArray(stored.measurements) ? [...stored.measurements] : [],
  } as {
    key: string;
    completed: boolean;
    notes: string;
    photos: unknown[];
    measurements: Record<string, unknown>[];
  };

  switch (change.op) {
    case "set_completed":
      if (typeof change.completed !== "boolean") throw new Error("completed must be a boolean");
      entry.completed = change.completed;
      break;
    case "set_notes":
      if (typeof change.notes !== "string") throw new Error("notes must be text");
      entry.notes = change.notes;
      break;
    case "add_photos": {
      const photos = change.photos;
      if (!Array.isArray(photos) || photos.length === 0)
        throw new Error("photos must be a non-empty list");
      for (const photo of photos as Record<string, unknown>[]) {
        const name = String(photo.name);
        if (
          !/^[0-9]{1,16}_[A-Za-z0-9]{1,32}\.[A-Za-z0-9]{1,16}$/.test(name) ||
          !String(photo.url).endsWith(`/${build.id}/${key}/${name}`)
        ) {
          throw new Error("Invalid photo");
        }
        entry.photos.push({ url: photo.url, name: photo.name });
      }
      break;
    }
    case "remove_photo":
      entry.photos = entry.photos.filter((p) => (p as { name?: unknown }).name !== change.name);
      break;
    case "add_measurement": {
      const m = change.measurement as Record<string, unknown> | undefined;
      const description = typeof m?.description === "string" ? m.description.trim() : "";
      if (
        !m ||
        typeof m.id !== "string" ||
        !description ||
        typeof m.frequency !== "number" ||
        !isObject(m.spectrum) ||
        !rolesAreValid(m.roles)
      ) {
        throw new Error("Invalid measurement");
      }
      if (!spectrumRecordIsValid(m.spectrum)) throw new Error("Invalid spectrum");
      if (entry.measurements.some((other) => other.id === m.id))
        throw new Error("Duplicate measurement");
      entry.measurements.push({ ...m, description });
      break;
    }
    case "set_measurement_description": {
      const description = typeof change.description === "string" ? change.description.trim() : "";
      if (!description) throw new Error("Invalid description");
      const target = entry.measurements.find((m) => m.id === change.id);
      if (!target) throw new Error("Measurement not found");
      entry.measurements = entry.measurements.map((m) =>
        m === target ? { ...m, description } : m,
      );
      break;
    }
    case "remove_measurement":
      entry.measurements = entry.measurements.filter((m) => m.id !== change.id);
      break;
    default:
      throw new Error("Unknown operation");
  }
  if (index >= 0) build.sequence_state[index] = entry;
  else build.sequence_state.push(entry);
  build.updated_at = new Date().toISOString();
  return entry;
}

// Mirrors public.spectrum_record_is_valid and public.measurement_roles_are_valid
// (supabase/migrations/20261104120000_spectrum_record_checks.sql).
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numbers(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((x) => typeof x === "number") ? value : null;
}

function spectrumRecordIsValid(record: Record<string, unknown>): boolean {
  const frequencies = numbers(record.frequencies);
  const magnitudes = numbers(record.magnitudes);
  const magnitudesDb = numbers(record.magnitudesDb);
  const { sampleRate, fftSize, binWidth } = record;
  if (!frequencies || !magnitudes || !magnitudesDb) return false;
  if (
    typeof sampleRate !== "number" ||
    typeof fftSize !== "number" ||
    typeof binWidth !== "number"
  ) {
    return false;
  }
  const n = frequencies.length;
  return (
    n >= 1 &&
    n <= 1024 &&
    magnitudes.length === n &&
    magnitudesDb.length === n &&
    frequencies.every((f, i) => f > 0 && f <= 2000 && (i === 0 || f > (frequencies[i - 1] ?? 0))) &&
    magnitudes.every((m) => m >= 0) &&
    sampleRate > 0 &&
    Number.isInteger(Math.log2(fftSize)) &&
    fftSize <= 32768 &&
    Math.abs(binWidth - sampleRate / fftSize) <= 1e-9 * binWidth
  );
}

function rolesAreValid(roles: unknown): boolean {
  if (roles === undefined || roles === null) return true;
  if (!isObject(roles)) return false;
  const optionalQ = (q: unknown) => q === null || (typeof q === "number" && q > 0);
  return Object.entries(roles).every(
    ([name, role]) =>
      ["air", "top", "back"].includes(name) &&
      isObject(role) &&
      Object.keys(role).sort().join(",") === "decayQ,frequency,level,origin,spectralQ" &&
      typeof role.frequency === "number" &&
      role.frequency >= 30 &&
      role.frequency <= 1000 &&
      typeof role.level === "number" &&
      optionalQ(role.spectralQ) &&
      optionalQ(role.decayQ) &&
      (role.origin === "auto" || role.origin === "user"),
  );
}

// ---------------------------------------------------------------------------
// Wood panels (mirrors supabase/migrations/20261104130000_wood_panels.sql)
// ---------------------------------------------------------------------------

const WOOD_INPUTS = [
  "sample_length_mm",
  "sample_width_mm",
  "sample_thickness_mm",
  "sample_mass_g",
  "freq_longitudinal_hz",
  "freq_cross_grain_hz",
  "freq_diagonal_hz",
  "plate_length_mm",
  "plate_width_mm",
  "stiffness_parameter",
] as const;
type WoodInput = (typeof WOOD_INPUTS)[number];
const WOOD_WRITABLE: readonly string[] = ["name", ...WOOD_INPUTS, "spectra"];
const WOOD_SPECTRUM_KEYS = ["longitudinal", "crossGrain", "diagonal"];

interface WoodPanel extends Record<WoodInput, number> {
  id: string;
  owner_id: string | null;
  name: string;
  spectra: Record<string, unknown>;
  e_long_gpa: number;
  e_cross_gpa: number;
  g_lc_gpa: number;
  target_thickness_mm: number;
  estimated_mass_g: number;
  created_at: string;
  updated_at: string;
}

/** The generated results snapshot, computed with the same formulas as the database. */
function withSnapshot(
  panel: Omit<
    WoodPanel,
    "e_long_gpa" | "e_cross_gpa" | "g_lc_gpa" | "target_thickness_mm" | "estimated_mass_g"
  >,
): WoodPanel {
  const result = woodProperties({
    lengthMm: panel.sample_length_mm,
    widthMm: panel.sample_width_mm,
    thicknessMm: panel.sample_thickness_mm,
    massG: panel.sample_mass_g,
    fLongHz: panel.freq_longitudinal_hz,
    fCrossHz: panel.freq_cross_grain_hz,
    fDiagHz: panel.freq_diagonal_hz,
    plateLengthMm: panel.plate_length_mm,
    plateWidthMm: panel.plate_width_mm,
    stiffness: panel.stiffness_parameter,
  });
  return {
    ...panel,
    e_long_gpa: result.eLong,
    e_cross_gpa: result.eCross,
    g_lc_gpa: result.gLc,
    target_thickness_mm: result.targetThickness,
    estimated_mass_g: result.estimatedMass,
  };
}

/** The wood checks of the migration: a non-blank name, finite positive inputs, valid spectra. */
function woodRefusal(panel: Record<string, unknown>): string | null {
  if (typeof panel.name !== "string" || !/\S/.test(panel.name)) return "name";
  for (const column of WOOD_INPUTS) {
    const value = panel[column];
    if (typeof value !== "number" || !(value > 0) || !Number.isFinite(value)) return column;
  }
  const spectra = panel.spectra;
  if (!isObject(spectra)) return "spectra";
  for (const [key, record] of Object.entries(spectra)) {
    if (!WOOD_SPECTRUM_KEYS.includes(key) || !isObject(record) || !spectrumRecordIsValid(record)) {
      return "spectra";
    }
  }
  return null;
}

function eqFilter<T extends object>(rows: T[], params: URLSearchParams): T[] {
  return [...params].reduce(
    (result, [column, value]) =>
      value.startsWith("eq.")
        ? result.filter(
            (row) => String((row as Record<string, unknown>)[column]) === value.slice(3),
          )
        : result,
    rows,
  );
}

function orderRows<T extends object>(rows: T[], params: URLSearchParams): T[] {
  const order = params.get("order");
  if (!order) return rows;
  const [column = "", direction] = order.split(".");
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = String((a as Record<string, unknown>)[column]);
    const right = String((b as Record<string, unknown>)[column]);
    return left < right ? -sign : left > right ? sign : 0;
  });
}

function projectColumns(row: object, params: URLSearchParams): Record<string, unknown> {
  const columns = (params.get("select") ?? "*").split(",").map((c) => c.trim());
  const record = row as Record<string, unknown>;
  if (columns.includes("*")) return { ...record };
  return Object.fromEntries(columns.map((column) => [column, record[column]]));
}

async function handleWoodPanels(request: IncomingMessage, response: ServerResponse, url: URL) {
  const viewer = bearerUser(request);
  const params = url.searchParams;
  if (!viewer) return restError(response, 401, "42501", "permission denied for table wood_panels");
  const readable = [...woodPanels.values()].filter(
    (panel) => panel.owner_id === viewer.id || viewer.role === "admin",
  );
  const owned = (rows: WoodPanel[]) => rows.filter((panel) => panel.owner_id === viewer.id);
  switch (request.method) {
    case "GET": {
      if (config.failWoodList && params.has("order")) {
        return restError(response, 500, "XX000", "fake-supabase: wood list failure");
      }
      if (config.failWoodLoad && params.has("id")) {
        return restError(response, 500, "XX000", "fake-supabase: wood load failure");
      }
      const rows = orderRows(eqFilter(readable, params), params);
      return sendRows(
        request,
        response,
        rows.map((row) => projectColumns(row, params)),
      );
    }
    case "POST": {
      if (config.woodSaveDelayMs > 0) await delay(config.woodSaveDelayMs);
      const input = await body(request);
      if (Object.keys(input).some((column) => !WOOD_WRITABLE.includes(column))) {
        return restError(response, 401, "42501", "permission denied for table wood_panels");
      }
      if (config.failWoodSave)
        return restError(response, 500, "XX000", "fake-supabase: wood save failure");
      const candidate = { stiffness_parameter: 75, spectra: {}, ...input };
      const refusal = woodRefusal(candidate);
      if (refusal)
        return restError(response, 400, "23514", `violates check constraint on ${refusal}`);
      const now = new Date().toISOString();
      const panel = withSnapshot({
        ...(candidate as Record<WoodInput, number> & {
          name: string;
          spectra: Record<string, unknown>;
        }),
        id: randomUUID(),
        owner_id: viewer.id,
        created_at: now,
        updated_at: now,
      });
      woodPanels.set(panel.id, panel);
      return sendRows(request, response, [projectColumns(panel, params)], 201);
    }
    case "PATCH": {
      if (config.woodSaveDelayMs > 0) await delay(config.woodSaveDelayMs);
      const input = await body(request);
      if (Object.keys(input).some((column) => !WOOD_WRITABLE.includes(column))) {
        return restError(response, 401, "42501", "permission denied for table wood_panels");
      }
      if (config.failWoodSave)
        return restError(response, 500, "XX000", "fake-supabase: wood save failure");
      const rows = owned(eqFilter(readable, params));
      for (const row of rows) {
        const refusal = woodRefusal({ ...row, ...input });
        if (refusal)
          return restError(response, 400, "23514", `violates check constraint on ${refusal}`);
      }
      const updated = rows.map((row) => {
        const {
          e_long_gpa,
          e_cross_gpa,
          g_lc_gpa,
          target_thickness_mm,
          estimated_mass_g,
          ...stored
        } = row;
        const next = withSnapshot({ ...stored, ...input, updated_at: new Date().toISOString() });
        woodPanels.set(next.id, next);
        return next;
      });
      return sendRows(
        request,
        response,
        updated.map((row) => projectColumns(row, params)),
      );
    }
    case "DELETE": {
      if (config.failWoodDelete)
        return restError(response, 500, "XX000", "fake-supabase: wood delete failure");
      const rows = owned(eqFilter(readable, params));
      for (const row of rows) woodPanels.delete(row.id);
      return sendRows(
        request,
        response,
        rows.map((row) => projectColumns(row, params)),
      );
    }
    default:
      return restError(response, 405, "PGRST000", "method not allowed");
  }
}

/** Seeds a panel from a test request: the owner's email, a name and the ten inputs. */
function seededPanel(input: Record<string, unknown>, ownerId: string | null): WoodPanel {
  const created = String(input.created_at ?? new Date().toISOString());
  const values = Object.fromEntries(
    WOOD_INPUTS.map((column) => [
      column,
      Number(input[column] ?? (column === "stiffness_parameter" ? 75 : 1)),
    ]),
  ) as Record<WoodInput, number>;
  return withSnapshot({
    ...values,
    id: String(input.id ?? randomUUID()),
    owner_id: ownerId,
    name: String(input.name),
    spectra: isObject(input.spectra) ? input.spectra : {},
    created_at: created,
    updated_at: created,
  });
}

// ---------------------------------------------------------------------------
// Storage (step-photos bucket)
// ---------------------------------------------------------------------------

const BUCKET = "step-photos";

/** Whether `path` is <build id>/<step key>/<file> for a build the user owns. */
function ownsPhotoPath(user: User | undefined, path: string): boolean {
  const parts = path.split("/");
  if (!user || parts.length !== 3 || !/^[A-Za-z0-9]{1,64}$/.test(parts[1] ?? "")) return false;
  return builds.get(parts[0] ?? "")?.owner_id === user.id;
}

/** The file part of a multipart upload (storage-js sends Blobs as form data). */
function filePart(raw: Buffer, contentType: string) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!boundary) return { fileName: "", contentType, data: raw };
  const text = raw.toString("latin1");
  const marker = `--${boundary[1] ?? boundary[2]}`;
  for (const part of text.split(marker)) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headers = part.slice(0, headerEnd);
    const fileName = /filename="([^"]*)"/.exec(headers)?.[1];
    if (fileName === undefined) continue;
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? "application/octet-stream";
    const content = part.slice(headerEnd + 4, part.length - 2);
    return { fileName, contentType: type.trim(), data: Buffer.from(content, "latin1") };
  }
  return { fileName: "", contentType: "application/octet-stream", data: Buffer.alloc(0) };
}

function storageError(response: ServerResponse, status: number, error: string, message: string) {
  send(response, status, { statusCode: String(status), error, message });
}

async function handleBuilds(request: IncomingMessage, response: ServerResponse, url: URL) {
  const viewer = bearerUser(request);
  const params = url.searchParams;
  switch (request.method) {
    case "GET": {
      if (config.failBuildList && params.has("order")) {
        return restError(response, 500, "XX000", "fake-supabase: list failure");
      }
      const rows = sortRows(filterRows(readableBuilds(viewer), params), params);
      return sendRows(
        request,
        response,
        rows.map((row) => project(row, params)),
      );
    }
    case "POST": {
      if (config.buildInsertDelayMs > 0) await delay(config.buildInsertDelayMs);
      const input = await body(request);
      if (!viewer) return restError(response, 401, "42501", "permission denied for table builds");
      if (config.failBuildInsert)
        return restError(response, 500, "XX000", "fake-supabase: insert failure");
      const allowed = ["name", "guitar_type", "bobo_neck"];
      if (Object.keys(input).some((column) => !allowed.includes(column))) {
        return restError(response, 401, "42501", "permission denied for table builds");
      }
      if (!isGuitarType(input.guitar_type)) {
        return restError(response, 403, "42501", "new row violates row-level security policy");
      }
      if (typeof input.name !== "string" || !/\S/.test(input.name)) {
        return restError(response, 400, "23514", "violates check constraint builds_name_not_blank");
      }
      const now = new Date().toISOString();
      const build: Build = {
        id: randomUUID(),
        owner_id: viewer.id,
        name: input.name,
        guitar_type: input.guitar_type,
        bobo_neck: input.bobo_neck === true,
        sequence_state: [],
        share_enabled: false,
        created_at: now,
        updated_at: now,
      };
      builds.set(build.id, build);
      return sendRows(request, response, [project(build, params)], 201);
    }
    case "PATCH": {
      const input = await body(request);
      const allowed = ["guitar_type", "bobo_neck"];
      if (!viewer || Object.keys(input).some((column) => !allowed.includes(column))) {
        return restError(response, 401, "42501", "permission denied for table builds");
      }
      const rows = filterRows(readableBuilds(viewer), params).filter(
        (b) => b.owner_id === viewer.id,
      );
      if ("guitar_type" in input && !isGuitarType(input.guitar_type)) {
        return restError(response, 403, "42501", "new row violates row-level security policy");
      }
      for (const row of rows) {
        if ("guitar_type" in input) row.guitar_type = input.guitar_type as Build["guitar_type"];
        if ("bobo_neck" in input) row.bobo_neck = input.bobo_neck === true;
        row.updated_at = new Date().toISOString();
      }
      return sendRows(
        request,
        response,
        rows.map((row) => project(row, params)),
      );
    }
    case "DELETE": {
      if (config.failBuildDelete)
        return restError(response, 500, "XX000", "fake-supabase: delete failure");
      const rows = viewer
        ? filterRows(readableBuilds(viewer), params).filter((b) => b.owner_id === viewer.id)
        : [];
      for (const row of rows) builds.delete(row.id);
      return sendRows(
        request,
        response,
        rows.map((row) => project(row, params)),
      );
    }
    default:
      return restError(response, 405, "PGRST000", "method not allowed");
  }
}

async function handleStorage(request: IncomingMessage, response: ServerResponse, url: URL) {
  const viewer = bearerUser(request);
  const publicPrefix = `/storage/v1/object/public/${BUCKET}/`;
  const objectPrefix = `/storage/v1/object/${BUCKET}/`;

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    url.pathname.startsWith(publicPrefix)
  ) {
    const stored = objects.get(decodeURIComponent(url.pathname.slice(publicPrefix.length)));
    if (!stored) return storageError(response, 400, "not_found", "Object not found");
    response.statusCode = 200;
    response.setHeader("content-type", stored.contentType);
    return response.end(request.method === "HEAD" ? undefined : stored.data);
  }

  if (request.method === "POST" && url.pathname.startsWith(objectPrefix)) {
    const path = decodeURIComponent(url.pathname.slice(objectPrefix.length));
    const part = filePart(await rawBody(request), request.headers["content-type"] ?? "");
    if (config.uploadDelayMs > 0) await delay(config.uploadDelayMs);
    if (config.failUploadsMatching && new RegExp(config.failUploadsMatching).test(part.fileName)) {
      return storageError(response, 500, "internal", "fake-supabase: upload failure");
    }
    if (!part.contentType.startsWith("image/")) {
      return storageError(
        response,
        415,
        "invalid_mime_type",
        `mime type ${part.contentType} is not supported`,
      );
    }
    if (!ownsPhotoPath(viewer, path)) {
      return storageError(
        response,
        403,
        "Unauthorized",
        "new row violates row-level security policy",
      );
    }
    if (objects.has(path))
      return storageError(response, 409, "Duplicate", "The resource already exists");
    objects.set(path, {
      ownerId: viewer?.id ?? "",
      contentType: part.contentType,
      data: part.data,
    });
    return send(response, 200, { Key: `${BUCKET}/${path}`, Id: randomUUID() });
  }

  if (request.method === "DELETE" && url.pathname === `/storage/v1/object/${BUCKET}`) {
    const { prefixes } = await body(request);
    const removed: { name: string; bucket_id: string }[] = [];
    if (!config.failStorageRemove) {
      for (const path of Array.isArray(prefixes) ? (prefixes as string[]) : []) {
        if (objects.has(path) && ownsPhotoPath(viewer, path)) {
          objects.delete(path);
          removed.push({ name: path, bucket_id: BUCKET });
        }
      }
    }
    return send(response, 200, removed);
  }

  return storageError(
    response,
    404,
    "not_found",
    `fake-supabase: no storage handler for ${url.pathname}`,
  );
}

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", request.headers.origin ?? "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    request.headers["access-control-request-headers"] ?? "*",
  );
  response.setHeader("access-control-expose-headers", "x-supabase-api-version");
  if (request.method === "OPTIONS") return send(response, 204);

  const url = new URL(request.url ?? "/", "http://fake.supabase");
  const route = `${request.method} ${url.pathname}`;

  try {
    if (url.pathname === "/rest/v1/builds") return await handleBuilds(request, response, url);
    if (url.pathname === "/rest/v1/wood_panels")
      return await handleWoodPanels(request, response, url);
    if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(request, response, url);

    switch (route) {
      case "POST /__test/reset":
        reset();
        return send(response, 204);
      case "POST /__test/users": {
        const { email, password, role } = await body(request);
        const user = addUser(String(email), String(password), role as User["role"] | undefined);
        return send(response, 201, { id: user.id, role: user.role });
      }
      case "POST /__test/config":
        config = { ...config, ...(await body(request)) };
        return send(response, 204);
      case "POST /__test/builds": {
        const input = await body(request);
        const owner = users.get(String(input.ownerEmail).toLowerCase());
        if (!owner) return send(response, 400, { message: "unknown owner" });
        const created = String(input.created_at ?? new Date().toISOString());
        const build: Build = {
          id: String(input.id ?? randomUUID()),
          owner_id: owner.id,
          name: String(input.name),
          guitar_type: (input.guitar_type ?? null) as Build["guitar_type"],
          bobo_neck: input.bobo_neck !== false,
          sequence_state: (input.sequence_state ?? []) as Build["sequence_state"],
          share_enabled: false,
          created_at: created,
          updated_at: created,
        };
        builds.set(build.id, build);
        return send(response, 201, build);
      }
      case "GET /__test/builds":
        return send(response, 200, [...builds.values()]);
      case "GET /__test/objects":
        return send(response, 200, [...objects.keys()]);
      case "POST /__test/wood_panels": {
        const input = await body(request);
        const owner = users.get(String(input.ownerEmail).toLowerCase());
        if (!owner) return send(response, 400, { message: "unknown owner" });
        const panel = seededPanel(input, owner.id);
        woodPanels.set(panel.id, panel);
        return send(response, 201, panel);
      }
      case "GET /__test/wood_panels":
        return send(response, 200, [...woodPanels.values()]);
      case "POST /__test/default_wood_panels": {
        const input = await body(request);
        const list = Array.isArray(input.panels) ? input.panels : [];
        for (const item of list) {
          const panel = seededPanel(isObject(item) ? item : {}, null);
          referencePanels.set(panel.id, panel);
        }
        return send(response, 201, [...referencePanels.values()]);
      }

      case "GET /rest/v1/default_wood_panels": {
        const viewer = bearerUser(request);
        if (!viewer)
          return restError(
            response,
            401,
            "42501",
            "permission denied for table default_wood_panels",
          );
        const rows = orderRows(
          eqFilter([...referencePanels.values()], url.searchParams),
          url.searchParams,
        );
        return sendRows(
          request,
          response,
          rows.map((row) => projectColumns(row, url.searchParams)),
        );
      }
      case "POST /rest/v1/rpc/load_default_wood_panels": {
        const viewer = bearerUser(request);
        if (!viewer) return restError(response, 401, "42501", "Not signed in");
        if (config.loadDefaultsDelayMs > 0) await delay(config.loadDefaultsDelayMs);
        if (config.failLoadDefaults) {
          return restError(response, 500, "XX000", "fake-supabase: load defaults failure");
        }
        if ([...woodPanels.values()].some((panel) => panel.owner_id === viewer.id)) {
          return send(response, 200, null);
        }
        const references = orderRows(
          [...referencePanels.values()],
          new URLSearchParams("order=created_at.asc"),
        );
        for (const reference of references) {
          const now = new Date().toISOString();
          const copy = {
            ...reference,
            id: randomUUID(),
            owner_id: viewer.id,
            spectra: {},
            created_at: now,
            updated_at: now,
          };
          woodPanels.set(copy.id, copy);
        }
        return send(response, 200, references.length);
      }

      case "POST /rest/v1/rpc/update_build_step": {
        const viewer = bearerUser(request);
        const input = await body(request);
        const build = builds.get(String(input.p_build_id));
        if (!viewer || !build || build.owner_id !== viewer.id) {
          return restError(response, 404, "P0002", "Build not found");
        }
        if (config.failStepChanges)
          return restError(response, 500, "XX000", "fake-supabase: step failure");
        try {
          const entry = applyStepChange(
            build,
            String(input.p_step_key),
            (input.p_change ?? {}) as Record<string, unknown>,
          );
          return send(response, 200, entry);
        } catch (error) {
          return restError(response, 400, "22023", (error as Error).message);
        }
      }

      case "POST /rest/v1/rpc/build_photo_paths": {
        const viewer = bearerUser(request);
        const input = await body(request);
        const prefix = `${String(input.p_build_id)}/`;
        const paths = [...objects.keys()]
          .filter((path) => path.startsWith(prefix) && ownsPhotoPath(viewer, path))
          .sort();
        return send(response, 200, paths);
      }

      case "POST /auth/v1/token": {
        const grant = url.searchParams.get("grant_type");
        const input = await body(request);
        if (grant === "password") {
          if (config.signInDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, config.signInDelayMs));
          }
          if (config.failSignIn)
            return authError(response, 503, "unexpected_failure", "Service Unavailable");
          const user = users.get(String(input.email).toLowerCase());
          if (!user || user.password !== input.password) {
            return authError(response, 400, "invalid_credentials", "Invalid login credentials");
          }
          if (!user.confirmed)
            return authError(response, 400, "email_not_confirmed", "Email not confirmed");
          return send(response, 200, session(user));
        }
        if (grant === "refresh_token") {
          const token = String(input.refresh_token);
          const user = userById(refreshTokens.get(token));
          if (!user)
            return authError(response, 400, "refresh_token_not_found", "Invalid Refresh Token");
          refreshTokens.delete(token);
          return send(response, 200, session(user));
        }
        return authError(response, 400, "unsupported_grant_type", "Unsupported grant type");
      }

      case "POST /auth/v1/signup": {
        const { email, password } = await body(request);
        const address = String(email).toLowerCase();
        if (users.has(address)) {
          return authError(response, 422, "user_already_exists", "User already registered");
        }
        const user = addUser(address, String(password), undefined, !config.requireConfirmation);
        return send(response, 200, user.confirmed ? session(user) : userJson(user));
      }

      case "GET /auth/v1/user": {
        const user = bearerUser(request);
        if (!user) return authError(response, 403, "bad_jwt", "invalid JWT");
        return send(response, 200, userJson(user));
      }

      case "POST /auth/v1/logout": {
        if (config.failLogout)
          return authError(response, 500, "unexpected_failure", "Logout failed");
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (token) accessTokens.delete(token);
        return send(response, 204);
      }

      case "GET /rest/v1/profiles": {
        const viewer = bearerUser(request);
        const wanted = url.searchParams.get("id")?.replace(/^eq\./, "");
        const target = userById(wanted);
        // Mirrors the read policy closely enough for the shell: own row, or any row for admins.
        const visible = viewer && target && (viewer.id === target.id || viewer.role === "admin");
        const rows = visible ? [{ id: target.id, email: target.email, role: target.role }] : [];
        return send(response, 200, rows);
      }

      default:
        return send(response, 404, { message: `fake-supabase: no handler for ${route}` });
    }
  } catch (error) {
    return send(response, 500, { message: String(error) });
  }
});

const port = Number(process.argv[2] ?? process.env.FAKE_SUPABASE_PORT ?? 54339);
server.listen(port, "127.0.0.1", () => {
  console.log(`fake-supabase listening on http://127.0.0.1:${port}`);
});
