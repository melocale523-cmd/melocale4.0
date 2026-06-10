import { Router, Request, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../config.js'

const router = Router()

// GET /api/client-coins/balance
router.get('/balance', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  const { data } = await supabaseAdmin
    .from('client_coins').select('balance, total_earned, total_withdrawn').eq('user_id', userId).maybeSingle()
  return res.json(data ?? { balance: 0, total_earned: 0, total_withdrawn: 0 })
})

// GET /api/client-coins/transactions
router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  const { data } = await supabaseAdmin
    .from('client_coin_transactions')
    .select('id, amount, kind, reference, metadata, balance_after, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return res.json(data ?? [])
})

// GET /api/client-coins/ranking
router.get('/ranking', async (_req: Request, res: Response) => {
  const { data } = await supabaseAdmin
    .from('client_coins_ranking')
    .select('user_id, full_name, avatar_url, total_earned, position')
  return res.json(data ?? [])
})

// POST /api/client-coins/profile-complete
router.post('/profile-complete', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const { data: result } = await supabaseAdmin.rpc('credit_client_coins', {
      p_user_id: userId,
      p_amount: 50,
      p_kind: 'profile_complete',
      p_reference: `profile_complete_${userId}`,
      p_metadata: {},
    })
    if (result?.error === 'already_credited') {
      return res.json({ ok: true, already_credited: true })
    }
    // Notificação in-app
    void supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: '🎉 Perfil completo!',
      body: 'Você ganhou 50 moedas por completar seu perfil!',
      data: { type: 'profile_complete_bonus', coins: 50 },
    })
    return res.json({ ok: true, coins: 50 })
  } catch (err) {
    console.error('[client-coins] profile-complete error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

export default router
