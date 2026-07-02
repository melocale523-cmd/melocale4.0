import express, { Application, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import stripeRouter, { stripeWebhookHandler } from "./stripe.js";
import notificationsRouter from "./notifications.js";
import leadsRouter from "./leads.js";
import appointmentsRouter from "./appointments.js";
import chatRouter from "./chat.js";
import supportRouter from "./support.js";
import adminRouter from "./admin.js";
import referralsRouter from "./referrals.js";
import clientCoinsRouter from "./clientCoins.js";
import walletRouter from "./wallet.js";
import trackRouter from "./track.js";
import professionalsRouter from "./professionals.js";
import { PLANS } from "../config.js";

export function registerRoutes(app: Application) {
  // Webhook precisa de raw body — registrar ANTES do express.json() e do rate limiter
  // (Stripe não tem IP fixo, então o limiter global não pode bloquear webhooks legítimos)
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

  app.use(express.json({ limit: '100kb' }));

  // Rate limiter global ANTES de qualquer rota /api para que todas as rotas Stripe
  // (create-connected-account, create-account-link, create-featured-checkout, etc.)
  // estejam protegidas contra abuso.
  app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
  }));

  // Demais rotas stripe com body já parseado
  app.use("/api", stripeRouter);

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/plans", (_req: Request, res: Response) => {
    const plans = Object.entries(PLANS).map(([id, p]) => ({
      id,
      name:         p.name,
      coinDiscount: p.coinDiscount,
      welcomeCoins: p.welcomeCoins,
    }));
    res.json(plans);
  });

  app.use("/api", notificationsRouter);
  app.use("/api", leadsRouter);
  app.use("/api", appointmentsRouter);
  app.use("/api", chatRouter);
  app.use("/api", supportRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/referrals", referralsRouter);
  app.use("/api/client-coins", clientCoinsRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api", trackRouter);
  app.use("/api", professionalsRouter);
}
