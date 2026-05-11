import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

webpush.setVapidDetails(
  'mailto:JinJeopCalender@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

async function sendPushToUser(user_id: string, title: string, body: string, url = '/') {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id)

  if (error || !subs?.length) return { sent: 0, total: 0 }

  const payload = JSON.stringify({ title, body, url })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        .catch(async (err: any) => {
          if (err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          throw err
        }),
    ),
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return { sent, total: subs.length }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Supabase DB Webhook 수신 (notifications INSERT 트리거) ──
    // record.type 이 있으면 Webhook 형식으로 판단
    if (body.record !== undefined || body.type !== undefined) {
      const record = body.record ?? body
      const type = record.type

      // 일정 승인 알림
      if (type === 'approved') {
        const { user_id, post_title } = record
        if (!user_id) return NextResponse.json({ ok: true })
        await sendPushToUser(user_id, '✅ 일정 승인', `"${post_title}" 일정이 승인됐어요!`)
        return NextResponse.json({ ok: true })
      }

      // 새 알림 (notifications INSERT)
      const user_id = record.user_id
      const post_id = record.post_id
      if (!user_id) return NextResponse.json({ ok: true })

      let postTitle = '새 일정이 추가됐어요'
      if (post_id) {
        const { data: post } = await supabase
          .from('posts')
          .select('title')
          .eq('id', post_id)
          .single()
        if (post?.title) postTitle = post.title
      }

      await sendPushToUser(user_id, '📅 새 일정 알림', postTitle)
      return NextResponse.json({ ok: true })
    }

    // ── 앱 내부에서 직접 호출하는 단건 발송 ──
    const { user_id, title, body: msgBody, url } = body
    if (!user_id || !title) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const result = await sendPushToUser(user_id, title, msgBody ?? '', url ?? '/')
    return NextResponse.json(result)
  } catch (e) {
    console.error('Push route error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}