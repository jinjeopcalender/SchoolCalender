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

export async function POST(req: NextRequest) {
  try {
    const { user_id, title, body, url } = await req.json()
    if (!user_id || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (!subs?.length) return NextResponse.json({ sent: 0 })

    const payload = JSON.stringify({ title, body, url: url || '/' })

    const results = await Promise.allSettled(
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

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ sent: succeeded, total: subs.length })
  } catch (e) {
    console.error('Push error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}