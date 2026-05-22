// backend/src/routes/referrals.ts
import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateCode(userId: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const prefix = userId.slice(0, 4).toUpperCase().replace(/-/g, 'X')
  let suffix = ''
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${prefix}${suffix}`
}

router.get('/my-code', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, role, full_name')
      .eq('id', userId)
      .single()

    if (profile?.referral_code) {
      const { data: stats } = await supabase
        .from('referrals')
        .select('status')
        .eq('referrer_id', userId)
      const counts = {
        total:      stats?.length ?? 0,
        registered: stats?.filter(r => r.status === 'registered').length ?? 0,
        converted:  stats?.filter(r => r.status === 'converted').length ?? 0,
        credited:   stats?.filter(r => r.status === 'credited').length ?? 0,
      }
      return res.json({
        code: profile.referral_code,
        role: profile.role,
        stats: counts,
        link: `${process.env.FRONTEND_URL ?? 'https://melocale.com.br'}/cadastro?ref=${profile.referral_code}`
      })
    }

    let code = generateCode(userId)
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('referral_code', code).single()
      if (!existing) break
      code = generateCode(userId)
      attempts++
    }

    await supabase.from('profiles').update({ referral_code: code }).eq('id', userId)

    return res.json({
      code,
      role: profile?.role ?? 'client',
      stats: { total: 0, registered: 0, converted: 0, credited: 0 },
      link: `${process.env.FRONTEND_URL ?? 'https://melocale.com.br'}/cadastro?ref=${code}`
    })
  } catch (err) {
    console.error('[referrals] my-code error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

router.get('/list', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('id, code, status, reward_amount, credited_at, created_at, referred_id')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const enriched = await Promise.all(
      (data ?? []).map(async (r) => {
        if (!r.referred_id) return { ...r, referred_name: null }
        const { data: p } = await supabase
          .from('profiles').select('full_name').eq('id', r.referred_id).single()
        return { ...r, referred_name: p?.full_name ?? null }
      })
    )
    return res.json(enriched)
  } catch (err) {
    console.error('[referrals] list error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

router.post('/register', async (req: Request, res: Response) => {
  const { code, newUserId } = req.body as { code?: string; newUserId?: string }
  if (!code || !newUserId) return res.status(400).json({ error: 'missing_params' })

  try {
    const { data: referrerProfile } = await supabase
      .from('profiles').select('id, role').eq('referral_code', code).single()
    if (!referrerProfile) return res.status(404).json({ error: 'invalid_code' })
    if (referrerProfile.id === newUserId) return res.status(400).json({ error: 'self_referral' })

    const { data: alreadyReferred } = await supabase
      .from('referrals').select('id').eq('referred_id', newUserId).single()
    if (alreadyReferred) return res.status(409).json({ error: 'already_referred' })

    const { data: newProfile } = await supabase
      .from('profiles').select('role').eq('id', newUserId).single()
    if (newProfile?.role !== referrerProfile.role)
      return res.status(400).json({ error: 'role_mismatch' })

    await supabase.from('profiles').update({ referred_by_code: code }).eq('id', newUserId)

    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerProfile.id, referred_id: newUserId,
        referrer_role: referrerProfile.role, code, status: 'registered', reward_amount: 0,
      })
      .select().single()

    if (error) throw error
    return res.json({ success: true, referral_id: referral.id })
  } catch (err) {
    console.error('[referrals] register error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

router.post('/convert', async (req: Request, res: Response) => {
  const { referredUserId } = req.body as { referredUserId?: string }
  if (!referredUserId) return res.status(400).json({ error: 'missing_params' })

  try {
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, status, referrer_role, referrer_id')
      .eq('referred_id', referredUserId)
      .in('status', ['registered', 'converted'])
      .single()

    if (!referral) return res.json({ success: true, credited: false, reason: 'no_referral' })
    if (referral.status === 'credited') return res.json({ success: true, credited: false, reason: 'already_credited' })

    const rewardCoins = referral.referrer_role === 'professional' ? 60 : 30

    const { data: result, error } = await supabase.rpc('credit_referral_reward', {
      p_referral_id: referral.id,
      p_reward_coins: rewardCoins,
    })

    if (error) throw error
    if (result?.error) return res.json({ success: true, credited: false, reason: result.error })

    await supabase.from('notifications').insert({
      user_id: referral.referrer_id,
      title: '🎉 Indicação recompensada!',
      body: `Seu indicado ativou a conta. Você ganhou ${rewardCoins} moedas!`,
      type: 'referral_reward',
      is_read: false,
      metadata: { referral_id: referral.id, coins: rewardCoins },
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[referrals] credited ${rewardCoins} coins to ${referral.referrer_id}`)
    }

    return res.json({ success: true, credited: true, coins: rewardCoins })
  } catch (err) {
    console.error('[referrals] convert error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

export default router
