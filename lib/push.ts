const VAPID_PUBLIC_KEY = 'BAi3UyOI08yglyMnzlbAMzscB4u9HniR_TOvyWP1PBpwQ2amse88Uaklbdb0CNvkf3w2UztOH3_9X1BFGiLc8e4'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function registerPush(userId: string, supabase: any): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const json = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: (json.keys as any).p256dh,
      auth: (json.keys as any).auth,
    }, { onConflict: 'user_id,endpoint' })

    return true
  } catch (e) {
    console.error('Push registration failed:', e)
    return false
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub && Notification.permission === 'granted'
}

export async function unregisterPush(userId: string, supabase: any): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete()
    .eq('user_id', userId).eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}