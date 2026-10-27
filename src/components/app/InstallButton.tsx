"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * One-tap install where the browser supports it (Chrome and Edge on Android
 * and desktop). Elsewhere it renders nothing and the written steps apply.
 */
const standalone = "(display-mode: standalone)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(standalone);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setInstalled] = useState(false);
  // Already running as the installed app (not known on the server).
  const runningAsApp = useSyncExternalStore(subscribe, () => window.matchMedia(standalone).matches, () => false);
  const installed = justInstalled || runningAsApp;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
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
  if (!prompt) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setPrompt(null);
      }}
      className="inline-flex h-13 items-center gap-2 rounded-xl bg-white px-6 font-bold text-ink transition hover:bg-navy-100"
    >
      <Icon name="plus" className="size-5" />
      Install the app
    </button>
  );
}
