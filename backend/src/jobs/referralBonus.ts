import { supabaseAdmin } from '../config.js'
import { sendPushToUser } from '../lib/push.js'

export async function runReferralBonusJob() {
  try {
    const { data: count, error } = await supabaseAdmin.rpc('apply_monthly_referral_bonus')
    if (error) {
      console.error('[referralBonus] RPC error:', error.message)
      return
    }
    if (count > 0) {
      console.log(`[referralBonus] Credited monthly bonus to ${count} user(s)`)

      // Send push to users who just got the bonus
      const startOfMonth = new Date()
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

      const { data: recentBonuses } = await supabaseAdmin
        .from('referral_monthly_bonuses')
        .select('referrer_id')
        .gte('credited_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // last 5 min

      const referrerIds = (recentBonuses ?? []).map(r => r.referrer_id)
      // Sem FK entre referral_monthly_bonuses e profiles — join feito em
      // aplicação (join de PostgREST via embedded resource não funciona sem FK).
      const { data: profiles } = referrerIds.length
        ? await supabaseAdmin.from('profiles').select('id, role').in('id', referrerIds)
        : { data: [] as { id: string; role: string }[] }
      const roleById = new Map((profiles ?? []).map(p => [p.id, p.role]))

      for (const row of recentBonuses ?? []) {
        void sendPushToUser(row.referrer_id, {
          title: '🏆 Meta mensal atingida!',
          body: 'Você indicou 5+ pessoas este mês e ganhou 500 moedas bônus!',
          data: { type: 'monthly_referral_bonus', coins: 500, role: roleById.get(row.referrer_id) },
        })
      }
    }
  } catch (err) {
    console.error('[referralBonus] job error:', err instanceof Error ? err.message : String(err))
  }
}

export function startReferralBonusJob() {
  // Run once at startup, then every 6 hours
  void runReferralBonusJob()
  setInterval(runReferralBonusJob, 6 * 60 * 60 * 1000)
}
