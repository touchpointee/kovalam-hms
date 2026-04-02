import webpush from "web-push";
import PushSubscription from "@/models/PushSubscription";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@hospital.local",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function sendPushNotificationToLaboratory(payload: {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  labBillId?: string;
}) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured; skipping push notification send.");
    return;
  }

  const subscriptions = await PushSubscription.find({ role: "laboratory" }).lean();
  if (subscriptions.length === 0) return;

  const notificationPayload = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          row.subscription as webpush.PushSubscription,
          notificationPayload
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.findByIdAndDelete(row._id);
          return;
        }
        console.error("Push notification error:", err);
      }
    })
  );
}
