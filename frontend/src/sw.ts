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
  const data = event.notification.data as Record<string, unknown> | undefined
  const type = data?.type as string | undefined
  const proposedBy = data?.proposed_by as string | undefined

  let url = '/'
  if (type === 'new_interest' || type === 'proposal_accepted') {
    url = '/profissional/leads'
  } else if (type === 'proposal_received') {
    url = '/cliente/pedidos'
  } else if (type === 'appointment_created' || type === 'appointment') {
    url = '/cliente/agenda'
  } else if (type === 'reschedule_proposed') {
    // proposed_by tells us who sent the proposal; the recipient is the other party
    url = proposedBy === 'professional' ? '/cliente/agenda' : '/profissional/agenda'
  } else if (type === 'reschedule_accepted' || type === 'reschedule_declined') {
    url = '/profissional/agenda'
  } else if (type === 'reminder_24h') {
    url = '/cliente/agenda'
  } else if (type === 'reminder_24h_prof') {
    url = '/profissional/agenda'
  } else if (type === 'message') {
    url = '/mensagens'
  }

  event.waitUntil(self.clients.openWindow(url))
})
