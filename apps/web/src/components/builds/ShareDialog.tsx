"use client";

import { Button, buttonClasses, DialogFrame, Switch, TextField, useToast } from "@gb/ui";
import { Check, Copy, ExternalLink, Link2Off } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { readShareToken, setSharing } from "@/lib/builds/sharing";

const COPIED_MS = 2000;

export interface ShareDialogProps {
  buildId: string;
  buildName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShareState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; token: string | null };

/**
 * build-story-sharing: Share Dialog, Enable Sharing, Share Link Actions, Disable Sharing.
 * Each opening reads the stored state again (Share State Consistency), and opening never
 * shares the build by itself.
 */
export function ShareDialog(props: ShareDialogProps) {
  return props.open ? <OpenShareDialog {...props} /> : null;
}

function OpenShareDialog({ buildId, buildName, onOpenChange }: ShareDialogProps) {
  const t = useTranslations("builds.share");
  const tDialog = useTranslations("dialog");
  const toast = useToast();
  const [state, setState] = useState<ShareState>({ status: "loading" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    readShareToken(buildId).then((result) =>
      setState(result.ok ? { status: "ready", token: result.token } : { status: "failed" }),
    );
  }, [buildId]);

  async function changeSharing(enabled: boolean) {
    setPending(true);
    const result = await setSharing(buildId, enabled);
    setPending(false);
    if (!result.ok) {
      toast.show({ type: "error", message: t(enabled ? "enableFailed" : "disableFailed") });
      return;
    }
    setState({ status: "ready", token: result.token });
  }

  const link =
    state.status === "ready" && state.token !== null
      ? `${window.location.origin}/story/${state.token}`
      : null;

  return (
    <DialogFrame
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={buildName}
      closeLabel={tDialog("close")}
      footer={<Button onClick={() => onOpenChange(false)}>{t("done")}</Button>}
    >
      <div className="flex flex-col gap-5">
        <Switch
          label={t("publicAccess")}
          description={t(link ? "statusOn" : "statusOff")}
          checked={link !== null}
          disabled={state.status !== "ready" || pending}
          onCheckedChange={changeSharing}
        />
        {state.status === "failed" ? (
          <p className="text-sm text-danger-ink">{t("loadFailed")}</p>
        ) : null}
        {state.status === "ready" && link === null ? (
          <div className="flex items-start gap-3 rounded-xl border border-line bg-inset p-4">
            <Link2Off aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-dim" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-fg">{t("disabledTitle")}</p>
              <p className="text-sm text-fg-dim">{t("disabledHint")}</p>
            </div>
          </div>
        ) : null}
        {link ? <ShareLink link={link} /> : null}
      </div>
    </DialogFrame>
  );
}

function ShareLink({ link }: { link: string }) {
  const t = useTranslations("builds.share");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <TextField
          label={t("link")}
          value={link}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          fieldClassName="min-w-0 flex-1"
          className="font-mono"
        />
        <CopyButton text={link} />
      </div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "secondary", fullWidth: true })}
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        {t("preview")}
      </a>
      <p className="text-sm text-fg-dim">{t("tip")}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("builds.share");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <Button variant="secondary" onClick={copy}>
      {copied ? (
        <Check aria-hidden="true" className="size-4 text-teal-ink" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      {t(copied ? "copied" : "copy")}
    </Button>
  );
}
