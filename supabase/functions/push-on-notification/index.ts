// supabase/functions/push-on-notification/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// web-push를 npm 호환 모드로 가져오기
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = 'BAi3UyOI08yglyMnzlbAMzscB4u9HniR_TOvyWP1PBpwQ2amse88Uaklbdb0CNvkf3w2UztOH3_9X1BFGiLc8e4'
const VAPID_PRIVATE_KEY = '3_GccWO_j_3KXaW6n_s6Zl30-KXLS4MUSFGFIaeDcbw'

webpush.setVapidDetails(
  'mailto:JinJeopCalender@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record ?? payload
    const type = record.type

    if (type === 'approved') {
      const { user_id, post_title } = record
      if (!user_id) return new Response('No user_id', { status: 200, headers: corsHeaders })
      await sendPushToUser(user_id, '✅ 일정 승인', `"${post_title}" 일정이 승인됐어요!`)
    } else {
      const user_id = record.user_id
      const post_id = record.post_id
      if (!user_id) return new Response('No user_id', { status: 200, headers: corsHeaders })

      let body = '새 일정이 추가됐어요'
      if (post_id) {
        const { data: post } = await supabase.from('posts').select('title').eq('id', post_id).single()
        if (post?.title) body = post.title
      }
      await sendPushToUser(user_id, '📅 새 일정 알림', body)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Error:', e)
    return new Response(String(e), { status: 500, headers: corsHeaders })
  }
})