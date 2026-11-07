"use client";

import { Button, DialogFrame, Switch, useToast } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  readUpdatesPreference,
  restoresUpdates,
  shouldPrompt,
  writeUpdatesPreference,
} from "@/lib/story/updates";
import { notificationsSupported } from "@/lib/story/worker";

const PROMPT_DELAY_MS = 2000;

export interface StoryUpdatesProps {
  token: string;
  /** Called whenever updates turn on or off. */
  onChange: (on: boolean) => void;
}

const storage = () => window.localStorage;

/**
 * build-story-sharing: Story Update Prompt and Story Notification Switch. The visitor's
 * choice is remembered for this link in this browser.
 */
export function StoryUpdates({ token, onChange }: StoryUpdatesProps) {
  const t = useTranslations("story.updates");
  const tDialog = useTranslations("dialog");
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const report = useRef(onChange);
  report.current = onChange;

  useEffect(() => {
    const supported = notificationsSupported(window);
    const permission = supported ? Notification.permission : null;
    const stored = readUpdatesPreference(storage, token);
    if (restoresUpdates({ stored, permission })) {
      setOn(true);
      report.current(true);
    }
    if (!shouldPrompt({ supported, permission, stored })) return;
    const timer = setTimeout(() => setPrompting(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [token]);

  function turn(next: boolean) {
    writeUpdatesPreference(storage, token, next ? "on" : "off");
    setOn(next);
    report.current(next);
  }

  async function turnOn() {
    if (!notificationsSupported(window)) {
      toast.show({ type: "info", message: t("unsupported") });
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") turn(true);
    else writeUpdatesPreference(storage, token, "off");
  }

  return (
    <>
      <Switch
        label={t(on ? "on" : "off")}
        checked={on}
        onCheckedChange={(next) => (next ? turnOn() : turn(false))}
        className="rounded-full border border-line bg-panel py-1.5 pr-1.5 pl-4"
      />
      <DialogFrame
        open={prompting}
        onOpenChange={setPrompting}
        title={t("prompt.title")}
        description={t("prompt.message")}
        closeLabel={tDialog("close")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPrompting(false);
                writeUpdatesPreference(storage, token, "off");
              }}
            >
              {t("prompt.decline")}
            </Button>
            <Button
              onClick={() => {
                setPrompting(false);
                return turnOn();
              }}
            >
              {t("prompt.accept")}
            </Button>
          </>
        }
      />
    </>
  );
}
