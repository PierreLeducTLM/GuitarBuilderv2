type Fetch = typeof fetch;

export type Download =
  | { found: true; bytes: Uint8Array; contentType: string }
  | { found: false; status: number };

export interface SourceStorage {
  download(url: string): Promise<Download>;
  exists(url: string): Promise<boolean>;
}

export interface TargetStorage {
  upload(file: {
    bucket: string;
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<void>;
  publicUrl(bucket: string, path: string): string;
}

const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

export function publicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
}

export function hostedProjectUrl(projectRef: string): string {
  return `https://${projectRef}.supabase.co`;
}

const isClientError = (status: number): boolean => status >= 400 && status < 500;

export function sourceStorage(options: { fetch?: Fetch } = {}): SourceStorage {
  const fetchFn = options.fetch ?? fetch;
  return {
    async download(url) {
      const response = await fetchFn(url);
      if (isClientError(response.status)) {
        return { found: false, status: response.status };
      }
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}): ${url}`);
      }
      return {
        found: true,
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
      };
    },
    async exists(url) {
      const response = await fetchFn(url, { method: "HEAD" });
      if (isClientError(response.status)) {
        return false;
      }
      if (!response.ok) {
        throw new Error(`Check failed (${response.status}): ${url}`);
      }
      return true;
    },
  };
}

export function targetStorage(options: {
  supabaseUrl: string;
  secretKey: string;
  fetch?: Fetch;
}): TargetStorage {
  const fetchFn = options.fetch ?? fetch;
  return {
    async upload({ bucket, path, bytes, contentType }) {
      const response = await fetchFn(
        `${options.supabaseUrl}/storage/v1/object/${bucket}/${encodePath(path)}`,
        {
          method: "POST",
          headers: {
            apikey: options.secretKey,
            Authorization: `Bearer ${options.secretKey}`,
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: bytes,
        },
      );
      if (!response.ok) {
        throw new Error(
          `Upload of ${bucket}/${path} failed (${response.status}): ${await response.text()}`,
        );
      }
    },
    publicUrl(bucket, path) {
      return publicObjectUrl(options.supabaseUrl, bucket, path);
    },
  };
}

type ApiKey = { name?: unknown; type?: unknown; api_key?: unknown };

const isApiKey = (value: unknown): value is ApiKey => typeof value === "object" && value !== null;

/** The target project's secret key, read once at start-up and kept in memory only. */
export async function fetchSecretKey(options: {
  accessToken: string;
  projectRef: string;
  fetch?: Fetch;
}): Promise<string> {
  const fetchFn = options.fetch ?? fetch;
  const response = await fetchFn(
    `https://api.supabase.com/v1/projects/${options.projectRef}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${options.accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(
      `Reading the API keys of ${options.projectRef} failed (${response.status}): ${await response.text()}`,
    );
  }
  const keys: unknown = await response.json();
  const list: ApiKey[] = Array.isArray(keys) ? keys.filter(isApiKey) : [];
  const key =
    list.find((candidate) => candidate.type === "secret") ??
    list.find((candidate) => candidate.name === "service_role");
  if (typeof key?.api_key !== "string") {
    throw new Error(`Project ${options.projectRef} has no secret or service role key`);
  }
  return key.api_key;
}
