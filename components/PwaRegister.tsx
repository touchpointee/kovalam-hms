"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production so the app can be installed as a PWA
 * (Edge/Chrome “Install this site as an app” on Windows).
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
