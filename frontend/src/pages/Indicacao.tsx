// frontend/src/pages/Indicacao.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Gift, Users, TrendingUp, CheckCircle, Clock, Award } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { apiFetch } from '../lib/api'

interface ReferralCode {
  code: string
  role: 'client' | 'professional'
  link: string
  stats: { total: number; registered: number; converted: number; credited: number }
}

interface ReferralItem {
  id: string
  status: 'pending' | 'registered' | 'converted' | 'credited'
  referred_name: string | null
  reward_amount: number
  credited_at: string | null
  created_at: string
}

const STATUS_CONFIG = {
  pending:    { label: 'Aguardando', color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  icon: Clock },
  registered: { label: 'Cadastrou',  color: 'text-blue-400',    bg: 'bg-blue-400/10',    icon: Users },
  converted:  { label: 'Ativou',     color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: TrendingUp },
  credited:   { label: 'Creditado',  color: 'text-green-400',   bg: 'bg-green-400/10',   icon: CheckCircle },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Indicacao() {
  const user = useAuthStore((state) => state.user)
  const [copied, setCopied] = useState(false)

  const { data: referralData, isLoading: loadingCode } = useQuery<ReferralCode>({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/my-code')
      if (!res.ok) throw new Error('Erro ao buscar código')
      return res.json()
    },
    enabled: !!user,
  })

  const { data: referrals = [], isLoading: loadingList } = useQuery<ReferralItem[]>({
    queryKey: ['referral-list', user?.id],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/list')
      if (!res.ok) throw new Error('Erro ao buscar indicações')
      return res.json()
    },
    enabled: !!user,
  })

  async function copyLink() {
    if (!referralData?.link) return
    await navigator.clipboard.writeText(referralData.link)
    setCopied(true)
    toast.success('Link copiado!', { description: 'Compartilhe com colegas de profissão.' })
    setTimeout(() => setCopied(false), 2500)
  }

  async function shareWhatsApp() {
    if (!referralData?.link) return
    const isPro = referralData.role === 'professional'
    const text = isPro
      ? `Oi! Uso o MeloCalé pra conseguir clientes de serviços domésticos. Cadastra pelo meu link e você ganha 60 moedas grátis: ${referralData.link}`
      : `Oi! Uso o MeloCalé pra contratar profissionais em casa. Cria sua conta pelo meu link e ganha R$10 de crédito: ${referralData.link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const isPro = referralData?.role === 'professional'
  const rewardLabel = isPro ? '60 moedas' : 'R$10 de crédito'
  const rewardDesc = isPro ? 'por indicado que assinar qualquer plano' : 'por indicado que fizer o primeiro pedido'
  const totalCoinsEarned = referrals.filter(r => r.status === 'credited').reduce((acc, r) => acc + (r.reward_amount || (isPro ? 60 : 30)), 0)

  return (
    <div className="min-h-screen bg-[#060d1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-emerald-400/10">
              <Gift className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">programa de indicações</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Indique e Ganhe</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Compartilhe seu link. Quando seu indicado ativar a conta, você recebe{' '}
            <span className="text-emerald-400 font-semibold">{rewardLabel}</span> {rewardDesc}.
          </p>
        </div>

        {referralData && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-white">{referralData.stats.total}</div>
              <div className="text-xs text-slate-500 mt-1">enviados</div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-blue-400">{referralData.stats.registered}</div>
              <div className="text-xs text-slate-500 mt-1">cadastraram</div>
            </div>
            <div className="bg-emerald-400/8 border border-emerald-400/20 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {isPro ? totalCoinsEarned : `R$${(referralData.stats.credited * 10).toFixed(0)}`}
              </div>
              <div className="text-xs text-slate-500 mt-1">{isPro ? 'moedas ganhas' : 'créditos ganhos'}</div>
            </div>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Seu link de indicação</span>
          </div>
          {loadingCode ? (
            <div className="h-12 bg-white/5 rounded-xl animate-pulse mb-4" />
          ) : (
            <>
              <div className="flex items-center gap-2 bg-[#0c1829] border border-white/8 rounded-xl px-4 py-3 mb-4">
                <span className="text-slate-400 text-sm flex-1 truncate font-mono text-xs">{referralData?.link ?? '—'}</span>
                <button onClick={copyLink} className="flex items-center gap-1.5 bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/30 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="text-xs text-slate-500">Código:</div>
                <div className="font-mono font-bold text-lg text-white tracking-widest bg-white/5 px-4 py-1.5 rounded-lg border border-white/8">
                  {referralData?.code ?? '—'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={copyLink} className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white text-sm font-medium py-3 rounded-xl transition-colors">
                  <Copy className="w-4 h-4" /> Copiar link
                </button>
                <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-sm font-semibold py-3 rounded-xl transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Como funciona
          </h3>
          <div className="space-y-4">
            {[
              { step: '1', title: 'Compartilhe seu link', desc: `Envie pelo WhatsApp, Instagram ou onde quiser para outros ${isPro ? 'profissionais' : 'clientes'}.`, color: 'text-blue-400', bg: 'bg-blue-400/10' },
              { step: '2', title: 'Indicado se cadastra', desc: 'Quando alguém criar a conta usando seu link, você aparece no nosso radar.', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { step: '3', title: `Você ganha ${rewardLabel}`, desc: isPro ? 'Assim que o indicado assinar qualquer plano, as moedas caem na sua carteira automaticamente.' : 'Quando o indicado fizer o primeiro pedido, o crédito é adicionado à sua carteira.', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            ].map(({ step, title, desc, color, bg }) => (
              <div key={step} className="flex gap-3">
                <div className={`w-7 h-7 rounded-full ${bg} ${color} flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>{step}</div>
                <div>
                  <div className="text-sm font-medium text-white">{title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" /> Suas indicações
            {referrals.length > 0 && <span className="bg-white/8 text-slate-400 text-xs px-2 py-0.5 rounded-full font-mono">{referrals.length}</span>}
          </h3>
          {loadingList ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}</div>
          ) : referrals.length === 0 ? (
            <div className="bg-white/3 border border-dashed border-white/10 rounded-2xl p-8 text-center">
              <Gift className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhuma indicação ainda.<br />Compartilhe seu link e comece a ganhar!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map((r) => {
                const cfg = STATUS_CONFIG[r.status]
                const Icon = cfg.icon
                return (
                  <div key={r.id} className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                    <div className={`p-1.5 rounded-lg ${cfg.bg}`}><Icon className={`w-3.5 h-3.5 ${cfg.color}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{r.referred_name ?? 'Usuário'}</div>
                      <div className="text-xs text-slate-600">{formatDate(r.created_at)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs font-semibold ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-full`}>{cfg.label}</div>
                      {r.status === 'credited' && (
                        <div className="text-xs text-emerald-400 font-mono mt-1">+{r.reward_amount || (isPro ? 60 : 30)} {isPro ? 'moedas' : 'crédito'}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
