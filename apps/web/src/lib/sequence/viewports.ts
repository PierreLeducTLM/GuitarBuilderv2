// The removed pan-and-zoom diagram remembered a viewport per build in localStorage
// (build-sequence: Diagram Viewport Persistence, removed). Those entries are dropped
// once, so they don't linger in the browser.
const PREFIX = "gb-viewport:";

export function forgetDiagramViewports(getStorage: () => Storage): void {
  try {
    const storage = getStorage();
    const stale = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => key?.startsWith(PREFIX) ?? false,
    );
    for (const key of stale) storage.removeItem(key);
  } catch {
    // Storage blocked: there is nothing this page can clean.
  }
}
