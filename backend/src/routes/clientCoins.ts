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
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, phone, city')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.full_name?.trim() || !profile?.phone?.trim() || !profile?.city?.trim()) {
      return res.status(403).json({ error: 'profile_incomplete' })
    }

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

// POST /api/client-coins/review-bonus
router.post('/review-bonus', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  const { appointment_id } = req.body as { appointment_id?: string }
  if (!appointment_id) return res.status(400).json({ error: 'missing_appointment_id' })
  try {
    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('appointment_id', appointment_id)
      .eq('client_id', userId)
      .maybeSingle()

    if (!review) {
      return res.status(403).json({ error: 'review_not_found_or_not_owned' })
    }

    const { data: result } = await supabaseAdmin.rpc('credit_client_coins', {
      p_user_id: userId,
      p_amount: 30,
      p_kind: 'review',
      p_reference: `review_${appointment_id}`,
      p_metadata: { appointment_id },
    })
    if (result?.error === 'already_credited') {
      return res.json({ ok: true, already_credited: true })
    }
    void supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: '⭐ Avaliação enviada!',
      body: 'Você ganhou 30 moedas por avaliar o profissional!',
      data: { type: 'review_bonus', coins: 30 },
    })
    return res.json({ ok: true, coins: 30 })
  } catch (err) {
    console.error('[client-coins] review-bonus error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// POST /api/client-coins/first-order
router.post('/first-order', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  try {
    const { data: anyLead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('client_id', userId)
      .limit(1)
      .maybeSingle()

    if (!anyLead) {
      return res.status(403).json({ error: 'no_orders_found' })
    }

    const { data: result } = await supabaseAdmin.rpc('credit_client_coins', {
      p_user_id: userId,
      p_amount: 100,
      p_kind: 'first_order',
      p_reference: `first_order_${userId}`,
      p_metadata: {},
    })
    if (result?.error === 'already_credited') {
      return res.json({ ok: true, already_credited: true })
    }
    void supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: '🎉 Primeiro pedido!',
      body: 'Você ganhou 100 moedas por criar seu primeiro pedido!',
      data: { type: 'first_order_bonus', coins: 100 },
    })
    return res.json({ ok: true, coins: 100 })
  } catch (err) {
    console.error('[client-coins] first-order error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

export default router
