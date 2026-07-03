// Trigger Render redeploy 2026-04-28
import * as Sentry from "@sentry/node";
import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { loadCoinPackages } from "./src/config.js";
import { registerRoutes } from "./src/routes/index.js";
import { startJobs } from "./src/jobs/reminders.js";
import { startAppointmentReminderJob } from "./src/jobs/appointmentReminder.js";
import { startReferralBonusJob } from "./src/jobs/referralBonus.js";
import { startAiChatResponder } from "./src/jobs/aiChatResponder.js";
import { startStripeAuditJob } from "./src/jobs/stripeAudit.js";
import { startHealthCheckJob } from "./src/jobs/healthCheck.js";

// Sentry.init() agora roda em instrument.ts, carregado via `node --import`
// (ver package.json) antes deste arquivo — necessário pra instrumentação
// automática do Express funcionar em ESM.

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  console.error(JSON.stringify({
    level: "error",
    event: "uncaughtException",
    message: "Ocorreu um erro crítico não tratado.",
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  }));
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  void promise;
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  console.error(JSON.stringify({
    level: "error",
    event: "unhandledRejection",
    message: "Promessa rejeitada não tratada.",
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  }));
  process.exit(1);
});

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());

  const EXTRA_ORIGINS = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const ALLOWED_ORIGINS = new Set([
    "https://www.melocale.com.br",
    "https://melocale.com.br",
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:5173', 'http://localhost:4173']
      : []),
    ...EXTRA_ORIGINS,
  ]);

  const corsOptions: Parameters<typeof cors>[0] = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true); // same-origin or curl
      // Wildcard *.vercel.app permitia que QUALQUER deploy do Vercel (de
      // qualquer pessoa) fizesse requests credenciadas. Restringe a previews
      // deste projeto; outros previews podem ser liberados via FRONTEND_URL.
      const isAllowed =
        ALLOWED_ORIGINS.has(origin) ||
        /^https:\/\/melocale4-0[a-zA-Z0-9-]*\.vercel\.app$/.test(origin);
      callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "stripe-signature", "x-client-info", "apikey"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOptions));

  registerRoutes(app);

  Sentry.setupExpressErrorHandler(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
    const message = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : "Erro interno";
    res.status(status).json({ error: message });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  await loadCoinPackages();
  setInterval(loadCoinPackages, 60 * 60 * 1000);

  startJobs();
  startAppointmentReminderJob();
  startReferralBonusJob();
  startAiChatResponder();
  startStripeAuditJob();
  startHealthCheckJob();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
