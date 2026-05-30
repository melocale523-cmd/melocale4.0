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

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  integrations: [Sentry.expressIntegration()],
});

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
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
