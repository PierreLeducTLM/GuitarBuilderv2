"use client";

import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cx } from "../cx.ts";

/** Dropdown menu (Radix): closes on outside click, Escape, or choosing an item. */
export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;

export function MenuContent({
  className,
  sideOffset = 8,
  align = "end",
  ...rest
}: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cx(
          "z-50 min-w-48 animate-fade-in rounded-2xl border border-line bg-panel p-1.5 shadow-panel",
          className,
        )}
        {...rest}
      />
    </RadixMenu.Portal>
  );
}

export function MenuItem({ className, ...rest }: ComponentProps<typeof RadixMenu.Item>) {
  return (
    <RadixMenu.Item
      className={cx(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-[0.9375rem] font-semibold text-fg outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55 data-[highlighted]:bg-raised",
        className,
      )}
      {...rest}
    />
  );
}
