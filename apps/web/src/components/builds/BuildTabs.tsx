"use client";

import { cx } from "@gb/ui";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

export interface BuildTab<T extends string> {
  value: T;
  label: string;
}

export interface BuildTabsProps<T extends string> {
  label: string;
  tabs: readonly BuildTab<T>[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}

/** Tabs with the ARIA tabs pattern: arrow keys, Home and End move between tabs. */
export function BuildTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  children,
}: BuildTabsProps<T>) {
  const id = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.value === value);
    const moves: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = tabs[target] as BuildTab<T>;
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-line"
      >
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(element) => {
                if (element) refs.current.set(tab.value, element);
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={cx(
                "-mb-px min-h-11 border-b-2 px-4 text-[0.9375rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                selected
                  ? "border-amber font-semibold text-fg"
                  : "border-transparent text-fg-dim hover:text-fg",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value}`}>
        {children}
      </div>
    </div>
  );
}
