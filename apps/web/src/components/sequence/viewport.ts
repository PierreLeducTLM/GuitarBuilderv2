// The last diagram viewport, remembered per build in this browser (build-sequence:
// Diagram Viewport Persistence). Storage can be unavailable or hold anything, so every
// access is guarded and invalid values read as "nothing remembered".
import type { Viewport } from "@xyflow/react";

const PREFIX = "gb-viewport:";

export function loadViewport(buildId: string): Viewport | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + buildId);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Viewport>;
    const { x, y, zoom } = value;
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof zoom === "number" &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      zoom > 0
    ) {
      return { x, y, zoom };
    }
  } catch {
    // Unavailable or corrupt storage: fit the diagram instead.
  }
  return null;
}

export function saveViewport(buildId: string, viewport: Viewport): void {
  try {
    window.localStorage.setItem(PREFIX + buildId, JSON.stringify(viewport));
  } catch {
    // Storage full or blocked: the viewport is simply not remembered.
  }
}
