import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { WoodPanelSummary } from "./types";

/**
 * The signed-in user's own panels, newest first. The owner filter is explicit:
 * administrators may read every panel, but their library shows only their own
 * (wood-panel-properties: Panel Ownership and Access). Returns null when the query fails.
 */
export async function listOwnWoodPanels(userId: string): Promise<WoodPanelSummary[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wood_panels")
    .select("id, name, created_at, target_thickness_mm, estimated_mass_g")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    targetThickness: row.target_thickness_mm,
    estimatedMass: row.estimated_mass_g,
  }));
}
