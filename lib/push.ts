const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

    // ── 기존 구독이 있으면 재사용, 없을 때만 새로 생성 ──
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      })
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
      console.error('Push subscription upsert failed:', error)
      return false
    }

    return true
  } catch (e) {
    console.error('Push registration failed:', e)
    return false
  }
}

// ── 브라우저 구독 상태 + DB 레코드 모두 확인 ──
export async function isPushEnabled(userId: string, supabase: any): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return false

    const sub = await reg.pushManager.getSubscription()
    if (!sub || Notification.permission !== 'granted') return false

    // DB에 실제 레코드가 있는지 검증
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

// ── DB 삭제 성공 확인 후 브라우저 구독 해제 ──
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