"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { urlBase64ToUint8Array } from "@/lib/notifications";

type LatestLabBillResponse = {
  latestLabBillId: string | null;
  createdAt: string | null;
  patientName?: string | null;
  receiptNo?: string | null;
};

type PushPayload = {
  title?: string;
  body?: string;
  labBillId?: string;
  receiptNo?: string;
  patientName?: string;
};

type LabNotificationSettings = {
  soundEnabled: boolean;
  soundUrl?: string;
};

async function showLabPopupNotification(title: string, body: string, onClickUrl: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: "/hospital-logo.png",
          badge: "/hospital-logo.png",
          tag: `lab-bill-foreground-${Date.now()}`,
          requireInteraction: true,
          data: { url: onClickUrl },
        });
        return;
      }
    }
  } catch (error) {
    console.warn("Service worker popup notification failed, falling back to window notification:", error);
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: "/hospital-logo.png",
      tag: `lab-bill-foreground-${Date.now()}`,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = onClickUrl;
      notification.close();
    };
  } catch (error) {
    console.warn("Window notification failed:", error);
  }
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (sharedAudioContext) return sharedAudioContext;
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  sharedAudioContext = new AudioCtx();
  return sharedAudioContext;
}

async function unlockAudio() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch (error) {
      console.warn("Audio resume failed:", error);
    }
  }
}

async function playNotificationSound(settings: LabNotificationSettings) {
  if (settings.soundEnabled === false) return;

  if (settings.soundUrl?.trim()) {
    try {
      const audio = new Audio(settings.soundUrl.trim());
      await audio.play();
      return;
    } catch (error) {
      console.warn("Configured notification sound failed, falling back to beep:", error);
    }
  }

  try {
    const context = getAudioContext();
    if (!context) return;
    await unlockAudio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  } catch (error) {
    console.warn("Notification sound failed:", error);
  }
}

export function LaboratoryNotifier() {
  const router = useRouter();
  const settingsRef = useRef<LabNotificationSettings>({ soundEnabled: true, soundUrl: "" });

  useEffect(() => {
    const enableAudio = () => {
      unlockAudio().catch(() => {});
    };

    window.addEventListener("pointerdown", enableAudio, { passive: true });
    window.addEventListener("keydown", enableAudio);
    return () => {
      window.removeEventListener("pointerdown", enableAudio);
      window.removeEventListener("keydown", enableAudio);
    };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings/lab-notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<LabNotificationSettings>;
        settingsRef.current = {
          soundEnabled: data.soundEnabled !== false,
          soundUrl: data.soundUrl ?? "",
        };
      } catch (error) {
        console.error("Failed to load lab notification settings:", error);
      }
    };

    loadSettings();
    const interval = window.setInterval(loadSettings, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return;
    }
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing; lab push notifications disabled.");
      return;
    }

    const registerAndSubscribe = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }

        await fetch("/api/laboratory/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription }),
        });
      } catch (error) {
        console.error("Laboratory push registration failed:", error);
      }
    };

    let cleanup: (() => void) | undefined;

    const requestOnInteraction = () => {
      registerAndSubscribe().catch(() => {});
      window.removeEventListener("pointerdown", requestOnInteraction);
      window.removeEventListener("keydown", requestOnInteraction);
    };

    registerAndSubscribe().catch(() => {
      window.addEventListener("pointerdown", requestOnInteraction, { passive: true });
      window.addEventListener("keydown", requestOnInteraction);
      cleanup = () => {
        window.removeEventListener("pointerdown", requestOnInteraction);
        window.removeEventListener("keydown", requestOnInteraction);
      };
    });

    return () => {
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) return;

    const storageKey = "last_seen_lab_bill_id";
    let lastSeenId = localStorage.getItem(storageKey);

    const onServiceWorkerMessage = async (event: MessageEvent<{ type?: string; payload?: PushPayload }>) => {
      if (event.data?.type !== "lab-bill-push") return;
      const pushedId = event.data.payload?.labBillId;
      if (pushedId) {
        lastSeenId = pushedId;
        localStorage.setItem(storageKey, pushedId);
      }
      await playNotificationSound(settingsRef.current);
    };

    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);

    const notifyForLatestBill = async () => {
      try {
        const res = await fetch("/api/laboratory/bills/latest", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as LatestLabBillResponse;
        if (!data.latestLabBillId) return;

        if (!lastSeenId) {
          lastSeenId = data.latestLabBillId;
          localStorage.setItem(storageKey, data.latestLabBillId);
          return;
        }

        if (data.latestLabBillId === lastSeenId) return;

        lastSeenId = data.latestLabBillId;
        localStorage.setItem(storageKey, data.latestLabBillId);

        const title = "New Lab Bill Created";
        const body = data.patientName
          ? `${data.patientName}${data.receiptNo ? ` · Receipt ${data.receiptNo}` : ""}`
          : "A new laboratory bill has been created.";

        await showLabPopupNotification(title, body, "/laboratory/dashboard");

        await playNotificationSound(settingsRef.current);
      } catch (error) {
        console.error("Failed to check latest lab bill:", error);
      }
    };

    notifyForLatestBill();
    const interval = window.setInterval(notifyForLatestBill, 8000);
    const onFocus = () => notifyForLatestBill();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [router]);

  return null;
}
