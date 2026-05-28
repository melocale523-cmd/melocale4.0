/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// HTML — NetworkFirst (app shell sempre atualizado, fallback offline)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 10 }),
    ],
  })
)

// API backend — NetworkFirst, cache 5min
const API_HOSTNAME = new URL(import.meta.env.VITE_API_URL || 'http://localhost').hostname;
registerRoute(
  ({ url }) => !!API_HOSTNAME && url.hostname === API_HOSTNAME,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 }),
    ],
  })
)

// Imagens — CacheFirst, 30 dias
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
)

// JS/CSS — NetworkFirst, same-origin only.
// Always fetches the latest from the network; falls back to cache when offline.
// Cross-origin scripts/styles are not intercepted (SW's connect-src doesn't list them).
registerRoute(
  ({ url, request }) =>
    (request.destination === 'script' || request.destination === 'style') &&
    url.origin === self.location.origin,
  new NetworkFirst({
    cacheName: 'assets-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
)

// Fallback offline para navegação
setCatchHandler(({ request }) => {
  if (request.mode === 'navigate') {
    return caches.match('/') as Promise<Response>
  }
  return Promise.resolve(Response.error())
})

self.addEventListener('push', (event: PushEvent) => {
  const data = (event.data?.json() ?? {}) as { title?: string; body?: string; data?: Record<string, unknown> }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'MeloCalé', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data,
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const data = event.notification.data as Record<string, unknown> | undefined
  const type = data?.type as string | undefined
  const proposedBy = data?.proposed_by as string | undefined

  const dataUrl = data?.url as string | undefined

  let url = '/'
  if (type === 'new_interest' || type === 'proposal_accepted') {
    url = '/profissional/leads'
  } else if (type === 'proposal_received') {
    url = '/cliente/pedidos'
  } else if (type === 'appointment_created' || type === 'appointment') {
    url = '/cliente/agenda'
  } else if (type === 'appointment_updated' || type === 'appointment_cancelled') {
    // url included in payload tells us which side the recipient is
    url = dataUrl ?? '/cliente/agenda'
  } else if (type === 'reschedule_proposed') {
    // proposed_by tells us who sent the proposal; the recipient is the other party
    url = proposedBy === 'professional' ? '/cliente/agenda' : '/profissional/agenda'
  } else if (type === 'reschedule_accepted' || type === 'reschedule_declined') {
    url = '/profissional/agenda'
  } else if (type === 'reminder_24h') {
    url = '/cliente/agenda'
  } else if (type === 'reminder_24h_prof') {
    url = '/profissional/agenda'
  } else if (type === 'message_client') {
    url = '/cliente/mensagens'
  } else if (type === 'message') {
    url = '/profissional/mensagens'
  } else if (dataUrl) {
    url = dataUrl
  }

  event.waitUntil(self.clients.openWindow(url))
})
