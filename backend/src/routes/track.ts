import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { sensitiveLimiter } from "../config.js";
import { sendMetaEvent } from "../lib/metaPixel.js";

const router = Router();

const registrationSchema = z.object({
  role: z.enum(["client", "professional"]),
});

// POST /api/track/registration
// Called by the frontend after Supabase Auth signup + profile creation completes.
router.post("/track/registration", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "role inválido." });

  const { role } = parsed.data;
  const email = req.authUser!.email;

  void sendMetaEvent({
    eventName: "CompleteRegistration",
    eventSourceUrl: "https://www.melocale.com.br/cadastro",
    userEmail: email,
    customData: { content_name: role },
  });

  return res.json({ ok: true });
});

export default router;
