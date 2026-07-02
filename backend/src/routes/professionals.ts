import { Router, Response } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config.js";

const router = Router();

router.get("/professionals/coin-percentile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.authUser!.id;

    const { data: myProf } = await supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (!myProf) return res.status(404).json({ error: "Profissional não encontrado." });

    // professional_coins.professional_id armazena profiles.id (auth user_id), não professionals.id —
    // conforme credit_professional_coins(), que grava com p_user_id como chave (ver statsService.ts).
    const { data: myWallet } = await supabaseAdmin
      .from("professional_coins")
      .select("balance")
      .eq("professional_id", userId)
      .single();
    const myBalance = myWallet?.balance ?? 0;

    const { count: totalCount } = await supabaseAdmin
      .from("professional_coins")
      .select("id", { count: "exact", head: true });

    const { count: belowCount } = await supabaseAdmin
      .from("professional_coins")
      .select("id", { count: "exact", head: true })
      .lt("balance", myBalance);

    const total = totalCount ?? 1;
    const below = belowCount ?? 0;
    const percentile = total > 1 ? Math.round((below / (total - 1)) * 100) : 0;

    return res.json({ percentile: Math.max(0, Math.min(100, percentile)) });
  } catch (err) {
    console.error('/api/professionals/coin-percentile error:', err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao calcular percentil." });
  }
});

export default router;
