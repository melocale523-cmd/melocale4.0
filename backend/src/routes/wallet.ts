import { Router, Request, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../config.js'

const router = Router()
const ASAAS_BASE = 'https://api.asaas.com/v3'
const ASAAS_KEY = process.env.ASAAS_API_KEY!
const MIN_WITHDRAWAL = 1000 // 1000 moedas = R$10

async function asaasFetch(path: string, options: RequestInit = {}) {
  return fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_KEY,
      ...(options.headers ?? {}),
    },
  })
}

// POST /api/wallet/withdraw
// Body: { pix_key: string, pix_key_type: 'CPF'|'CNPJ'|'EMAIL'|'PHONE'|'EVP' }
router.post('/withdraw', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  const { pix_key, pix_key_type } = req.body as { pix_key?: string; pix_key_type?: string }

  if (!pix_key || !pix_key_type) return res.status(400).json({ error: 'missing_params' })
  const validTypes = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']
  if (!validTypes.includes(pix_key_type)) return res.status(400).json({ error: 'invalid_pix_key_type' })

  try {
    // 1. Verificar saldo
    const { data: coins } = await supabaseAdmin
      .from('client_coins').select('balance').eq('user_id', userId).single()
    if (!coins || coins.balance < MIN_WITHDRAWAL)
      return res.status(400).json({ error: 'insufficient_balance', minimum: MIN_WITHDRAWAL })

    const amountBRL = parseFloat((coins.balance / 100).toFixed(2)) // 1000 moedas = R$10.00

    // 2. Debitar moedas (atômico)
    const { data: debitResult } = await supabaseAdmin.rpc('debit_client_coins', {
      p_user_id: userId,
      p_amount: coins.balance,
      p_kind: 'withdrawal',
      p_reference: `withdrawal_${userId}_${Date.now()}`,
      p_metadata: { pix_key, pix_key_type, amount_brl: amountBRL },
    })
    if (debitResult?.error) return res.status(400).json({ error: debitResult.error })

    // 3. Enviar Pix via Asaas
    const pixRes = await asaasFetch('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        value: amountBRL,
        operationType: 'PIX',
        pixAddressKey: pix_key,
        pixAddressKeyType: pix_key_type,
        description: 'Saque MeloCalé - Programa de Indicações',
      }),
    })
    const pixData = await pixRes.json() as { id?: string; status?: string; errors?: { description: string }[] }

    if (!pixRes.ok || pixData.errors) {
      // Estornar moedas se Pix falhou
      await supabaseAdmin.rpc('credit_client_coins', {
        p_user_id: userId,
        p_amount: coins.balance,
        p_kind: 'withdrawal_refund',
        p_reference: `refund_${userId}_${Date.now()}`,
        p_metadata: { reason: 'pix_failed', pix_error: pixData.errors },
      })
      return res.status(502).json({ error: 'pix_failed', details: pixData.errors })
    }

    // 4. Notificação in-app
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: '💸 Saque realizado!',
      body: `R$${amountBRL.toFixed(2).replace('.', ',')} enviado via Pix para ${pix_key}`,
      data: { type: 'withdrawal', transfer_id: pixData.id, amount: amountBRL },
    })

    return res.json({ success: true, transfer_id: pixData.id, amount_brl: amountBRL, status: pixData.status })
  } catch (err) {
    console.error('[wallet] withdraw error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// GET /api/wallet/balance
router.get('/balance', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).authUser!.id
  const { data } = await supabaseAdmin
    .from('client_coins').select('balance, total_earned, total_withdrawn').eq('user_id', userId).maybeSingle()
  return res.json(data ?? { balance: 0, total_earned: 0, total_withdrawn: 0 })
})

export default router
