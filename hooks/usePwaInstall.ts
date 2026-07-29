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
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function usePwaInstall(): PwaInstallState {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // Detected in an effect rather than during render so server and client
  // markup match on the first pass.
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
    await installEvent.prompt();
    // The event can only be used once.
    setInstallEvent(null);
  }, [installEvent]);

  return {
    isStandalone,
    canPrompt: installEvent !== null,
    isIos,
    promptInstall,
  };
}
