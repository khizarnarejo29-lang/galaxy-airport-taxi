"use client";

import { useEffect } from "react";

/** Registers the offline-page service worker in production. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* the site works the same without it */
    });
  }, []);
  return null;
}
