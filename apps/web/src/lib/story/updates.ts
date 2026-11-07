// When a story asks about, restores and announces updates (build-story-sharing: Story
// Update Prompt, Story Notification Switch, Story Update Notifications).

/** Whether a visitor wants this story's updates, remembered per link and browser. */
export type UpdatesPreference = "on" | "off";

const PREFIX = "gb-story-updates:";

/** A notification is due only when the timeline gains steps, never for an edit. */
export function shouldNotify(previousCount: number, nextCount: number): boolean {
  return nextCount > previousCount;
}

export interface PromptInput {
  /** Whether this browser can show the story's notifications. */
  supported: boolean;
  permission: NotificationPermission | null;
  stored: UpdatesPreference | null;
}

/** "Get Build Updates?" is asked of visitors who have not decided yet, in any way. */
export function shouldPrompt({ supported, permission, stored }: PromptInput): boolean {
  return supported && permission === "default" && stored === null;
}

/** A remembered "on" comes back only while the browser still grants notifications. */
export function restoresUpdates({
  stored,
  permission,
}: Pick<PromptInput, "stored" | "permission">): boolean {
  return stored === "on" && permission === "granted";
}

export function readUpdatesPreference(
  getStorage: () => Storage,
  token: string,
): UpdatesPreference | null {
  try {
    const value = getStorage().getItem(`${PREFIX}${token}`);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function writeUpdatesPreference(
  getStorage: () => Storage,
  token: string,
  value: UpdatesPreference,
): void {
  try {
    getStorage().setItem(`${PREFIX}${token}`, value);
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }
}
