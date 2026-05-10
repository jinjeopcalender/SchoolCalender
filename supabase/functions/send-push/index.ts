// supabase/functions/send-push/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { user_id, title, body, url } = await req.json()
    if (!user_id || !title) return new Response('Missing fields', { status: 400, headers: corsHeaders })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (!subs?.length) return new Response('No subscriptions', { status: 200, headers: corsHeaders })

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
    return new Response(JSON.stringify({ sent: succeeded, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders })
  }
})