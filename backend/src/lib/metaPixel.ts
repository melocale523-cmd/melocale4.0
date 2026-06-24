import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID!;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!;
const API_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function hashSHA256(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

interface MetaEventData {
  eventName: string;
  eventSourceUrl: string;
  userEmail?: string;
  userPhone?: string;
  customData?: Record<string, unknown>;
}

export async function sendMetaEvent(data: MetaEventData): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const userData: Record<string, string> = {};
  if (data.userEmail) userData.em = hashSHA256(data.userEmail);
  if (data.userPhone) userData.ph = hashSHA256(data.userPhone);

  const payload = {
    data: [
      {
        event_name: data.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: data.eventSourceUrl,
        action_source: 'website',
        user_data: userData,
        custom_data: data.customData ?? {},
      },
    ],
  };

  try {
    await fetch(`${API_URL}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[metaPixel] sendMetaEvent error:', err instanceof Error ? err.message : String(err));
  }
}
