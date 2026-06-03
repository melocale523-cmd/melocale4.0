// frontend/src/pages/Indicacao.tsx
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Gift, Users, TrendingUp, CheckCircle, Clock, Award, QrCode, Trophy, Zap, Target, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '../store/authStore'
import { apiFetch } from '../lib/api'

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
interface RankingItem {
  position: number
  referrer_id: string
  full_name: string
  avatar_url: string | null
  total: number
}
interface MonthlyStats {
  total_this_month: number
  goal: number
  bonus_credited: boolean
  bonus_coins: number
}
interface BonusConfig {
  multiplier: number
  expires_at: string | null
  label: string | null
}

const STATUS_CONFIG = {
  pending:    { label: 'Aguardando', color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  icon: Clock },
  registered: { label: 'Cadastrou',  color: 'text-blue-400',    bg: 'bg-blue-400/10',    icon: Users },
  converted:  { label: 'Ativou',     color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: TrendingUp },
  credited:   { label: 'Creditado',  color: 'text-green-400',   bg: 'bg-green-400/10',   icon: CheckCircle },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function medalEmoji(pos: number) {
  return pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : String(pos)
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

export default function Indicacao() {
  const user = useAuthStore((state) => state.user)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [generatingStories, setGeneratingStories] = useState(false)

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

  const { data: monthly } = useQuery<MonthlyStats>({
    queryKey: ['referral-monthly', user?.id],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/monthly-stats')
      if (!res.ok) return { total_this_month: 0, goal: 5, bonus_credited: false, bonus_coins: 500 }
      return res.json()
    },
    enabled: !!user,
  })

  const { data: ranking = [] } = useQuery<RankingItem[]>({
    queryKey: ['referral-ranking'],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/ranking')
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
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

  const hasDoubleBonus = (bonusConfig?.multiplier ?? 1) > 1
  const isPro = referralData?.role === 'professional'
  const baseReward = isPro ? 60 : 30
  const effectiveReward = baseReward * (bonusConfig?.multiplier ?? 1)
  const rewardLabel = isPro ? `${effectiveReward} moedas` : `R$${(effectiveReward / 3).toFixed(0)}`
  const rewardDesc = isPro ? 'por indicado que assinar qualquer plano' : 'por indicado que fizer o primeiro pedido'
  const totalEarned = referrals
    .filter(r => r.status === 'credited')
    .reduce((acc, r) => acc + (r.reward_amount || baseReward), 0)

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
    const intro = firstName ? `Olá! Sou ${firstName} e uso` : 'Uso'
    const text = isPro
      ? `${intro} o MeloCalé pra conseguir clientes de serviços domésticos. 🔧\n\nCadastra pelo meu link e você começa a captar clientes hoje!\n\n👉 ${referralData.link}`
      : `${intro} o MeloCalé pra contratar profissionais em casa. 🏠\n\nCria sua conta pelo meu link e encontre o profissional ideal!\n\n👉 ${referralData.link}`
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

      // ── Background ──────────────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, W, H)
      bgGrad.addColorStop(0,   '#020c18')
      bgGrad.addColorStop(0.45,'#041a2e')
      bgGrad.addColorStop(1,   '#03180e')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // Large soft glow circles
      const paintGlow = (x: number, y: number, r: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, color)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
      paintGlow(900,  200, 480, 'rgba(16,185,129,0.10)')
      paintGlow(150, 1700, 400, 'rgba(99,102,241,0.10)')
      paintGlow(540,  960, 600, 'rgba(6,182,212,0.05)')

      // Decorative star dots
      const starPos: [number, number, number][] = [
        [80,130,2],[950,260,2],[200,820,1.5],[1020,700,2],
        [60,1180,1.5],[1010,1420,2],[170,1720,2],[920,1780,1.5],
        [500,400,1.5],[750,1500,2],[300,1100,1],
      ]
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      for (const [sx, sy, sr] of starPos) {
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
      }
      // Emerald accent dots
      ctx.fillStyle = 'rgba(16,185,129,0.7)'
      for (const [sx, sy] of [[310,110],[780,180],[500,1840],[820,1670]]) {
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill()
      }

      // ── Logo ────────────────────────────────────────────────
      ctx.textAlign = 'center'
      ctx.font = 'bold 72px system-ui,sans-serif'
      ctx.fillStyle = '#10b981'
      ctx.fillText('MeloCalé', W / 2, 200)

      // ── Avatar ──────────────────────────────────────────────
      let avatarY = 320
      if (referralData.avatar_url) {
        try {
          const img = await loadImg(referralData.avatar_url)
          const R = 90
          ctx.save()
          ctx.beginPath()
          ctx.arc(W / 2, avatarY + R, R, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, W / 2 - R, avatarY, R * 2, R * 2)
          ctx.restore()
          // Border
          ctx.strokeStyle = 'rgba(16,185,129,0.6)'
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.arc(W / 2, avatarY + R, R, 0, Math.PI * 2)
          ctx.stroke()
          avatarY += R * 2 + 40
        } catch { avatarY = 360 }
      } else {
        avatarY = 320
      }

      // ── Name ────────────────────────────────────────────────
      const firstName = referralData.full_name.split(' ')[0]
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 68px system-ui,sans-serif'
      ctx.fillText(firstName || 'MeloCalé', W / 2, avatarY + 60)

      ctx.fillStyle = '#64748b'
      ctx.font = '40px system-ui,sans-serif'
      ctx.fillText('te convida para o MeloCalé', W / 2, avatarY + 120)

      // ── Divider ─────────────────────────────────────────────
      const divY = avatarY + 170
      const divGrad = ctx.createLinearGradient(120, divY, W - 120, divY)
      divGrad.addColorStop(0,   'transparent')
      divGrad.addColorStop(0.5, 'rgba(16,185,129,0.5)')
      divGrad.addColorStop(1,   'transparent')
      ctx.strokeStyle = divGrad
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(120, divY); ctx.lineTo(W - 120, divY)
      ctx.stroke()

      // ── Reward pill ─────────────────────────────────────────
      const pillY = divY + 60
      ctx.fillStyle = 'rgba(16,185,129,0.12)'
      ctx.beginPath()
      ctx.roundRect(180, pillY, W - 360, 150, 40)
      ctx.fill()
      ctx.strokeStyle = 'rgba(16,185,129,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(180, pillY, W - 360, 150, 40)
      ctx.stroke()

      ctx.fillStyle = '#10b981'
      ctx.font = 'bold 52px system-ui,sans-serif'
      ctx.fillText(`Ganhe ${rewardLabel}`, W / 2, pillY + 68)
      ctx.fillStyle = '#475569'
      ctx.font = '34px system-ui,sans-serif'
      ctx.fillText(rewardDesc, W / 2, pillY + 118)

      // ── Code box ─────────────────────────────────────────────
      const codeY = pillY + 210
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.beginPath()
      ctx.roundRect(250, codeY, W - 500, 120, 24)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(250, codeY, W - 500, 120, 24)
      ctx.stroke()

      ctx.fillStyle = '#94a3b8'
      ctx.font = '34px system-ui,sans-serif'
      ctx.fillText('Código de convite', W / 2, codeY + 46)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 60px monospace'
      ctx.fillText(referralData.code, W / 2, codeY + 106)

      // ── QR Code ──────────────────────────────────────────────
      const qrY = codeY + 170
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(referralData.link)}&bgcolor=ffffff&color=020c18&qzone=2`
        const qrImg = await loadImg(qrUrl)
        const qrSize = 280
        const qrX = (W - qrSize) / 2
        // White rounded background
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24)
        ctx.fill()
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
      } catch { /* skip QR if network unavailable */ }

      const qrEndY = qrY + 340
      ctx.fillStyle = '#334155'
      ctx.font = '32px system-ui,sans-serif'
      ctx.fillText('Escaneie para entrar', W / 2, qrEndY)

      // ── Link ─────────────────────────────────────────────────
      ctx.fillStyle = '#1e3a5f'
      ctx.font = '30px system-ui,sans-serif'
      ctx.fillText(referralData.link, W / 2, qrEndY + 60)

      // ── Bottom divider ───────────────────────────────────────
      const botDivY = qrEndY + 110
      const botGrad = ctx.createLinearGradient(120, botDivY, W - 120, botDivY)
      botGrad.addColorStop(0, 'transparent')
      botGrad.addColorStop(0.5, 'rgba(99,102,241,0.4)')
      botGrad.addColorStop(1, 'transparent')
      ctx.strokeStyle = botGrad
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(120, botDivY); ctx.lineTo(W - 120, botDivY); ctx.stroke()

      // ── Tagline ──────────────────────────────────────────────
      ctx.fillStyle = '#374151'
      ctx.font = '36px system-ui,sans-serif'
      ctx.fillText('Serviços domésticos na palma da sua mão', W / 2, botDivY + 60)
      ctx.font = 'bold 40px system-ui,sans-serif'
      ctx.fillStyle = '#10b981'
      ctx.fillText('melocale.com.br', W / 2, botDivY + 120)

      // ── Download ─────────────────────────────────────────────
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
  }, [referralData, generatingStories, isPro, rewardLabel, rewardDesc])

  return (
    <div className="w-full space-y-3">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-9">
        <div>
          <div className="flex items-center gap-7 mb-7">
            <div className="p-1.5 rounded-lg bg-emerald-400/10">
              <Gift className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">programa de indicações</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-6">Indique e Ganhe</h1>
          <p className="text-slate-400 text-sm">
            Compartilhe seu link. Quando seu indicado ativar, você recebe{' '}
            <span className="text-emerald-400 font-semibold">{rewardLabel}</span> {rewardDesc}.
          </p>
        </div>
        {hasDoubleBonus && (
          <div className="shrink-0 bg-yellow-400/15 border border-yellow-400/30 rounded-2xl px-9 py-8 text-center">
            <div className="text-yellow-400 text-xs font-black uppercase tracking-wider flex items-center gap-6">
              <Zap size={12} className="fill-yellow-400" /> Bônus {bonusConfig!.multiplier}×
            </div>
            <div className="text-yellow-300 text-[10px] mt-0.5">
              {bonusConfig?.label ?? 'ativo agora!'}
            </div>
            {bonusConfig?.expires_at && (
              <div className="text-slate-500 text-[9px] mt-0.5">
                até {new Date(bonusConfig.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Two-column grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-11">

        {/* ════ LEFT COLUMN ════ */}
        <div className="space-y-10">

          {/* Link card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            <div className="flex items-center gap-7 mb-9">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Seu link de indicação</span>
            </div>

            {loadingCode ? (
              <div className="space-y-8">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-8 bg-white/5 rounded-xl animate-pulse w-1/2" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-7 bg-[#0c1829] border border-white/8 rounded-xl px-9 py-8 mb-8">
                  <span className="text-slate-400 text-xs flex-1 truncate font-mono">{referralData?.link ?? '—'}</span>
                  <button onClick={copyLink} className="flex items-center gap-1.5 bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/30 text-emerald-400 text-xs font-semibold px-8 py-1.5 rounded-lg transition-colors shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="flex items-center gap-8 mb-9">
                  <span className="text-xs text-slate-500">Código:</span>
                  <span className="font-mono font-bold text-lg text-white tracking-widest bg-white/5 px-9 py-6 rounded-lg border border-white/8">
                    {referralData?.code ?? '—'}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-7 mb-7">
                  <button onClick={copyLink} className="flex items-center justify-center gap-7 bg-white/8 hover:bg-white/12 border border-white/10 text-white text-sm font-medium py-8 rounded-xl transition-colors">
                    <Copy size={15} /> Copiar link
                  </button>
                  <button onClick={shareWhatsApp} className="flex items-center justify-center gap-7 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-sm font-semibold py-8 rounded-xl transition-colors">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-7">
                  <button onClick={() => setShowQr(v => !v)} className="flex items-center justify-center gap-7 bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 text-sm py-2.5 rounded-xl transition-colors">
                    <QrCode size={14} /> {showQr ? 'Ocultar QR' : 'QR Code'}
                  </button>
                  <button
                    onClick={generateStoriesImage}
                    disabled={generatingStories}
                    className="flex items-center justify-center gap-7 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Share2 size={14} /> {generatingStories ? 'Gerando…' : 'Stories'}
                  </button>
                </div>

                {showQr && referralData?.link && (
                  <div className="mt-9 flex flex-col items-center gap-7 bg-white p-10 rounded-2xl">
                    <QRCodeSVG value={referralData.link} size={180} bgColor="#ffffff" fgColor="#060d1a" level="M" />
                    <p className="text-[#060d1a] text-xs font-mono font-bold">{referralData.code}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* How it works */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-10">
            <h3 className="text-sm font-semibold text-white mb-9 flex items-center gap-7">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Como funciona
            </h3>
            <div className="space-y-9">
              {[
                { step: '1', title: 'Compartilhe seu link', desc: `Envie para outros ${isPro ? 'profissionais' : 'clientes'} pelo WhatsApp, Instagram ou onde quiser.`, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                { step: '2', title: 'Indicado se cadastra', desc: 'Quando alguém criar a conta com seu link, você aparece no nosso radar.', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                { step: '3', title: `Você ganha ${rewardLabel}`, desc: isPro ? 'Assim que o indicado assinar qualquer plano, as moedas caem na sua carteira.' : 'Quando o indicado fizer o primeiro pedido, o crédito é adicionado.', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                { step: '🔗', title: 'Bônus em cascata', desc: 'Quando seu indicado indica alguém, você ganha mais 20 moedas automaticamente!', color: 'text-purple-400', bg: 'bg-purple-400/10' },
              ].map(({ step, title, desc, color, bg }) => (
                <div key={step} className="flex gap-8">
                  <div className={`w-7 h-7 rounded-full ${bg} ${color} flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}>{step}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="space-y-10">

          {/* Stats */}
          {referralData && (
            <div className="grid grid-cols-3 gap-8">
              <div className="bg-white/5 border border-white/8 rounded-2xl p-9 text-center">
                <div className="text-2xl font-bold font-mono text-white">{referralData.stats.total}</div>
                <div className="text-xs text-slate-500 mt-6">enviados</div>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-2xl p-9 text-center">
                <div className="text-2xl font-bold font-mono text-blue-400">{referralData.stats.registered}</div>
                <div className="text-xs text-slate-500 mt-6">cadastraram</div>
              </div>
              <div className="bg-emerald-400/8 border border-emerald-400/20 rounded-2xl p-9 text-center">
                <div className="text-2xl font-bold font-mono text-emerald-400">{totalEarned}</div>
                <div className="text-xs text-slate-500 mt-6">{isPro ? 'moedas' : 'créditos'}</div>
              </div>
            </div>
          )}

          {/* Monthly goal */}
          {monthly && (
            <div className="bg-white/5 border border-white/8 rounded-2xl p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-7">
                  <Target size={15} className="text-purple-400" />
                  <span className="text-sm font-semibold text-white">Meta do mês</span>
                </div>
                {monthly.bonus_credited ? (
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-7 py-0.5 rounded-full">500 moedas ✓</span>
                ) : (
                  <span className="text-[10px] text-slate-500">{monthly.total_this_month}/{monthly.goal}</span>
                )}
              </div>
              <div className="w-full bg-white/8 rounded-full h-2 mb-7">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (monthly.total_this_month / monthly.goal) * 100)}%`,
                    background: monthly.bonus_credited
                      ? '#10b981'
                      : 'linear-gradient(90deg, #818cf8, #a78bfa)',
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {monthly.bonus_credited
                  ? 'Parabéns! Você já ganhou o bônus de 500 moedas este mês.'
                  : `Mais ${monthly.goal - monthly.total_this_month} indicação${monthly.goal - monthly.total_this_month !== 1 ? 'ões' : ''} para ganhar 500 moedas bônus!`}
              </p>
            </div>
          )}

          {/* Ranking */}
          {ranking.length > 0 && (
            <div className="bg-white/3 border border-white/8 rounded-2xl p-10">
              <h3 className="text-sm font-semibold text-white mb-9 flex items-center gap-7">
                <Trophy className="w-4 h-4 text-yellow-400" /> Top indicadores do mês
              </h3>
              <div className="space-y-7">
                {ranking.map((r) => {
                  const isMe = r.referrer_id === user?.id
                  return (
                    <div key={r.referrer_id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isMe ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-white/4'}`}>
                      <span className="text-sm font-black w-6 text-center">{medalEmoji(r.position)}</span>
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt={r.full_name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                          {r.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 text-sm text-white font-medium truncate">
                        {r.full_name}{isMe && <span className="text-emerald-400 text-xs ml-1">(você)</span>}
                      </span>
                      <span className="text-sm font-mono font-bold text-slate-300 shrink-0">{r.total}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Referral history */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-8 flex items-center gap-7">
              <Users className="w-4 h-4 text-slate-400" /> Suas indicações
              {referrals.length > 0 && (
                <span className="bg-white/8 text-slate-400 text-xs px-7 py-0.5 rounded-full font-mono">{referrals.length}</span>
              )}
            </h3>
            {loadingList ? (
              <div className="space-y-7">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}
              </div>
            ) : referrals.length === 0 ? (
              <div className="bg-white/3 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                <Gift className="w-8 h-8 text-slate-600 mx-auto mb-8" />
                <p className="text-slate-500 text-sm">Nenhuma indicação ainda.<br />Compartilhe seu link e comece a ganhar!</p>
              </div>
            ) : (
              <div className="space-y-7">
                {referrals.map((r) => {
                  const cfg = STATUS_CONFIG[r.status]
                  const Icon = cfg.icon
                  return (
                    <div key={r.id} className="flex items-center gap-8 bg-white/4 border border-white/8 rounded-xl px-9 py-8">
                      {r.referred_avatar ? (
                        <img src={r.referred_avatar} alt={r.referred_name ?? ''} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className={`p-1.5 rounded-lg ${cfg.bg} shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{r.referred_name ?? 'Usuário'}</div>
                        <div className="text-xs text-slate-600">{fmtDate(r.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-semibold ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-full`}>{cfg.label}</div>
                        {r.status === 'credited' && (
                          <div className="text-xs text-emerald-400 font-mono mt-6">+{r.reward_amount || baseReward}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
        {/* ════ END RIGHT COLUMN ════ */}
      </div>
    </div>
  )
}
