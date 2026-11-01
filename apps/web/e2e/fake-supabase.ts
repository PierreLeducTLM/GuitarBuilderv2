/**
 * Test double for the few Supabase endpoints the app calls, so the end-to-end tests
 * can sign in and exercise the shell without Docker. It is NOT a model of the
 * database rules: those are covered by the pgTAP suite (supabase/tests/database).
 *
 * Auth:  POST /auth/v1/token?grant_type=password|refresh_token, POST /auth/v1/signup,
 *        GET /auth/v1/user, POST /auth/v1/logout
 * REST:  GET /rest/v1/profiles?id=eq.<uuid>
 * Test control: POST /__test/reset, POST /__test/users, POST /__test/config
 *
 * Run: node e2e/fake-supabase.ts [port]   (Node >= 22.18 strips the types)
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

interface User {
  id: string;
  email: string;
  password: string;
  role: "user" | "admin";
  confirmed: boolean;
  createdAt: string;
}

interface Config {
  /** Answer sign-out with a server error (app-shell: sign-out failure). */
  failLogout: boolean;
  /** Answer sign-in with 503, which supabase-js treats as a network failure. */
  failSignIn: boolean;
  /** Sign-ups need email verification (no session until confirmed). */
  requireConfirmation: boolean;
  /** Delay before answering sign-in, to observe the pending state. */
  signInDelayMs: number;
}

const users = new Map<string, User>();
const accessTokens = new Map<string, string>();
const refreshTokens = new Map<string, string>();
const defaults: Config = {
  failLogout: false,
  failSignIn: false,
  requireConfirmation: false,
  signInDelayMs: 0,
};
let config: Config = { ...defaults };

function reset() {
  users.clear();
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

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function send(response: ServerResponse, status: number, data?: unknown) {
  response.statusCode = status;
  if (data === undefined) return response.end();
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(data));
}

function authError(response: ServerResponse, status: number, code: string, message: string) {
  send(response, status, { code: status, error_code: code, msg: message });
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
