self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        // client.navigate()는 일부 브라우저(Safari 등)에서 미지원이므로 확인 후 호출
        if (typeof existing.navigate === 'function') {
          existing.navigate(url)
        }
      } else {
        clients.openWindow(url)
      }
    })
  )
})