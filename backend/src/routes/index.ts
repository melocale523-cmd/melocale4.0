import express, { Application, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { supabaseAdmin } from "../config.js";
import stripeRouter, { stripeWebhookHandler } from "./stripe.js";
import notificationsRouter from "./notifications.js";
import leadsRouter from "./leads.js";
import appointmentsRouter from "./appointments.js";
import chatRouter from "./chat.js";
import supportRouter from "./support.js";
import adminRouter from "./admin.js";
import referralsRouter from "./referrals.js";

export function registerRoutes(app: Application) {
  // Webhook precisa de raw body — registrar ANTES do express.json()
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

  app.use(express.json());

  // Demais rotas stripe com body já parseado
  app.use("/api", stripeRouter);

  app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }));

  app.get("/api/health", async (_req: Request, res: Response) => {
    let db: "connected" | "error" = "error";
    try {
      await Promise.race([
        supabaseAdmin.from("profiles").select("id").limit(1),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      db = "connected";
    } catch {
      db = "error";
    }
    res.json({
      status: "ok",
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? "0.0.0",
      db,
    });
  });

  app.use("/api", notificationsRouter);
  app.use("/api", leadsRouter);
  app.use("/api", appointmentsRouter);
  app.use("/api", chatRouter);
  app.use("/api", supportRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/referrals", referralsRouter);
}
