import webpush from "web-push";
import { supabaseAdmin, vapidPublicKey, vapidPrivateKey, vapidEmail } from "../config.js";

if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);
  console.log("[startup] web-push VAPID configurado");
} else {
  console.warn("[startup] VAPID keys ausentes — web push desativado");
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) return false;
  try {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (!subs?.length) return false;

    const payloadStr = JSON.stringify(payload);
    const results = await Promise.all(
      subs.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr
          );
          return true;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("user_id", userId)
              .eq("endpoint", sub.endpoint);
          } else {
            console.error("[push] sendNotification error:", err instanceof Error ? err.message : String(err));
          }
          return false;
        }
      })
    );
    return results.some(Boolean);
  } catch (err) {
    console.error("[push] sendPushToUser error:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
