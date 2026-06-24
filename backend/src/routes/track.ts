import { Router, Request, Response } from "express";
import { z } from "zod";
import { sendMetaEvent } from "../lib/metaPixel.js";
import { sensitiveLimiter } from "../config.js";

const router = Router();

const registrationSchema = z.object({
  role: z.enum(["client", "professional"]),
  email: z.string().email().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
});

// POST /api/track/registration
// Called by the frontend after Supabase Auth signup + profile creation completes.
router.post("/track/registration", sensitiveLimiter, async (req: Request, res: Response) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos." });

  const { role, email, fbp, fbc } = parsed.data;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.socket.remoteAddress
    ?? undefined;
  const clientUserAgent = req.headers['user-agent'] ?? undefined;

  console.log(`[track] registration called — role: ${role}, email: ${email ?? 'N/A'}`);

  void sendMetaEvent({
    eventName: "CompleteRegistration",
    eventSourceUrl: "https://www.melocale.com.br/cadastro",
    userEmail: email,
    fbp,
    fbc,
    clientIp,
    clientUserAgent,
    customData: { content_name: role },
  });

  return res.json({ ok: true });
});

export default router;
