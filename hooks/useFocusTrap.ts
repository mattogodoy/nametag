'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into `containerRef` while `active`, keeps Tab and Shift+Tab
 * cycling inside it, and hands focus back to whatever had it before once
 * `active` turns false or the component unmounts.
 *
 * For anything rendered with `aria-modal="true"`: that attribute tells
 * assistive technology the rest of the page is inert, so focus has to
 * actually be inside the dialog, not left on the button that opened it.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }

      const current = document.activeElement;
      // Focus that has escaped the container (a click on the page behind,
      // for one) is pulled back in rather than left to wander.
      if (!(current instanceof Node) || !container.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    focusable()[0]?.focus();

    return () => {
      document.removeEventListener('keydown', handleTab);
      // Only if the opener is still in the document; focusing a detached
      // node does nothing useful and can throw in some browsers.
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, active]);
}
