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

export default router
