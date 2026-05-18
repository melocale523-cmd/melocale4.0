import { Request, Response, NextFunction, RequestHandler } from "express";
import { supabaseAdmin } from "../config.js";
import { withTimeout } from "../lib/timeout.js";

export interface AuthRequest extends Request {
  authUser?: { id: string; email: string; role: string };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const { data: { user }, error } = await withTimeout(
      supabaseAdmin.auth.getUser(token),
      8000
    );
    if (error || !user) return res.status(401).json({ error: "Token inválido" });

    (req as AuthRequest).authUser = user as { id: string; email: string; role: string };
    next();
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.startsWith("Request timeout");
    console.error("[requireAuth] erro:", err instanceof Error ? err.message : String(err));
    return res.status(isTimeout ? 503 : 500).json({
      error: isTimeout
        ? "Serviço de autenticação indisponível. Tente novamente."
        : "Erro interno de autenticação.",
    });
  }
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const { data: profile } = await withTimeout(
      supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", (req as AuthRequest).authUser!.id)
        .single()
    );
    if (profile?.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }
    next();
  } catch (err) {
    console.error("[requireAdmin] erro:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};
