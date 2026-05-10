import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

webpush.setVapidDetails(
  'mailto:JinJeopCalender@gmail.com',
  'BAi3UyOI08yglyMnzlbAMzscB4u9HniR_TOvyWP1PBpwQ2amse88Uaklbdb0CNvkf3w2UztOH3_9X1BFGiLc8e4',
  '3_GccWO_j_3KXaW6n_s6Zl30-KXLS4MUSFGFIaeDcbw',
)

async function sendPushToUser(user_id: string, title: string, body: string) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id)

  if (!subs?.length) return

  const payload = JSON.stringify({ title, body, url: '/' })

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async (err: any) => {
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      })
    )
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const record = body.record ?? body
    const type = record.type

    // 일정 승인 알림 (DB 트리거에서 호출)
    if (type === 'approved') {
      const { user_id, post_title } = record
      if (!user_id) return NextResponse.json({ ok: true })
      await sendPushToUser(user_id, '✅ 일정 승인', `"${post_title}" 일정이 승인됐어요!`)
      return NextResponse.json({ ok: true })
    }

    // 새 일정 알림 (notifications INSERT Webhook에서 호출)
    const user_id = record.user_id
    const post_id = record.post_id
    if (!user_id) return NextResponse.json({ ok: true })

    let postTitle = '새 일정이 추가됐어요'
    if (post_id) {
      const { data: post } = await supabase
        .from('posts').select('title').eq('id', post_id).single()
      if (post?.title) postTitle = post.title
    }

    await sendPushToUser(user_id, '📅 새 일정 알림', postTitle)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook push error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}