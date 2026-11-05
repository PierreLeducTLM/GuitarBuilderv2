"use client";

import { useToast } from "@gb/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type Dispatch, useRef, useState, useTransition } from "react";
import { useConfirm } from "@/components/DialogProvider";
import { createClient } from "@/lib/supabase/client";
import {
  type CalculatorEvent,
  type CalculatorState,
  PANEL_INPUT_COLUMNS,
  panelPayload,
  spectraFromStored,
} from "@/lib/wood/panel";
import type { WoodPanelSummary } from "@/lib/wood/types";

/** Inserts, or updates the loaded panel; an update that matches no row is a failure. */
async function writePanel(state: CalculatorState): Promise<boolean> {
  const supabase = createClient();
  const payload = panelPayload(state);
  const { data, error } = state.loadedId
    ? await supabase.from("wood_panels").update(payload).eq("id", state.loadedId).select("id")
    : await supabase.from("wood_panels").insert(payload).select("id");
  return !error && (data?.length ?? 0) === 1;
}

/**
 * wood-panel-properties: Save a New Panel, Save Outcome, Update a Loaded Panel, Load a
 * Panel, Deselect a Panel, Delete Confirmation and Delete Outcome. Each request is guarded
 * so a double click sends it once.
 */
export function useWoodPanels(state: CalculatorState, dispatch: Dispatch<CalculatorEvent>) {
  const t = useTranslations("wood");
  const tDialog = useTranslations("dialog");
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [copying, setCopying] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function save() {
    if (busy.current) return;
    if (!state.name.trim()) {
      toast.show({ type: "warning", message: t("save.nameRequired") });
      return;
    }
    busy.current = true;
    setSaving(true);
    const saved = await writePanel(state);
    busy.current = false;
    setSaving(false);
    if (!saved) {
      toast.show({ type: "error", message: t("save.failed") });
      return;
    }
    toast.show({ type: "success", message: t(state.loadedId ? "save.updated" : "save.saved") });
    dispatch({ type: "saved" });
    router.refresh();
  }

  async function open(panel: WoodPanelSummary) {
    if (panel.id === state.loadedId) {
      dispatch({ type: "reset" });
      return;
    }
    const { data, error } = await createClient()
      .from("wood_panels")
      .select(`name, ${PANEL_INPUT_COLUMNS}, spectra`)
      .eq("id", panel.id)
      .maybeSingle();
    if (error || !data) {
      toast.show({ type: "error", message: t("library.loadPanelFailed") });
      return;
    }
    dispatch({
      type: "loaded",
      id: panel.id,
      name: data.name,
      panel: data,
      spectra: spectraFromStored(data.spectra),
    });
  }

  async function remove(panel: WoodPanelSummary) {
    const confirmed = await confirm({
      title: t("deleteDialog.title"),
      message: t("deleteDialog.message"),
      confirmLabel: t("deleteDialog.confirm"),
      cancelLabel: tDialog("cancel"),
      variant: "danger",
    });
    if (!confirmed) return;
    const { data, error } = await createClient()
      .from("wood_panels")
      .delete()
      .eq("id", panel.id)
      .select("id");
    if (error || (data?.length ?? 0) !== 1) {
      toast.show({ type: "error", message: t("library.deleteFailed") });
      return;
    }
    toast.show({ type: "success", message: t("library.deleted") });
    dispatch({ type: "deleted", id: panel.id });
    router.refresh();
  }

  /** wood-panel-properties: Load Default Panels and Load Default Panels Feedback. */
  async function loadDefaults() {
    if (busy.current) return;
    busy.current = true;
    setCopying(true);
    const { data, error } = await createClient().rpc("load_default_wood_panels");
    busy.current = false;
    setCopying(false);
    if (error) {
      toast.show({ type: "error", message: t("library.loadDefaultsFailed") });
      return;
    }
    if (data === 0) {
      toast.show({ type: "info", message: t("library.noDefaults") });
      return;
    }
    startRefresh(() => router.refresh());
  }

  return { save, open, remove, loadDefaults, saving, loadingDefaults: copying || refreshing };
}
