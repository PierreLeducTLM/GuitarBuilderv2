import { describe, expect, it, vi } from "vitest";
import {
  fetchSecretKey,
  hostedProjectUrl,
  publicObjectUrl,
  sourceStorage,
  targetStorage,
} from "./storage.ts";

const respond = (response: Response) => vi.fn<typeof fetch>(async () => response);

describe("publicObjectUrl", () => {
  it("builds the public URL of an object, encoding each path segment", () => {
    expect(
      publicObjectUrl("http://127.0.0.1:58321", "step-photos", "b1/Bracing/17_a b#c.JPG"),
    ).toBe(
      "http://127.0.0.1:58321/storage/v1/object/public/step-photos/b1/Bracing/17_a%20b%23c.JPG",
    );
  });
});

describe("hostedProjectUrl", () => {
  it("is the project's supabase.co address", () => {
    expect(hostedProjectUrl("abcdref")).toBe("https://abcdref.supabase.co");
  });
});

describe("sourceStorage", () => {
  const url = "https://legacy.supabase.co/storage/v1/object/public/step-photos/b1/s/1_a.jpg";

  it("downloads a file with its content type", async () => {
    const fetchFn = respond(
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
    );

    const result = await sourceStorage({ fetch: fetchFn }).download(url);

    expect(result).toEqual({
      found: true,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    expect(fetchFn).toHaveBeenCalledWith(url);
  });

  it("falls back to a generic content type", async () => {
    const response = new Response(new Uint8Array([9]));
    response.headers.delete("content-type");

    const result = await sourceStorage({ fetch: respond(response) }).download(url);

    expect(result).toEqual({
      found: true,
      bytes: new Uint8Array([9]),
      contentType: "application/octet-stream",
    });
  });

  it.each([400, 404, 499])("reports a %i answer as a missing file", async (status) => {
    const result = await sourceStorage({
      fetch: respond(new Response("not found", { status })),
    }).download(url);

    expect(result).toEqual({ found: false, status });
  });

  it("fails on a server error", async () => {
    await expect(
      sourceStorage({ fetch: respond(new Response("boom", { status: 500 })) }).download(url),
    ).rejects.toThrow(`Download failed (500): ${url}`);
  });

  it("checks that a file exists with a HEAD request", async () => {
    const fetchFn = respond(new Response(null, { status: 200 }));

    await expect(sourceStorage({ fetch: fetchFn }).exists(url)).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(url, { method: "HEAD" });
  });

  it("reports a missing file from a 4xx HEAD answer", async () => {
    await expect(
      sourceStorage({ fetch: respond(new Response(null, { status: 404 })) }).exists(url),
    ).resolves.toBe(false);
  });

  it("fails a HEAD request on a server error", async () => {
    await expect(
      sourceStorage({ fetch: respond(new Response(null, { status: 503 })) }).exists(url),
    ).rejects.toThrow(`Check failed (503): ${url}`);
  });
});

describe("targetStorage", () => {
  it("uploads with upsert, the content type and the secret key", async () => {
    const fetchFn = respond(new Response('{"Key":"step-photos/b1/s/1_a.jpg"}', { status: 200 }));
    const storage = targetStorage({
      supabaseUrl: "http://127.0.0.1:57321",
      secretKey: "sb_secret_x",
      fetch: fetchFn,
    });

    await storage.upload({
      bucket: "step-photos",
      path: "b1/s/1_a.jpg",
      bytes: new Uint8Array([1]),
      contentType: "image/jpeg",
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:57321/storage/v1/object/step-photos/b1/s/1_a.jpg",
      {
        method: "POST",
        headers: {
          apikey: "sb_secret_x",
          Authorization: "Bearer sb_secret_x",
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
        },
        body: new Uint8Array([1]),
      },
    );
  });

  it("fails with the status and the answer when the upload is refused", async () => {
    const storage = targetStorage({
      supabaseUrl: "http://127.0.0.1:57321",
      secretKey: "k",
      fetch: respond(new Response('{"message":"Invalid key"}', { status: 400 })),
    });

    await expect(
      storage.upload({
        bucket: "step-photos",
        path: "b1/s/x.jpg",
        bytes: new Uint8Array([1]),
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow('Upload of step-photos/b1/s/x.jpg failed (400): {"message":"Invalid key"}');
  });

  it("gives the public URL the app stores for a photo", () => {
    const storage = targetStorage({ supabaseUrl: "https://t.supabase.co", secretKey: "k" });

    expect(storage.publicUrl("step-photos", "b1/s/1_a.jpg")).toBe(
      "https://t.supabase.co/storage/v1/object/public/step-photos/b1/s/1_a.jpg",
    );
  });
});

describe("fetchSecretKey", () => {
  const keysResponse = (keys: unknown) =>
    respond(new Response(JSON.stringify(keys), { status: 200 }));

  it("reads the project's secret key through the Management API", async () => {
    const fetchFn = keysResponse([
      { name: "anon", type: "legacy", api_key: "eyJ.anon" },
      { name: "service_role", type: "legacy", api_key: "eyJ.service" },
      { name: "default", type: "publishable", api_key: "sb_publishable_x" },
      { name: "default", type: "secret", api_key: "sb_secret_x" },
    ]);

    await expect(
      fetchSecretKey({ accessToken: "sbp_t", projectRef: "abcdref", fetch: fetchFn }),
    ).resolves.toBe("sb_secret_x");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.supabase.com/v1/projects/abcdref/api-keys?reveal=true",
      { headers: { Authorization: "Bearer sbp_t" } },
    );
  });

  it("falls back to the legacy service role key", async () => {
    const fetchFn = keysResponse([
      { name: "anon", type: "legacy", api_key: "eyJ.anon" },
      { name: "service_role", type: "legacy", api_key: "eyJ.service" },
    ]);

    await expect(
      fetchSecretKey({ accessToken: "t", projectRef: "r", fetch: fetchFn }),
    ).resolves.toBe("eyJ.service");
  });

  it("skips entries that are not keys", async () => {
    const fetchFn = keysResponse([null, "odd", 3, { type: "secret", api_key: "sb_secret_y" }]);

    await expect(
      fetchSecretKey({ accessToken: "t", projectRef: "r", fetch: fetchFn }),
    ).resolves.toBe("sb_secret_y");
  });

  it("fails when the project has no secret key", async () => {
    await expect(
      fetchSecretKey({
        accessToken: "t",
        projectRef: "r",
        fetch: keysResponse([{ name: "anon" }]),
      }),
    ).rejects.toThrow("Project r has no secret or service role key");
  });

  it("fails when the answer is not a list of keys", async () => {
    await expect(
      fetchSecretKey({ accessToken: "t", projectRef: "r", fetch: keysResponse({ odd: true }) }),
    ).rejects.toThrow("Project r has no secret or service role key");
  });

  it("fails with the status when the keys cannot be read", async () => {
    await expect(
      fetchSecretKey({
        accessToken: "t",
        projectRef: "r",
        fetch: respond(new Response("Unauthorized", { status: 401 })),
      }),
    ).rejects.toThrow("Reading the API keys of r failed (401): Unauthorized");
  });
});
