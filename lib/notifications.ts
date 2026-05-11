import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── 단건 읽음 처리 ──
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('markNotificationAsRead error:', error)
    return false
  }
  return true
}

// ── 전체 읽음 처리 ──
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('markAllNotificationsAsRead error:', error)
    return false
  }
  return true
}

// ── 미읽음 개수 조회 ──
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('fetchUnreadCount error:', error)
    return 0
  }
  return count ?? 0
}

// ── 미읽음 카운트 실시간 구독 ──
// 컴포넌트 unmount 시 반환된 channel을 supabase.removeChannel()로 해제하세요.
export function subscribeUnreadCount(
  userId: string,
  onChange: (count: number) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`unread-count-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      async () => {
        const count = await fetchUnreadCount(userId)
        onChange(count)
      },
    )
    .subscribe()

  // 구독 시작 시 초기값 즉시 전달
  fetchUnreadCount(userId).then(onChange)

  return channel
}

// ── 알림 목록 조회 (최신순) ──
export async function fetchNotifications(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, post_id, is_read, created_at, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchNotifications error:', error)
    return []
  }
  return data ?? []
}