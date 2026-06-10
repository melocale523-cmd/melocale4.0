import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Link2, Copy, MessageCircle, QrCode, Share2,
  BarChart2, Info, Users, Gift, Loader2, Zap, Trophy,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '../../store/authStore'
import { apiFetch } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────
interface ReferralCode {
  code: string
  role: 'client' | 'professional'
  full_name: string
  avatar_url: string | null
  link: string
  stats: { total: number; registered: number; converted: number; credited: number }
}
interface ReferralItem {
  id: string
  status: 'pending' | 'registered' | 'converted' | 'credited'
  referred_name: string | null
  referred_avatar: string | null
  reward_amount: number
  credited_at: string | null
  created_at: string
}
interface BonusConfig {
  multiplier: number
  expires_at: string | null
  label: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────
function getAvatarInfo(name: string): { initials: string; colorClass: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  const palette = ['bg-blue-800', 'bg-purple-700', 'bg-orange-700', 'bg-teal-700']
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return { initials, colorClass: palette[Math.abs(hash) % palette.length] }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

const CARD = 'bg-[#132236] border border-white/[0.06] rounded-2xl p-5'
const CARD_HEADER = 'flex items-center gap-2 mb-4'

// ── Component ─────────────────────────────────────────────────────────
export default function ClientIndicacoes() {
  const user = useAuthStore((state) => state.user)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [generatingStories, setGeneratingStories] = useState(false)

  // Wait for auth to fully initialize before querying — avoids race where user is
  // briefly null while the Supabase session is being restored
  const authReady = !isAuthLoading && !!user

  const { data: referralData, isLoading: loadingCode, isError: codeError } = useQuery<ReferralCode>({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/my-code')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      return res.json() as Promise<ReferralCode>
    },
    enabled: authReady,
    retry: 2,
    staleTime: 30 * 1000,
  })

  const { data: referrals = [], isLoading: loadingList } = useQuery<ReferralItem[]>({
    queryKey: ['referral-list', user?.id],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/list')
      if (!res.ok) throw new Error('Erro ao buscar indicações')
      return res.json()
    },
    enabled: authReady,
  })

  const { data: ranking = [] } = useQuery<{ user_id: string; full_name: string; avatar_url: string | null; total_earned: number; position: number }[]>({
    queryKey: ['clientCoinsRanking'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/ranking')
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const { data: bonusConfig } = useQuery<BonusConfig>({
    queryKey: ['referral-config'],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/config')
      if (!res.ok) return { multiplier: 1, expires_at: null, label: null }
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  // React Query v5: when enabled=false, isLoading=false (idle/pending) — treat
  // "auth still loading" as loading to avoid showing "—" before data arrives
  const isEffectivelyLoading = isAuthLoading || loadingCode
  const isListLoading = isAuthLoading || loadingList

  const hasDoubleBonus = (bonusConfig?.multiplier ?? 1) > 1
  const isPro = referralData?.role === 'professional'
  const baseReward = isPro ? 60 : 30
  const effectiveReward = baseReward * (bonusConfig?.multiplier ?? 1)
  const rewardLabel = isPro ? `${effectiveReward} moedas` : `R$${(effectiveReward / 3).toFixed(0)}`
  const rewardDesc = isPro
    ? 'por indicado que assinar qualquer plano'
    : 'por indicado que fizer o primeiro pedido'
  const totalEarned = referrals
    .filter(r => r.status === 'credited')
    .reduce((acc, r) => acc + (r.reward_amount || baseReward), 0)
  const balanceLabel = isPro
    ? `${totalEarned} moedas`
    : `R$ ${(totalEarned / 3).toFixed(2).replace('.', ',')}`

  async function copyLink() {
    if (!referralData?.link) return
    await navigator.clipboard.writeText(referralData.link)
    setCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2500)
  }

  function shareWhatsApp() {
    if (!referralData?.link) return
    const firstName = (referralData.full_name || '').split(' ')[0]

    const text = isPro
      ? `🔧 *Ei! Tô ganhando dinheiro extra pelo MeloCalé!*\n\nSou ${firstName || 'profissional'} e uso pra captar clientes de serviços domésticos aqui na cidade.\n\n✅ Clientes reais pedindo orçamento\n✅ Sem mensalidade pra começar\n✅ Você recebe pedidos na hora\n\n👉 Cria sua conta GRÁTIS pelo meu link:\n${referralData.link}\n\n_Código de convite: *${referralData.code}*_`
      : `🏠 *Ei! Encontrei uma forma fácil de contratar profissionais!*\n\nSou ${firstName || 'cliente'} e uso o MeloCalé pra contratar eletricistas, encanadores, pintores e muito mais.\n\n✅ Profissionais verificados\n✅ Orçamento grátis\n✅ Avaliações reais de clientes\n\n👉 Cria sua conta GRÁTIS pelo meu link e já encontra o profissional ideal:\n${referralData.link}\n\n_Código de convite: *${referralData.code}*_`

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const generateStoriesImage = useCallback(async () => {
    if (!referralData || generatingStories) return
    setGeneratingStories(true)
    try {
      const W = 1080, H = 1920
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!

      const bgGrad = ctx.createLinearGradient(0, 0, W, H)
      bgGrad.addColorStop(0, '#020c18')
      bgGrad.addColorStop(0.45, '#041a2e')
      bgGrad.addColorStop(1, '#03180e')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      const paintGlow = (x: number, y: number, r: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, color); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
      paintGlow(900, 200, 480, 'rgba(16,185,129,0.10)')
      paintGlow(150, 1700, 400, 'rgba(99,102,241,0.10)')

      ctx.textAlign = 'center'
      ctx.font = 'bold 72px system-ui,sans-serif'
      ctx.fillStyle = '#10b981'
      ctx.fillText('MeloCalé', W / 2, 200)

      let avatarY = 320
      if (referralData.avatar_url) {
        try {
          const img = await loadImg(referralData.avatar_url)
          const R = 90
          ctx.save(); ctx.beginPath()
          ctx.arc(W / 2, avatarY + R, R, 0, Math.PI * 2); ctx.clip()
          ctx.drawImage(img, W / 2 - R, avatarY, R * 2, R * 2); ctx.restore()
          ctx.strokeStyle = 'rgba(16,185,129,0.6)'; ctx.lineWidth = 5
          ctx.beginPath(); ctx.arc(W / 2, avatarY + R, R, 0, Math.PI * 2); ctx.stroke()
          avatarY += R * 2 + 40
        } catch { avatarY = 360 }
      }

      const firstName = referralData.full_name.split(' ')[0]
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 68px system-ui,sans-serif'
      ctx.fillText(firstName || 'MeloCalé', W / 2, avatarY + 60)
      ctx.fillStyle = '#64748b'; ctx.font = '40px system-ui,sans-serif'
      ctx.fillText('te convida para o MeloCalé', W / 2, avatarY + 120)

      const divY = avatarY + 170
      ctx.strokeStyle = 'rgba(16,185,129,0.5)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(120, divY); ctx.lineTo(W - 120, divY); ctx.stroke()

      const pillY = divY + 60
      ctx.fillStyle = 'rgba(16,185,129,0.12)'
      ctx.beginPath(); ctx.roundRect(180, pillY, W - 360, 150, 40); ctx.fill()
      ctx.fillStyle = '#10b981'; ctx.font = 'bold 52px system-ui,sans-serif'
      ctx.fillText(`Ganhe ${rewardLabel}`, W / 2, pillY + 68)
      ctx.fillStyle = '#475569'; ctx.font = '34px system-ui,sans-serif'
      ctx.fillText(rewardDesc, W / 2, pillY + 118)

      const codeY = pillY + 210
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.beginPath(); ctx.roundRect(250, codeY, W - 500, 120, 24); ctx.fill()
      ctx.fillStyle = '#94a3b8'; ctx.font = '34px system-ui,sans-serif'
      ctx.fillText('Código de convite', W / 2, codeY + 46)
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 60px monospace'
      ctx.fillText(referralData.code, W / 2, codeY + 106)

      try {
        const qrY = codeY + 170
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(referralData.link)}&bgcolor=ffffff&color=020c18&qzone=2`
        const qrImg = await loadImg(qrUrl)
        const qrSize = 280, qrX = (W - qrSize) / 2
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24); ctx.fill()
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
      } catch { /* skip if unavailable */ }

      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `melocale-stories-${referralData.code}.png`
      a.click()
      toast.success('Imagem para Stories gerada! 📸')
    } catch (err) {
      console.error('Stories error:', err)
      toast.error('Erro ao gerar imagem. Tente novamente.')
    } finally {
      setGeneratingStories(false)
    }
  }, [referralData, generatingStories, rewardLabel, rewardDesc])

  return (
    <div className="w-full space-y-6">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-3">
            <span className="text-base leading-none">🎁</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
              Programa de Indicações
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Indique e Ganhe</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Compartilhe seu link. Quando seu indicado ativar, você recebe{' '}
            <span className="text-emerald-400 font-bold">{rewardLabel}</span>{' '}
            {rewardDesc}.
          </p>
        </div>
        {hasDoubleBonus && (
          <div className="shrink-0 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl px-4 py-3 text-center">
            <div className="text-yellow-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={11} className="fill-yellow-400" /> Bônus {bonusConfig!.multiplier}×
            </div>
            <div className="text-yellow-300 text-[10px] mt-0.5">
              {bonusConfig?.label ?? 'ativo agora!'}
            </div>
            {bonusConfig?.expires_at && (
              <div className="text-white/30 text-[9px] mt-0.5">
                até {new Date(bonusConfig.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2-column grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Card 1 — Seu link de indicação */}
          <div className={CARD}>
            <div className={CARD_HEADER}>
              <Link2 size={18} className="text-emerald-400" />
              <span className="text-base font-semibold text-white">Seu link de indicação</span>
            </div>

            {isEffectivelyLoading ? (
              <div className="space-y-3">
                <div className="h-11 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-9 bg-white/5 rounded-lg animate-pulse w-1/2" />
                <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : codeError ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <p className="text-white/40 text-sm">Não foi possível carregar o seu link.</p>
                <p className="text-white/30 text-xs">Verifique sua conexão e recarregue a página.</p>
              </div>
            ) : (
              <>
                {/* Link box */}
                <div className="bg-[#0d1c2e] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-4">
                  <span className="text-sm text-white/60 truncate font-mono flex-1">
                    {referralData?.link ?? '—'}
                  </span>
                  <button
                    onClick={copyLink}
                    disabled={!referralData?.link}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Copy size={13} />
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                {/* Code */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-white/50 text-sm">Código:</span>
                  <span className="font-mono font-bold text-white text-lg bg-[#0d1c2e] border border-white/10 rounded-lg px-4 py-2 tracking-widest">
                    {referralData?.code ?? '—'}
                  </span>
                </div>

                {/* Share buttons 2×2 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={shareWhatsApp}
                    disabled={!referralData?.link}
                    className="rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium transition-all bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </button>
                  <button
                    onClick={copyLink}
                    disabled={!referralData?.link}
                    className="rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium transition-all bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Copy size={16} /> Copiar link
                  </button>
                  <button
                    onClick={() => setShowQr(v => !v)}
                    disabled={!referralData?.link}
                    className="rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium transition-all bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <QrCode size={16} /> {showQr ? 'Ocultar QR' : 'QR Code'}
                  </button>
                  <button
                    onClick={generateStoriesImage}
                    disabled={generatingStories || !referralData?.link}
                    className="rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium transition-all bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingStories ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                    {generatingStories ? 'Gerando…' : 'Stories'}
                  </button>
                </div>

                {/* QR panel */}
                {showQr && referralData?.link && (
                  <div className="mt-4 flex flex-col items-center gap-3 bg-white p-6 rounded-2xl">
                    <QRCodeSVG value={referralData.link} size={160} bgColor="#ffffff" fgColor="#060d1a" level="M" />
                    <p className="text-[#060d1a] text-xs font-mono font-bold">{referralData.code}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Card 2 — Seus resultados */}
          <div className={CARD}>
            <div className={CARD_HEADER}>
              <BarChart2 size={18} className="text-emerald-400" />
              <span className="text-base font-semibold text-white">Seus resultados</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0d1c2e] border border-white/10 rounded-xl py-4 flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-white">
                  {referralData?.stats.total ?? 0}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/40">Indicados</span>
              </div>
              <div className="bg-[#0d1c2e] border border-white/10 rounded-xl py-4 flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-orange-400">
                  {referralData?.stats.converted ?? 0}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/40">Ativos</span>
              </div>
              <div className="bg-[#0d1c2e] border border-white/10 rounded-xl py-4 flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-emerald-400">
                  {isPro ? totalEarned : `R$${(totalEarned / 3).toFixed(0)}`}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/40">Ganhos</span>
              </div>
            </div>
          </div>

          {/* Card 3 — Como funciona */}
          <div className={CARD}>
            <div className={CARD_HEADER}>
              <Info size={18} className="text-emerald-400" />
              <span className="text-base font-semibold text-white">Como funciona</span>
            </div>
            <div>
              {[
                {
                  step: '1',
                  title: 'Compartilhe seu link',
                  desc: `Envie para outros ${isPro ? 'profissionais' : 'clientes'} pelo WhatsApp, Instagram ou onde quiser.`,
                  circle: 'bg-emerald-500 text-white',
                  isIcon: false,
                },
                {
                  step: '2',
                  title: 'Indicado se cadastra',
                  desc: 'Quando alguém criar conta com seu link, você aparece no nosso radar.',
                  circle: 'bg-emerald-500 text-white',
                  isIcon: false,
                },
                {
                  step: '3',
                  title: `Você ganha ${rewardLabel}`,
                  desc: isPro
                    ? 'Assim que o indicado assinar qualquer plano, as moedas caem na sua carteira.'
                    : 'Quando o indicado fizer o primeiro pedido, o crédito é adicionado.',
                  circle: 'bg-emerald-500 text-white',
                  isIcon: false,
                },
                {
                  step: 'link',
                  title: 'Bônus em cascata',
                  desc: 'Quando seu indicado indica alguém, você ganha mais automaticamente!',
                  circle: 'bg-purple-500/20 text-purple-400',
                  isIcon: true,
                },
              ].map(({ step, title, desc, circle, isIcon }) => (
                <div key={step} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                  <div className={`w-6 h-6 rounded-full ${circle} text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}>
                    {isIcon ? <Link2 size={12} /> : step}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {ranking.length > 0 && (
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Trophy size={17} color="#f59e0b" />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Top indicadores do mês</span>
              </div>
              {ranking.slice(0, 5).map((r, i) => {
                const medals = ['🥇', '🥈', '🥉']
                const { initials, colorClass } = getAvatarInfo(r.full_name || 'U')
                return (
                  <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${t.border}` : 'none' }}>
                    <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>{medals[i] ?? `${i + 1}º`}</span>
                    <div className={`${colorClass} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                      {initials}
                    </div>
                    <span style={{ flex: 1, fontSize: '13px', color: t.text, fontWeight: 500 }}>{r.full_name || 'Usuário'}</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.accent, fontWeight: 700 }}>{r.total_earned} pts</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══ RIGHT COLUMN ════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Card — Suas indicações */}
          <div className={CARD}>
            <div className={CARD_HEADER}>
              <Users size={18} className="text-emerald-400" />
              <span className="text-base font-semibold text-white">Suas indicações</span>
              {referrals.length > 0 && (
                <span className="ml-auto bg-white/8 text-white/40 text-xs px-2 py-0.5 rounded-full font-mono">
                  {referrals.length}
                </span>
              )}
            </div>

            {isListLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
                  <Gift size={24} className="text-white/20" />
                </div>
                <p className="text-sm text-white/40 font-medium">Nenhuma indicação ainda.</p>
                <p className="text-xs text-white/30 mt-1">Compartilhe seu link e comece a ganhar!</p>
              </div>
            ) : (
              <div>
                {referrals.map((r) => {
                  const name = r.referred_name || 'Usuário'
                  const { initials, colorClass } = getAvatarInfo(name)
                  const isCredited = r.status === 'credited'
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
                      <div className={`w-9 h-9 rounded-full ${colorClass} flex items-center justify-center text-[12px] font-bold text-white shrink-0`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{name}</p>
                        <p className="text-xs text-white/40">
                          {isCredited ? 'Ativo' : 'Pendente'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {isCredited ? (
                          <span className="text-emerald-400 text-sm font-bold">
                            +{isPro ? `${r.reward_amount || baseReward}` : `R$${((r.reward_amount || baseReward) / 3).toFixed(0)}`}
                          </span>
                        ) : (
                          <span className="text-white/40 text-xs">Aguardando</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Card — Saldo de indicações */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-2">💰 Saldo de indicações</p>
            <p className="text-3xl font-bold text-emerald-400">{balanceLabel}</p>
            <p className="text-xs text-white/50 mt-1">
              Crédito aplicado no próximo pedido automaticamente.
            </p>
          </div>

        </div>
        {/* ══ END RIGHT COLUMN ══════════════════════════════════════ */}
      </div>
    </div>
  )
}
