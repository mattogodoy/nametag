'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * `beforeinstallprompt` is not in TypeScript's DOM lib, so describe the shape
 * we rely on rather than reaching for `any`.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaInstallState {
  /** Running as an installed app already. */
  isStandalone: boolean;
  /** The browser offered an install prompt we can trigger. */
  canPrompt: boolean;
  /** iOS Safari, which has no install API and needs manual instructions. */
  isIos: boolean;
  promptInstall: () => Promise<void>;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // jsdom has no matchMedia, and older iOS exposes navigator.standalone only.
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

function detectIos(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) {
    return true;
  }
  /*
   * iPadOS 13 and later send a desktop macOS user agent by default, so the regex
   * above misses every modern iPad. A Mac has no touchscreen, so touch points
   * separate them. Deliberately does NOT match macOS Safari: its install flow is
   * File then Add to Dock, not the iOS Share sheet, so it is served by the
   * generic copy instead.
   */
  return /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
}

export function usePwaInstall(): PwaInstallState {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  /*
   * Detected in an effect rather than during render so server and client markup
   * agree on the first pass. Reading these during render would have the server
   * (no window) disagree with the client and produce a hydration mismatch, so a
   * lazy useState initialiser is not an option here.
   *
   * eslint-plugin-react-hooks 7 flags setState in an effect as an error. The
   * suppression matches the existing convention in this codebase, for example
   * components/map/MapView.tsx and components/TypeComboBox.tsx.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting a one-time platform capability check into UI state is intentional
    setIsStandalone(detectStandalone());
    setIsIos(detectIos());
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Suppress Chrome's own mini-infobar so our affordance is the only one.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstallEvent(null);
      setIsStandalone(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) {
      return;
    }
    /*
     * Cleared BEFORE awaiting, not after. The captured event is single-use, so a
     * second click arriving while prompt() is still pending would invoke it
     * twice, which is browser-defined behaviour. Clearing first also removes the
     * button, so the race cannot be triggered from the UI at all.
     */
    setInstallEvent(null);
    try {
      await installEvent.prompt();
    } catch {
      /*
       * Browsers can reject this, for example when the install UI is dismissed
       * abnormally. Caught here rather than at the call sites so callers can
       * safely fire and forget: there is nothing useful to tell the user, and
       * the event is spent either way.
       */
    }
  }, [installEvent]);

  return {
    isStandalone,
    canPrompt: installEvent !== null,
    isIos,
    promptInstall,
  };
}
