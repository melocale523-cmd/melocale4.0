// backend/src/routes/referrals.ts
import { Router, Request, Response } from 'express'
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js'
import { supabaseAdmin, sensitiveLimiter } from '../config.js'
import { sendPushToUser } from '../lib/push.js'
import { REFERRAL_COINS_PROFESSIONAL, REFERRAL_BONUS_MONTHLY } from '../config/referralConstants.js'

const router = Router()

let _configCache: { data: unknown; ts: number } | null = null
const CONFIG_CACHE_TTL = 60_000 // 60 segundos

function generateCode(userId: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const prefix = userId.slice(0, 4).toUpperCase().replace(/-/g, 'X')
  let suffix = ''
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}${suffix}`
}

async function getConfig(): Promise<{ multiplier: number; expires_at: string | null; label: string | null }> {
  try {
    const { data } = await supabaseAdmin
      .from('referral_config').select('multiplier, expires_at, label').eq('id', 1).single()
    if (!data) return { multiplier: 1, expires_at: null, label: null }
    if (data.expires_at && new Date(data.expires_at) < new Date())
      return { multiplier: 1, expires_at: null, label: null }
    return { multiplier: data.multiplier ?? 1, expires_at: data.expires_at, label: data.label }
  } catch {
    return { multiplier: 1, expires_at: null, label: null }
  }
}

// ── Public endpoints (no auth) ──────────────────────────────────────────────

// GET /api/referrals/config — current bonus multiplier
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const now = Date.now()
    if (_configCache && now - _configCache.ts < CONFIG_CACHE_TTL) {
      return res.json(_configCache.data)
    }
    const data = await getConfig()
    _configCache = { data, ts: now }
    return res.json(data)
  } catch {
    return res.json({ multiplier: 1, expires_at: null, label: null })
  }
})

// GET /api/referrals/invite/:code — referrer info for landing page /convite/:code
router.get('/invite/:code', async (req: Request, res: Response) => {
  const { code } = req.params
  if (!code || code.length < 5) return res.status(400).json({ error: 'invalid_code' })
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('full_name, avatar_url, role').eq('referral_code', code).maybeSingle()
    if (!profile) return res.status(404).json({ error: 'not_found' })
    return res.json({
      full_name: profile.full_name,
      avatar_url: profile.avatar_url ?? null,
      role: profile.role,
      code,
      link: `${process.env.FRONTEND_URL ?? 'https://melocale.com.br'}/convite/${code}`,
    })
  } catch {
    return res.status(500).json({ error: 'internal_error' })
  }
})

// GET /api/referrals/ranking — top 10 referrers this month
router.get('/ranking', async (_req: Request, res: Response) => {
  try {
    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    const { data, error } = await supabaseAdmin
      .from('referrals').select('referrer_id').gte('created_at', startOfMonth.toISOString())
    if (error) throw error

    const counts: Record<string, number> = {}
    for (const r of data ?? []) counts[r.referrer_id] = (counts[r.referrer_id] ?? 0) + 1

    const topIds = Object.entries(counts)
      .sort(([, a], [, b]) => b - a).slice(0, 10).map(([id]) => id)
    if (topIds.length === 0) return res.json([])

    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id, full_name, avatar_url').in('id', topIds)

    return res.json(topIds.map((id, i) => {
      const p = profiles?.find(p => p.id === id)
      return { position: i + 1, referrer_id: id, full_name: p?.full_name ?? 'Usuário', avatar_url: p?.avatar_url ?? null, total: counts[id] }
    }))
  } catch (err) {
    console.error('[referrals] ranking error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// ── Authenticated endpoints ─────────────────────────────────────────────────

// GET /api/referrals/monthly-stats
router.get('/monthly-stats', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    const [{ data: monthlyRefs }, { data: bonus }] = await Promise.all([
      supabaseAdmin.from('referrals').select('id', { count: 'exact' })
        .eq('referrer_id', userId).gte('created_at', startOfMonth.toISOString()),
      supabaseAdmin.from('referral_monthly_bonuses').select('id')
        .eq('referrer_id', userId).gte('credited_at', startOfMonth.toISOString()).maybeSingle(),
    ])

    return res.json({
      total_this_month: monthlyRefs?.length ?? 0,
      goal: 5,
      bonus_credited: !!bonus,
      bonus_coins: REFERRAL_BONUS_MONTHLY,
    })
  } catch (err) {
    console.error('[referrals] monthly-stats error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// GET /api/referrals/my-code
router.get('/my-code', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('referral_code, role, full_name, avatar_url').eq('id', userId).single()

    if (profile?.referral_code) {
      const { data: stats } = await supabaseAdmin
        .from('referrals').select('status').eq('referrer_id', userId)
      const counts = {
        total:      stats?.length ?? 0,
        registered: stats?.filter(r => r.status === 'registered').length ?? 0,
        converted:  stats?.filter(r => r.status === 'converted').length ?? 0,
        credited:   stats?.filter(r => r.status === 'credited').length ?? 0,
      }
      return res.json({
        code: profile.referral_code, role: profile.role, full_name: profile.full_name,
        avatar_url: profile.avatar_url ?? null,
        stats: counts,
        link: `${process.env.FRONTEND_URL ?? 'https://melocale.com.br'}/convite/${profile.referral_code}`,
      })
    }

    let code = generateCode(userId)
    for (let i = 0; i < 10; i++) {
      const { data: existing } = await supabaseAdmin
        .from('profiles').select('id').eq('referral_code', code).single()
      if (!existing) break
      code = generateCode(userId)
    }
    await supabaseAdmin.from('profiles').update({ referral_code: code }).eq('id', userId)

    return res.json({
      code, role: profile?.role ?? 'client', full_name: profile?.full_name ?? '',
      avatar_url: profile?.avatar_url ?? null,
      stats: { total: 0, registered: 0, converted: 0, credited: 0 },
      link: `${process.env.FRONTEND_URL ?? 'https://melocale.com.br'}/convite/${code}`,
    })
  } catch (err) {
    console.error('[referrals] my-code error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// GET /api/referrals/list
router.get('/list', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('id, code, status, reward_amount, credited_at, created_at, referred_id')
      .eq('referrer_id', userId).order('created_at', { ascending: false })
    if (error) throw error

    const enriched = await Promise.all(
      (data ?? []).map(async (r) => {
        if (!r.referred_id) return { ...r, referred_name: null, referred_avatar: null }
        const { data: p } = await supabaseAdmin
          .from('profiles').select('full_name, avatar_url').eq('id', r.referred_id).single()
        return { ...r, referred_name: p?.full_name ?? null, referred_avatar: p?.avatar_url ?? null }
      })
    )
    return res.json(enriched)
  } catch (err) {
    console.error('[referrals] list error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// POST /api/referrals/register
router.post('/register', sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
  const { code, newUserId } = req.body as { code?: string; newUserId?: string }
  if (!code || !newUserId) return res.status(400).json({ error: 'missing_params' })

  const authUser = (req as AuthRequest).authUser!;
  if (newUserId !== authUser.id) {
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const { data: referrerProfile } = await supabaseAdmin
      .from('profiles').select('id, role, full_name').eq('referral_code', code).single()
    if (!referrerProfile) return res.status(404).json({ error: 'invalid_code' })
    if (referrerProfile.id === newUserId) return res.status(400).json({ error: 'self_referral' })

    const { data: alreadyReferred } = await supabaseAdmin
      .from('referrals').select('id').eq('referred_id', newUserId).single()
    if (alreadyReferred) return res.status(409).json({ error: 'already_referred' })

    const { data: newProfile } = await supabaseAdmin
      .from('profiles').select('role, full_name').eq('id', newUserId).single()

    await supabaseAdmin.from('profiles').update({ referred_by_code: code }).eq('id', newUserId)

    const { data: referral, error } = await supabaseAdmin.from('referrals').insert({
      referrer_id: referrerProfile.id, referred_id: newUserId,
      referrer_role: referrerProfile.role, code, status: 'registered', reward_amount: 0,
    }).select().single()
    if (error) throw error

    // Push + in-app notification to referrer
    const firstName = (newProfile?.full_name ?? 'Alguém').split(' ')[0]
    const rewardHint = referrerProfile.role === 'professional' ? `${REFERRAL_COINS_PROFESSIONAL} moedas` : 'R$2'
    void sendPushToUser(referrerProfile.id, {
      title: '🎉 Nova indicação!',
      body: `${firstName} se cadastrou com seu link! +${rewardHint} quando ele ativar.`,
      data: { type: 'new_referral', referral_id: referral.id },
    })
    void supabaseAdmin.from('notifications').insert({
      user_id: referrerProfile.id,
      title: '🎉 Nova indicação!',
      body: `${firstName} se cadastrou com seu link! Você ganhará ${rewardHint} quando ele ativar a conta.`,
      data: { type: 'new_referral', referral_id: referral.id },
    }).then(({ error: notifErr }) => {
      if (notifErr) console.error('[referrals] notification insert error:', notifErr.message)
    })

    // Level-2 cascade: credit 20 coins to the person who originally referred newUserId's referrer
    // O query builder é um thenable preguiçoso: sem await a RPC nunca era executada.
    const { error: cascadeErr } = await supabaseAdmin.rpc('credit_cascade_referral', { p_level1_user_id: newUserId })
    if (cascadeErr) console.error('[referrals] credit_cascade_referral error:', cascadeErr.message)

    // Creditar 20 moedas ao novo usuário por se cadastrar via indicação
    void supabaseAdmin.rpc('credit_client_coins', {
      p_user_id: newUserId,
      p_amount: 20,
      p_kind: 'referral_signup',
      p_reference: `referral_signup_${newUserId}`,
      p_metadata: { referrer_code: code },
    })

    return res.json({ success: true, referral_id: referral.id })
  } catch (err) {
    console.error('[referrals] register error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// PUT /api/referrals/config — admin only
router.put('/config', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { multiplier, expires_at, label } = req.body as { multiplier?: number; expires_at?: string | null; label?: string | null }
  if (!multiplier || multiplier < 1 || multiplier > 10)
    return res.status(400).json({ error: 'invalid_multiplier' })
  try {
    await supabaseAdmin.from('referral_config')
      .update({ multiplier, expires_at: expires_at ?? null, label: label ?? null, updated_at: new Date().toISOString() })
      .eq('id', 1)
    _configCache = null
    return res.json({ success: true })
  } catch {
    return res.status(500).json({ error: 'internal_error' })
  }
})

export { getConfig as getReferralConfig }
export default router
