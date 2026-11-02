import "server-only";
import { toGuitarType } from "@gb/db";
import { createClient } from "@/lib/supabase/server";
import type { BuildDetailData, BuildSummary } from "./types";
import { isUuid } from "./validation";

/**
 * The signed-in user's own builds, newest first. The owner filter is explicit:
 * administrators may read every build, but their list shows only their own
 * (guitar-builds: Administrator Access to Builds). Returns null when the query fails.
 */
export async function listOwnBuilds(userId: string): Promise<BuildSummary[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("builds")
    .select("id, name, guitar_type, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    guitarType: toGuitarType(row.guitar_type),
    createdAt: row.created_at,
  }));
}

/** One build the user may read, or null when it does not exist or is not readable. */
export async function getBuild(id: string): Promise<BuildDetailData | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("builds")
    .select("id, owner_id, name, guitar_type, bobo_neck, created_at, updated_at, sequence_state")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    guitarType: toGuitarType(data.guitar_type),
    boboNeck: data.bobo_neck,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    sequenceState: data.sequence_state,
  };
}
