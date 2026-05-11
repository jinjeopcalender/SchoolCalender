const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
console.log('VAPID KEY 확인:', VAPID_PUBLIC_KEY)

export let lastPushError = ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function registerPush(userId: string, supabase: any): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      lastPushError = 'SW or PushManager not supported'
      return false
    }

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      lastPushError = `permission: ${permission}`
      return false
    }

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      })
    }

    if (!sub) {
      lastPushError = 'subscribe() returned null'
      return false
    }

    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: (json.keys as any).p256dh,
        auth: (json.keys as any).auth,
      },
      { onConflict: 'user_id,endpoint' },
    )

    if (error) {
      lastPushError = `DB error: ${error.message}`
      return false
    }

    lastPushError = ''
    return true
  } catch (e: any) {
    lastPushError = e?.message ?? String(e)
    return false
  }
}

export async function isPushEnabled(userId: string, supabase: any): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return false

    const sub = await reg.pushManager.getSubscription()
    if (!sub || Notification.permission !== 'granted') return false

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', sub.endpoint)
      .maybeSingle()

    if (error) return false
    return !!data
  } catch {
    return false
  }
}

export async function unregisterPush(userId: string, supabase: any): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return false

    const sub = await reg.pushManager.getSubscription()
    if (!sub) return false

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', sub.endpoint)

    if (error) {
      console.error('Push subscription delete failed:', error)
      return false
    }

    await sub.unsubscribe()
    return true
  } catch (e) {
    console.error('Push unregister failed:', e)
    return false
  }
}