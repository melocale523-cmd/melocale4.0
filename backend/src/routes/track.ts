import { Router, Request, Response } from "express";
import { z } from "zod";
import { sendMetaEvent } from "../lib/metaPixel.js";
import { sensitiveLimiter } from "../config.js";
import { sendNewUserAlert } from "../jobs/newUserAlert.js";

const router = Router();

const registrationSchema = z.object({
  role: z.enum(["client", "professional"]),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
});

// POST /api/track/registration
// Called by the frontend after Supabase Auth signup + profile creation completes.
router.post("/track/registration", sensitiveLimiter, async (req: Request, res: Response) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos." });

  const { role, email, phone, name, city, state, origin, fbp, fbc } = parsed.data;
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
    customData: { content_name: role },
  });

  void sendNewUserAlert({
    full_name: name,
    email,
    role,
    city,
    origin,
    phone,
  });

  return res.json({ ok: true });
});

export default router;
