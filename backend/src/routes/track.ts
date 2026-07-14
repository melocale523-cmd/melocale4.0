import { Router, Request, Response } from "express";
import { z } from "zod";
import { sendMetaEvent } from "../lib/metaPixel.js";
import { sensitiveLimiter, supabaseAdmin } from "../config.js";
import { sendNewUserAlert } from "../jobs/newUserAlert.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { seoAttributionFromRecord, trackSeoConversionEvent } from "../lib/seoConversionTracking.js";
import { withTimeout } from "../lib/timeout.js";

const router = Router();

const seoAttributionSchema = {
  landing_path: z.string().max(500).optional(),
  service_slug: z.string().max(180).optional(),
  service_category: z.string().max(160).optional(),
  service_city: z.string().max(160).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
};

const registrationSchema = z.object({
  role: z.enum(["client", "professional"]),
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  origin: z.string().optional(),
  ...seoAttributionSchema,
  fbp: z.string().optional(),
  fbc: z.string().optional(),
});

const pageViewSchema = z.object({
  event_type: z.literal("page_view"),
  ...seoAttributionSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const leadPurchaseSchema = z.object({
  event_type: z.literal("lead_purchased"),
  lead_id: z.string().uuid().optional(),
  lead_purchase_id: z.string().uuid(),
  ...seoAttributionSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

router.post("/track/registration", sensitiveLimiter, async (req: Request, res: Response) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados invalidos." });

  const {
    role, user_id, email, phone, name, city, state, origin,
    utm_source, utm_medium, utm_campaign, utm_content, landing_path,
    service_slug, service_category, service_city, fbp, fbc,
  } = parsed.data;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.socket.remoteAddress
    ?? undefined;
  const clientUserAgent = req.headers['user-agent'] ?? undefined;

  void sendMetaEvent({
    eventName: "CompleteRegistration",
    eventSourceUrl: "https://www.melocale.com.br/cadastro",
    userEmail: email,
    userPhone: phone,
    userName: name,
    userCity: city,
    userState: state,
    fbp,
    fbc,
    clientIp,
    clientUserAgent,
    customData: { content_name: role, origin, utm_source, utm_medium, utm_campaign, utm_content, landing_path, service_slug, service_category, service_city },
  });

  void sendNewUserAlert({
    full_name: name,
    email,
    role,
    city,
    origin,
    phone,
  });

  void trackSeoConversionEvent({
    event_type: "signup",
    user_id,
    role,
    landing_path,
    service_slug,
    service_category,
    service_city,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    metadata: { origin, city, state },
  });

  return res.json({ ok: true });
});

router.post("/track/seo-event", sensitiveLimiter, async (req: Request, res: Response) => {
  const parsed = pageViewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados invalidos." });

  const { event_type, metadata, ...attribution } = parsed.data;
  void trackSeoConversionEvent({
    event_type,
    ...attribution,
    metadata: {
      ...(metadata ?? {}),
      source: "public_page_view",
    },
  });

  return res.json({ ok: true });
});

router.post("/track/seo-conversion", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = leadPurchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados invalidos." });

  const userId = req.authUser!.id;
  const { lead_purchase_id, lead_id, metadata, ...body } = parsed.data;

  const { data: purchase, error } = await withTimeout(
    supabaseAdmin
      .from("lead_purchases")
      .select("id, lead_id, user_id, price_coins, price")
      .eq("id", lead_purchase_id)
      .maybeSingle(),
    8000
  );

  if (error) {
    console.error("[seo] falha ao validar compra de lead:", error.message);
    return res.status(500).json({ error: "Erro ao validar compra." });
  }
  if (!purchase || purchase.user_id !== userId) {
    return res.status(404).json({ error: "Compra nao encontrada." });
  }

  const attribution = seoAttributionFromRecord({ ...body, ...(metadata ?? {}) });
  void trackSeoConversionEvent({
    event_type: "lead_purchased",
    user_id: userId,
    lead_id: (purchase.lead_id as string | null) ?? lead_id,
    lead_purchase_id,
    price_coins: typeof purchase.price_coins === "number" ? purchase.price_coins : null,
    revenue_brl: typeof purchase.price === "number" ? purchase.price : null,
    ...attribution,
    metadata: {
      ...(metadata ?? {}),
      source: "lead_purchase_rpc",
    },
  });

  return res.json({ ok: true });
});

export default router;
