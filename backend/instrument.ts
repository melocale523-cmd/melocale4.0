import * as Sentry from "@sentry/node";

// Precisa ser importado via `node --import` ANTES de qualquer outro módulo
// (express, etc.) ser carregado — é assim que o import-in-the-middle do Sentry
// consegue de fato instrumentar o Express em ESM. Init dentro do server.ts
// roda DEPOIS dos imports estáticos serem resolvidos, tarde demais pro hook
// se registrar — daí o aviso "[Sentry] express is not instrumented" no log.
// https://docs.sentry.io/platforms/javascript/guides/express/install/esm/
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  integrations: [Sentry.expressIntegration()],
});
