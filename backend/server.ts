// Trigger Render redeploy 2026-04-28
import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { loadCoinPackages } from "./src/config.js";
import { registerRoutes } from "./src/routes/index.js";
import { startJobs } from "./src/jobs/reminders.js";

process.on("uncaughtException", (err) => {
  console.error(JSON.stringify({
    level: "error",
    event: "uncaughtException",
    message: "Ocorreu um erro crítico não tratado.",
    error: err.message,
    stack: err.stack,
  }));
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  void promise;
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
    "http://localhost:5173",
    "http://localhost:4173",
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
