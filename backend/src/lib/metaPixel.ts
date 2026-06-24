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
  userName?: string;
  userCity?: string;
  userState?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  clientUserAgent?: string;
  customData?: Record<string, unknown>;
}

export async function sendMetaEvent(data: MetaEventData): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const userData: Record<string, string> = {};
  if (data.userEmail)       userData.em                = hashSHA256(data.userEmail);
  if (data.userPhone)       userData.ph                = hashSHA256(data.userPhone);
  if (data.userName)        userData.fn                = hashSHA256(data.userName);
  if (data.userCity)        userData.ct                = hashSHA256(data.userCity);
  if (data.userState)       userData.st                = hashSHA256(data.userState);
  if (data.fbp)             userData.fbp               = data.fbp;
  if (data.fbc)             userData.fbc               = data.fbc;
  if (data.clientIp)        userData.client_ip_address = data.clientIp;
  if (data.clientUserAgent) userData.client_user_agent = data.clientUserAgent;

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
