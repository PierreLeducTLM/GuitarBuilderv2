"use client";

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@gb/ui";
import { ChevronDown, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSignOut } from "./useSignOut";

/** app-shell: Desktop User Menu. Outside clicks close the dropdown without signing out. */
export function UserMenu({ email }: { email: string }) {
  const t = useTranslations("shell");
  const { signOut, pending } = useSignOut();
  return (
    <Menu>
      <MenuTrigger className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-panel py-1 pr-2.5 pl-3 text-left transition-colors duration-150 hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[state=open]:bg-raised">
        <span className="flex min-w-0 flex-col">
          <span className="text-2xs text-fg-dim">{t("signedInAs")}</span>
          <span className="max-w-56 truncate text-sm font-semibold text-fg">{email}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-fg-dim" />
      </MenuTrigger>
      <MenuContent>
        <MenuItem disabled={pending} onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" className="size-4 text-fg-dim" />
          {t("signOut")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
