"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Saved by the inline script in the root layout, which runs before React loads. */
    __installPrompt?: InstallPromptEvent | null;
  }
}

const standalone = "(display-mode: standalone)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(standalone);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Install steps for browsers that can't install with one tap. */
function manualSteps(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "On iPhone: open this page in Safari, tap the Share button (the square with an arrow), then “Add to Home Screen” and “Add”.";
  }
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua)) {
    return "You've opened this page inside another app. Open it in Chrome (menu, then “Open in browser”), then tap Install again.";
  }
  if (/Android/i.test(ua)) {
    return "In Chrome: tap the menu (three dots, top right), then “Install app” or “Add to Home screen”.";
  }
  return "Open your browser's menu and choose “Install app” or “Add to Home screen”. On a phone it's quickest from Chrome (Android) or Safari (iPhone).";
}

/**
 * Always shows an Install button. Where the browser allows (Chrome and Edge on
 * Android and desktop) it installs in one tap; elsewhere it shows the steps.
 */
export function InstallButton({ tone = "onDark" }: { tone?: "onDark" | "onLight" }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setInstalled] = useState(false);
  const [steps, setSteps] = useState<string | null>(null);
  // Already running as the installed app (not known on the server).
  const runningAsApp = useSyncExternalStore(subscribe, () => window.matchMedia(standalone).matches, () => false);
  const installed = justInstalled || runningAsApp;

  useEffect(() => {
    const take = () => {
      if (window.__installPrompt) setPrompt(window.__installPrompt);
    };
    const onInstalled = () => setInstalled(true);
    take();
    window.addEventListener("installpromptready", take);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("installpromptready", take);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 font-semibold text-success" role="status">
        <Icon name="check" className="size-5" />
        The app is installed on this device.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={async () => {
          if (!prompt) {
            setSteps(manualSteps());
            return;
          }
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
          // The browser's offer can only be used once.
          window.__installPrompt = null;
          setPrompt(null);
        }}
        aria-expanded={prompt ? undefined : steps !== null}
        className={`inline-flex h-13 items-center gap-2 rounded-xl px-6 font-bold transition ${
          tone === "onDark" ? "bg-white text-ink hover:bg-navy-100" : "bg-ink text-white hover:bg-night-3"
        }`}
      >
        <Icon name="plus" className="size-5" />
        Install the app
      </button>
      {steps && (
        <p role="status" className={`max-w-md text-sm leading-relaxed ${tone === "onDark" ? "text-white/80" : "text-ink-soft"}`}>
          {steps}
        </p>
      )}
    </div>
  );
}
