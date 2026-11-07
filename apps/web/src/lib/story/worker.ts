// The story page's service worker, public/story/sw.js (build-story-sharing: Story Update
// Notifications, design decision 7).

export const STORY_WORKER_URL = "/story/sw.js";
export const STORY_WORKER_SCOPE = "/story/";

/** The parts of a browser that story notifications need. */
export interface NotificationHost {
  Notification?: unknown;
  navigator: { serviceWorker?: unknown };
}

/** Story notifications need page notifications and service workers (unlike iOS Safari tabs). */
export function notificationsSupported(host: NotificationHost): boolean {
  return host.Notification !== undefined && host.navigator.serviceWorker !== undefined;
}

export interface WorkerContainer<Registration> {
  register(url: string, options: { scope: string }): Promise<unknown>;
  ready: Promise<Registration>;
}

/** Registers the story worker and resolves once it is active, or with null when it cannot be. */
export async function registerStoryWorker<Registration>(
  container: WorkerContainer<Registration> | undefined,
): Promise<Registration | null> {
  if (!container) return null;
  try {
    await container.register(STORY_WORKER_URL, { scope: STORY_WORKER_SCOPE });
    return await container.ready;
  } catch {
    return null;
  }
}
