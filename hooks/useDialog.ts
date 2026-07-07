"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type DialogOptions = {
  /** Whether the dialog is currently open. Drives all wiring on/off. */
  isOpen: boolean;
  /** Called on Escape (and reused by callers for overlay clicks). */
  onDismiss: () => void;
  /** While true, Escape is ignored so a running action can't be interrupted. */
  isPending?: boolean;
};

/**
 * Accessibility wiring shared by every admin modal/drawer (TASKS 5.7):
 * - moves focus into the dialog on open (first focusable element, else the
 *   container itself),
 * - traps Tab / Shift+Tab focus inside it,
 * - closes on Escape (unless an action is pending),
 * - locks body scroll while open,
 * - restores focus to the triggering element when it closes.
 *
 * Attach the returned ref to the element carrying `role="dialog"` /
 * `role="alertdialog"`, and give that element `tabIndex={-1}` so it can hold
 * focus when it has no focusable children yet.
 *
 * The dialog *display* is still owned by the caller (conditional mount, or an
 * `isOpen`-driven transform for the drawer) — this only manages focus, keys and
 * scroll. `onDismiss` / `isPending` are read through refs so changing them never
 * re-runs the open/close effect.
 */
export function useDialog<T extends HTMLElement>({
  isOpen,
  onDismiss,
  isPending = false,
}: DialogOptions): RefObject<T | null> {
  const ref = useRef<T>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const isPendingRef = useRef(isPending);
  isPendingRef.current = isPending;

  useEffect(() => {
    if (!isOpen) return;
    const dialog = ref.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Scroll lock — restore the prior inline value, not a hardcoded default, so
    // nested/stacked dialogs unwind correctly.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = (): HTMLElement[] =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Move focus in (first focusable, else the container).
    (focusable()[0] ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isPendingRef.current) {
          e.stopPropagation();
          onDismissRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return ref;
}
