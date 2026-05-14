/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() as { title: string; body: string; data?: Record<string, unknown> }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data,
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const type = (event.notification.data as Record<string, unknown> | undefined)?.type as string | undefined
  const url = type?.startsWith('reminder_24h_prof') ? '/profissional/agenda' : '/cliente/pedidos'
  event.waitUntil(
    self.clients.openWindow(url)
  )
})
