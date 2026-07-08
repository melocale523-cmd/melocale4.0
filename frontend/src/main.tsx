import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';

const ALLOWED_FETCH_HOSTS = [
  'melocale.com.br',
  'onrender.com',
  'supabase.co',
  'stripe.com',
  'challenges.cloudflare.com',
  'ipapi.co',
  'ip-api.com',
  'ipinfo.io',
  'geojs.io',
];

function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_FETCH_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  } catch {
    return true; // URL relativa ou malformada — não filtra, deixa passar
  }
}

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
  beforeBreadcrumb(breadcrumb) {
    if (
      (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') &&
      breadcrumb.data?.url &&
      !isAllowedHost(breadcrumb.data.url as string)
    ) {
      return null; // descarta o breadcrumb — não é chamada do MeloCalé
    }
    return breadcrumb;
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
