import { Router, Request, Response } from "express";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin, sensitiveLimiter } from "../config.js";

const router = Router();

const supportTicketSchema = z.object({
  email: z.string().email().optional(),
  conversation: z.string().min(1),
});

router.post("/support-ticket", sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
  const parsed = supportTicketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
  try {
    const { email, conversation } = parsed.data;
    const user_id = (req as AuthRequest).authUser!.id;
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ user_id, email: email || null, conversation, status: "open" })
      .select("id")
      .single();
    if (error) throw error;
    return res.json({ ticket_id: data.id });
  } catch (err: unknown) {
    console.error("Erro em /api/support-ticket:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno do servidor. Tente novamente." });
  }
});

export default router;
