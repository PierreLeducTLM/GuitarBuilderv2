import { createClient } from "@/lib/supabase/client";

/** The outcome of a sharing request: the current token (null when not shared), or a failure. */
export type ShareResult = { ok: true; token: string | null } | { ok: false };

type RpcAnswer = { data: string | null; error: unknown };

async function settle(request: PromiseLike<RpcAnswer>): Promise<ShareResult> {
  try {
    const { data, error } = await request;
    if (error) return { ok: false };
    return { ok: true, token: data ?? null };
  } catch {
    return { ok: false };
  }
}

/** The link token of one of the user's builds (build-story-sharing: Share State Consistency). */
export function readShareToken(buildId: string): Promise<ShareResult> {
  return settle(createClient().rpc("build_share_token", { p_build_id: buildId }));
}

/** Turns sharing of one of the user's builds on or off (Enable Sharing, Disable Sharing). */
export function setSharing(buildId: string, enabled: boolean): Promise<ShareResult> {
  return settle(
    createClient().rpc("set_build_sharing", { p_build_id: buildId, p_enabled: enabled }),
  );
}
