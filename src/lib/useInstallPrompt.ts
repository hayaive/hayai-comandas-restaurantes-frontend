import { useCallback, useEffect, useState } from "react";

/** The event Chromium fires when the page is eligible for installation. Not in lib.dom.d.ts. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/**
 * Captures the browser's `beforeinstallprompt` event so the app can trigger
 * the native "Install app" flow from its own UI, instead of depending on the
 * browser to surface it unprompted — Chrome/Android does not always show it
 * on its own.
 *
 * `canInstall` is false both before the browser decides the app is
 * installable and once it is already installed (standalone display mode, or
 * `navigator.standalone` on iOS). iOS Safari never fires `beforeinstallprompt`
 * at all, so there `canInstall` simply stays false — no manual "Add to Home
 * Screen" walkthrough is implemented here, that's out of scope.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setDeferredPrompt(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // Whatever the outcome, this prompt instance is spent — Chromium never
    // lets it be reused, and it fires a fresh `beforeinstallprompt` later if
    // the app is still uninstalled.
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null && !installed,
    promptInstall,
  };
}
