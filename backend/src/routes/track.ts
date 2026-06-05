import { Router, Request, Response } from "express";
import { z } from "zod";
import { sendMetaEvent } from "../lib/metaPixel.js";

const router = Router();

const registrationSchema = z.object({
  role: z.enum(["client", "professional"]),
  email: z.string().email().optional(),
});

// POST /api/track/registration
// Called by the frontend after Supabase Auth signup + profile creation completes.
router.post("/track/registration", async (req: Request, res: Response) => {
  console.log('[track] registration chamado:', req.body);
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "dados inválidos." });

  const { role, email } = parsed.data;

  void sendMetaEvent({
    eventName: "CompleteRegistration",
    eventSourceUrl: "https://www.melocale.com.br/cadastro",
    userEmail: email,
    customData: { content_name: role },
  });

  return res.json({ ok: true });
});

export default router;
