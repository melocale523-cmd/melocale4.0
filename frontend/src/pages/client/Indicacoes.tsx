import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Link2, Copy, MessageCircle, QrCode, Share2,
  BarChart2, Info, Users, Gift, Loader2, Zap, Trophy, Coins, Target, Star,
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

// ── Design tokens ─────────────────────────────────────────────────────
const t = {
  bg: '#070f1c',
  section: '#0a1928',
  card: '#132236',
  input: '#0d1929',
  border: '#1C3050',
  accent: '#10b981',
  accentBg: 'rgba(16,185,129,0.08)',
  accentBorder: 'rgba(16,185,129,0.25)',
  text: '#f1f5f9',
  muted: '#64748b',
  subtle: '#94a3b8',
}

const cardBase: React.CSSProperties = {
  background: t.card,
  border: `1px solid ${t.border}`,
  borderTop: `3px solid ${t.accent}`,
  borderRadius: '1rem',
  padding: '1.25rem',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'transform .25s',
}

const kpiCard: React.CSSProperties = {
  background: t.input,
  border: `1px solid ${t.border}`,
  borderRadius: '8px',
  padding: '1rem .75rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
}

// ── Component ─────────────────────────────────────────────────────────
export default function ClientIndicacoes() {
  const user = useAuthStore((state) => state.user)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [generatingStories, setGeneratingStories] = useState(false)

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

  const { data: coinsData } = useQuery({
    queryKey: ['clientCoins'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/balance')
      if (!res.ok) return { balance: 0, total_earned: 0 }
      return res.json()
    },
    enabled: authReady,
  })

  const { data: monthlyStats } = useQuery({
    queryKey: ['referral-monthly-stats'],
    queryFn: async () => {
      const res = await apiFetch('/api/referrals/monthly-stats')
      if (!res.ok) return { total_this_month: 0, goal: 5, bonus_credited: false, bonus_coins: 500 }
      return res.json()
    },
    enabled: authReady,
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

  const isEffectivelyLoading = isAuthLoading || loadingCode
  const isListLoading = isAuthLoading || loadingList

  const hasDoubleBonus = (bonusConfig?.multiplier ?? 1) > 1
  const isPro = referralData?.role === 'professional'
  const baseReward = isPro ? 60 : 6
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
    <div style={{ background: t.bg, minHeight: '100vh', padding: '1.5rem', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: t.accentBg, border: `1px solid ${t.accentBorder}`,
              borderRadius: '999px', padding: '4px 12px', marginBottom: '12px',
            }}>
              <span style={{ fontSize: '14px', lineHeight: 1 }}>🎁</span>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: t.accent }}>
                Programa de Indicações
              </span>
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 900, color: t.text, margin: '0 0 8px' }}>
              Indique e Ganhe
            </h1>
            <p style={{ color: t.muted, fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              Compartilhe seu link. Quando seu indicado ativar, você recebe{' '}
              <span style={{ color: t.accent, fontWeight: 700 }}>{rewardLabel}</span>{' '}
              {rewardDesc}.
            </p>
          </div>

          {hasDoubleBonus && (
            <div style={{
              flexShrink: 0,
              background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: '1rem', padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ color: '#facc15', fontSize: '11px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={11} style={{ fill: '#facc15' }} /> Bônus {bonusConfig!.multiplier}×
              </div>
              <div style={{ color: '#fde047', fontSize: '10px', marginTop: '2px' }}>
                {bonusConfig?.label ?? 'ativo agora!'}
              </div>
              {bonusConfig?.expires_at && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginTop: '2px' }}>
                  até {new Date(bonusConfig.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 2-column grid ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

          {/* ══ LEFT COLUMN ════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

            {/* Card 1 — Seu link de indicação */}
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Link2 size={17} color={t.accent} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Seu link de indicação</span>
              </div>

              {isEffectivelyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[44, 36, 96].map(h => (
                    <div key={h} style={{ height: h, background: 'rgba(255,255,255,0.05)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : codeError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '1.5rem 0', textAlign: 'center' }}>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>Não foi possível carregar o seu link.</p>
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', margin: 0 }}>Verifique sua conexão e recarregue a página.</p>
                </div>
              ) : (
                <>
                  {/* Link box */}
                  <div style={{
                    background: t.input, border: `1px solid ${t.border}`, borderRadius: '10px',
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
                  }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {referralData?.link ?? '—'}
                    </span>
                    <button
                      onClick={copyLink}
                      disabled={!referralData?.link}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: t.accent, color: '#fff', fontSize: '13px', fontWeight: 700,
                        padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                        flexShrink: 0, transition: 'opacity .2s', opacity: referralData?.link ? 1 : 0.4,
                        fontFamily: 'DM Sans, sans-serif',
                      }}
                    >
                      <Copy size={12} />
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>

                  {/* Code */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{ color: t.muted, fontSize: '13px' }}>Código:</span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '15px', color: t.text,
                      background: t.input, border: `1px solid ${t.border}`, borderRadius: '6px',
                      padding: '4px 12px', letterSpacing: '.12em',
                    }}>
                      {referralData?.code ?? '—'}
                    </span>
                  </div>

                  {/* Share buttons 2×2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* WhatsApp */}
                    <button
                      onClick={shareWhatsApp}
                      disabled={!referralData?.link}
                      style={{
                        borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)',
                        color: '#25D366', fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                        opacity: referralData?.link ? 1 : 0.4,
                      }}
                    >
                      <MessageCircle size={15} /> WhatsApp
                    </button>
                    {/* Copiar link */}
                    <button
                      onClick={copyLink}
                      disabled={!referralData?.link}
                      style={{
                        borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        background: t.input, border: `1px solid ${t.border}`,
                        color: t.subtle, fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                        opacity: referralData?.link ? 1 : 0.4,
                      }}
                    >
                      <Copy size={15} /> Copiar link
                    </button>
                    {/* QR Code */}
                    <button
                      onClick={() => setShowQr(v => !v)}
                      disabled={!referralData?.link}
                      style={{
                        borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        background: t.input, border: `1px solid ${t.border}`,
                        color: t.subtle, fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                        opacity: referralData?.link ? 1 : 0.4,
                      }}
                    >
                      <QrCode size={15} /> {showQr ? 'Ocultar QR' : 'QR Code'}
                    </button>
                    {/* Stories */}
                    <button
                      onClick={generateStoriesImage}
                      disabled={generatingStories || !referralData?.link}
                      style={{
                        borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        background: 'rgba(45,31,78,0.6)', border: '1px solid rgba(109,40,217,0.25)',
                        color: '#a78bfa', fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                        opacity: (!generatingStories && referralData?.link) ? 1 : 0.5,
                      }}
                    >
                      {generatingStories ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={15} />}
                      {generatingStories ? 'Gerando…' : 'Stories'}
                    </button>
                  </div>

                  {/* QR panel */}
                  {showQr && referralData?.link && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: '#ffffff', borderRadius: '12px', padding: '24px' }}>
                      <QRCodeSVG value={referralData.link} size={160} bgColor="#ffffff" fgColor="#060d1a" level="M" />
                      <p style={{ color: '#060d1a', fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 700, margin: 0 }}>{referralData.code}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Card 2 — Seus resultados */}
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <BarChart2 size={17} color={t.accent} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Seus resultados</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                <div style={kpiCard}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: t.text }}>
                    {referralData?.stats.total ?? 0}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.muted }}>Indicados</span>
                </div>
                <div style={kpiCard}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
                    {referralData?.stats.converted ?? 0}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.muted }}>Ativos</span>
                </div>
                <div style={kpiCard}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: t.accent }}>
                    {isPro ? totalEarned : `R$${(totalEarned / 3).toFixed(0)}`}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.muted }}>Ganhos</span>
                </div>
              </div>
            </div>

            {/* Card 3 — Como funciona */}
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Info size={17} color={t.accent} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Como funciona</span>
              </div>
              <div>
                {[
                  {
                    step: '1',
                    title: 'Compartilhe seu link',
                    desc: `Envie para outros ${isPro ? 'profissionais' : 'clientes'} pelo WhatsApp, Instagram ou onde quiser.`,
                    circleStyle: { background: t.accent, color: '#fff' } as React.CSSProperties,
                    isIcon: false,
                  },
                  {
                    step: '2',
                    title: 'Indicado se cadastra',
                    desc: 'Quando alguém criar conta com seu link, você aparece no nosso radar.',
                    circleStyle: { background: t.accent, color: '#fff' } as React.CSSProperties,
                    isIcon: false,
                  },
                  {
                    step: '3',
                    title: `Você ganha ${rewardLabel}`,
                    desc: isPro
                      ? 'Assim que o indicado assinar qualquer plano, as moedas caem na sua carteira.'
                      : 'Quando o indicado fizer o primeiro pedido, o crédito é adicionado.',
                    circleStyle: { background: t.accent, color: '#fff' } as React.CSSProperties,
                    isIcon: false,
                  },
                  {
                    step: 'link',
                    title: 'Bônus em cascata',
                    desc: 'Quando seu indicado indica alguém, você ganha mais automaticamente!',
                    circleStyle: { background: 'rgba(124,58,237,0.15)', color: '#a78bfa' } as React.CSSProperties,
                    isIcon: true,
                  },
                ].map(({ step, title, desc, circleStyle, isIcon }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '2px', fontSize: '11px', fontWeight: 700,
                      ...circleStyle,
                    }}>
                      {isIcon ? <Link2 size={11} /> : step}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: t.text, margin: '0 0 3px' }}>{title}</p>
                      <p style={{ fontSize: '11px', color: t.muted, margin: 0, lineHeight: 1.5 }}>{desc}</p>
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

          {/* ══ RIGHT COLUMN ══════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

            {/* Card — Suas indicações */}
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Users size={17} color={t.accent} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Suas indicações</span>
                {referrals.length > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: t.border, color: t.muted,
                    fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontFamily: 'DM Mono, monospace',
                  }}>
                    {referrals.length}
                  </span>
                )}
              </div>

              {isListLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : referrals.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', textAlign: 'center', gap: '10px' }}>
                  <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Gift size={24} color={t.border} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, margin: 0 }}>Nenhuma indicação ainda.</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>Compartilhe seu link e comece a ganhar!</p>
                </div>
              ) : (
                <div>
                  {referrals.map((r) => {
                    const name = r.referred_name || 'Usuário'
                    const { initials, colorClass } = getAvatarInfo(name)
                    const isCredited = r.status === 'credited'
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                        <div className={`${colorClass} w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: t.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                          <p style={{ fontSize: '11px', color: t.muted, margin: 0 }}>
                            {isCredited ? 'Ativo' : 'Pendente'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {isCredited ? (
                            <span style={{ fontFamily: 'DM Mono, monospace', color: t.accent, fontSize: '13px', fontWeight: 700 }}>
                              +{isPro ? `${r.reward_amount || baseReward}` : `R$${((r.reward_amount || baseReward) / 3).toFixed(0)}`}
                            </span>
                          ) : (
                            <span style={{ color: t.muted, fontSize: '11px' }}>Aguardando</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Card — Saldo de indicações */}
            <div style={{
              background: '#0b2818', border: `1px solid ${t.accent}`,
              borderRadius: '1rem', padding: '1.25rem', fontFamily: 'DM Sans, sans-serif',
            }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: t.accent, margin: '0 0 8px' }}>💰 Saldo de indicações</p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.75rem', fontWeight: 700, color: t.accent, margin: '0 0 4px' }}>
                {balanceLabel}
              </p>
              <p style={{ fontSize: '11px', color: '#4ade80', margin: 0 }}>
                Crédito aplicado no próximo pedido automaticamente.
              </p>
            </div>

            {/* Card — Tiers de bônus */}
            <div style={{
              ...cardBase,
              borderTop: '3px solid #f59e0b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Gift size={17} color="#f59e0b" />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Tiers de bônus</span>
              </div>
              {[
                { label: '🥉 Bronze',   range: '1–4 indicações',   bonus: 'R$2 – R$8',   bg: '#3d200015', border: '#92400e40', color: '#f59e0b' },
                { label: '🥈 Prata',    range: '5–9 indicações',   bonus: 'R$10 – R$18', bg: '#1e293b',   border: '#47556940', color: '#94a3b8' },
                { label: '🥇 Ouro',     range: '10–19 indicações', bonus: 'R$20 – R$38', bg: '#3d290015', border: '#b4530940', color: '#fbbf24' },
                { label: '💎 Diamante', range: '20+ indicações',   bonus: 'R$40+',       bg: '#1a103d',   border: '#6d28d940', color: '#a78bfa' },
              ].map(({ label, range, bonus, bg, border, color }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: '8px', marginBottom: '6px',
                  background: bg, border: `1px solid ${border}`,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color }}>{label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: t.text, fontWeight: 600 }}>{bonus}</div>
                    <div style={{ fontSize: '10px', color: t.muted }}>{range}</div>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${t.border}`, marginTop: '6px', paddingTop: '8px', fontSize: '11px', color: t.muted, textAlign: 'center' }}>
                Quanto mais indica, mais ganha por indicação
              </div>
            </div>


            {/* Card — Suas moedas */}
            <div style={{ background: '#0b2818', border: '1px solid #10b981', borderRadius: '1rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Coins size={15} color="#10b981" />
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#10b981' }}>Suas moedas</span>
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
                {coinsData?.balance ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px' }}>
                = R${((coinsData?.balance ?? 0) / 100).toFixed(2).replace('.', ',')} · mín. 1.000 p/ sacar
              </div>
              <div style={{ marginTop: '10px', background: '#1C3050', borderRadius: '100px', height: '6px' }}>
                <div style={{ background: '#10b981', borderRadius: '100px', height: '6px', width: `${Math.min(((coinsData?.balance ?? 0) / 1000) * 100, 100)}%`, transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                {Math.max(1000 - (coinsData?.balance ?? 0), 0)} moedas para o saque
              </div>
            </div>

            {/* Card — Missão do mês */}
            <div style={{ ...cardBase, borderTop: '3px solid #7c3aed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Target size={15} color="#a78bfa" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>Missão do mês</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#a78bfa' }}>
                  {monthlyStats?.total_this_month ?? 0}/{monthlyStats?.goal ?? 5}
                </span>
              </div>
              <div style={{ background: '#1C3050', borderRadius: '100px', height: '6px', marginBottom: '8px' }}>
                <div style={{
                  background: monthlyStats?.bonus_credited ? '#10b981' : '#7c3aed',
                  borderRadius: '100px', height: '6px',
                  width: `${Math.min(((monthlyStats?.total_this_month ?? 0) / (monthlyStats?.goal ?? 5)) * 100, 100)}%`,
                  transition: 'width .5s',
                }} />
              </div>
              {monthlyStats?.bonus_credited ? (
                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✅ Bônus de {monthlyStats.bonus_coins} moedas creditado!</div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Indique {Math.max((monthlyStats?.goal ?? 5) - (monthlyStats?.total_this_month ?? 0), 0)} pessoas esse mês e ganhe{' '}
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>{monthlyStats?.bonus_coins ?? 500} moedas bônus</span>
                </div>
              )}
            </div>

            {/* Card — O que seu indicado ganha */}
            <div style={{ ...cardBase, borderTop: '3px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Star size={15} color="#f59e0b" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>Seu indicado também ganha</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d1929', borderRadius: '8px', border: '1px solid #1C3050' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>20</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: t.text }}>moedas de boas-vindas</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>ao se cadastrar pelo seu link</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                = R$0,20 de crédito para usar na plataforma
              </div>
            </div>

          </div>
          {/* ══ END RIGHT COLUMN ════════════════════════════════════ */}
        </div>

      </div>
    </div>
  )
}
