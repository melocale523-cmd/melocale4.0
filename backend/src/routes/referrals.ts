// backend/src/routes/referrals.ts
import { Router, Request, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { supabaseAdmin, sensitiveLimiter } from '../config.js'

const router = Router()

// Use the shared supabaseAdmin instance from config instead of a local one

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
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('referral_code, role, full_name')
      .eq('id', userId)
      .single()

    if (profile?.referral_code) {
      const { data: stats } = await supabaseAdmin
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
      const { data: existing } = await supabaseAdmin
        .from('profiles').select('id').eq('referral_code', code).single()
      if (!existing) break
      code = generateCode(userId)
      attempts++
    }

    await supabaseAdmin.from('profiles').update({ referral_code: code }).eq('id', userId)

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
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('id, code, status, reward_amount, credited_at, created_at, referred_id')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const enriched = await Promise.all(
      (data ?? []).map(async (r) => {
        if (!r.referred_id) return { ...r, referred_name: null }
        const { data: p } = await supabaseAdmin
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

router.post('/register', sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
  const { code, newUserId } = req.body as { code?: string; newUserId?: string }
  if (!code || !newUserId) return res.status(400).json({ error: 'missing_params' })

  try {
    const { data: referrerProfile } = await supabaseAdmin
      .from('profiles').select('id, role').eq('referral_code', code).single()
    if (!referrerProfile) return res.status(404).json({ error: 'invalid_code' })
    if (referrerProfile.id === newUserId) return res.status(400).json({ error: 'self_referral' })

    const { data: alreadyReferred } = await supabaseAdmin
      .from('referrals').select('id').eq('referred_id', newUserId).single()
    if (alreadyReferred) return res.status(409).json({ error: 'already_referred' })

    const { data: newProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', newUserId).single()
    if (newProfile?.role !== referrerProfile.role)
      return res.status(400).json({ error: 'role_mismatch' })

    await supabaseAdmin.from('profiles').update({ referred_by_code: code }).eq('id', newUserId)

    const { data: referral, error } = await supabaseAdmin
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

export default router
