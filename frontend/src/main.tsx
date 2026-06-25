import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
      inlineStylesheet: false,
    } as Parameters<typeof Sentry.replayIntegration>[0]),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  // Ignora erros cuja origem (top do stack trace) é uma extensão de navegador —
  // ex: extensão de cupom/cashback fazendo telemetria própria que falha. Isso
  // não é erro do MeloCalé, mas o Sentry intercepta todo fetch/exception da
  // página, inclusive de extensões instaladas no navegador de quem acessa.
  denyUrls: [
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari-web-extension:\/\//,
  ],
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers?.Authorization) {
      delete event.request.headers.Authorization;
    }
    return event;
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <Sentry.ErrorBoundary fallback={<p>Ocorreu um erro inesperado.</p>}>
        <App />
      </Sentry.ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
);
