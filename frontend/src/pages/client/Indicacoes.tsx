import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '../../hooks/useIsMobile'
import { toast } from 'sonner'
import {
  Link2, Copy, MessageCircle, QrCode, Share2,
  BarChart2, Info, Users, Gift, Loader2, Zap, Trophy, Coins, Target, Star, X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '../../store/authStore'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'

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
  const isMobile = useIsMobile()
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

  const { data: coinHistory = [] } = useQuery<{
    id: string; amount: number; kind: string; balance_after: number; created_at: string
  }[]>({
    queryKey: ['clientCoinHistory'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/transactions')
      if (!res.ok) return []
      return res.json()
    },
    enabled: authReady,
    staleTime: 30 * 1000,
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

  const queryClient = useQueryClient()
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('CPF')

  // Inline withdrawal state
  const [coinsAmount, setCoinsAmount] = useState('1000')
  const [inlinePixKey, setInlinePixKey] = useState('')
  const [inlinePixKeyType, setInlinePixKeyType] = useState('CPF')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  interface WithdrawalHistoryItem {
    id: string
    coins_amount: number
    brl_amount: number
    pix_key: string
    pix_key_type: string
    status: 'pending' | 'approved' | 'paid' | 'rejected'
    admin_note: string | null
    requested_at: string
    processed_at: string | null
  }

  const { data: withdrawalHistory = [] } = useQuery<WithdrawalHistoryItem[]>({
    queryKey: ['withdrawalHistory', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('id, coins_amount, brl_amount, pix_key, pix_key_type, status, admin_note, requested_at, processed_at')
        .order('requested_at', { ascending: false })
      if (error) return []
      return (data ?? []) as WithdrawalHistoryItem[]
    },
    enabled: authReady,
  })

  const hasPendingWithdrawal = withdrawalHistory.some(w => w.status === 'pending' || w.status === 'approved')

  const inlineWithdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(coinsAmount, 10)
      if (isNaN(amount) || amount < 1000) throw new Error('Mínimo de 1.000 moedas para sacar.')
      if (amount > (coinsData?.balance ?? 0)) throw new Error('Saldo insuficiente.')
      if (!inlinePixKey.trim()) throw new Error('Informe sua chave Pix.')
      const { error } = await supabase.rpc('request_withdrawal', {
        p_coins_amount: amount,
        p_pix_key: inlinePixKey.trim(),
        p_pix_key_type: inlinePixKeyType,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Solicitação de saque enviada! Em breve você receberá o valor via Pix. 🎉')
      setCoinsAmount('1000')
      setInlinePixKey('')
      setWithdrawError(null)
      queryClient.invalidateQueries({ queryKey: ['clientCoins'] })
      queryClient.invalidateQueries({ queryKey: ['withdrawalHistory'] })
    },
    onError: (err: Error) => {
      setWithdrawError(err.message)
      toast.error(err.message)
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pix_key: pixKey, pix_key_type: pixKeyType }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error === 'insufficient_balance' ? 'Saldo insuficiente. Mínimo: 1.000 moedas (R$10).' : err.error ?? 'Erro ao processar saque.')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Pix enviado! Em instantes cai na sua conta. 🎉')
      setShowWithdrawModal(false)
      setPixKey('')
      queryClient.invalidateQueries({ queryKey: ['clientCoins'] })
    },
    onError: (err: Error) => toast.error(err.message),
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

  function kindLabel(kind: string): { icon: string; label: string } {
    const map: Record<string, { icon: string; label: string }> = {
      referral_signup:  { icon: '🔗', label: 'Cadastro via indicação' },
      referral_order:   { icon: '🛒', label: 'Pedido de indicado' },
      first_order:      { icon: '🎉', label: 'Primeiro pedido' },
      profile_complete: { icon: '📋', label: 'Perfil completo' },
      review:           { icon: '⭐', label: 'Avaliação enviada' },
      mission:          { icon: '🏆', label: 'Missão do mês' },
      withdrawal:       { icon: '💸', label: 'Saque via Pix' },
      withdrawal_refund:{ icon: '↩️', label: 'Estorno de saque' },
      test:             { icon: '🧪', label: 'Teste' },
    }
    return map[kind] ?? { icon: '🪙', label: kind }
  }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', padding: '1.5rem', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

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

        {/* ── Como ganhar moedas (largura total) */}
          <div style={{ ...cardBase, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Coins size={17} color={t.accent} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Como ganhar moedas</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: t.muted }}>100 moedas = R$1,00 · mín. 1.000 para sacar</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: '8px' }}>
              {[
                { icon: '🎉', label: 'Primeiro pedido', coins: 100 },
                { icon: '📋', label: 'Completar perfil', coins: 50 },
                { icon: '⭐', label: 'Avaliar profissional', coins: 30 },
                { icon: '🔗', label: 'Cadastro via indicação', coins: 20 },
                { icon: '💰', label: 'Indicar amigo (ele faz pedido)', coins: 200 },
              ].map(({ icon, label, coins }) => (
                <div key={label} style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
                  <div style={{ fontSize: '11px', color: t.text, fontWeight: 600, marginBottom: '6px', lineHeight: 1.3 }}>{label}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.accent, fontWeight: 700, background: '#0b2818', border: '1px solid #10b98140', borderRadius: '999px', padding: '2px 8px', display: 'inline-block' }}>+{coins}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Top indicadores (largura total) */}
          {ranking.length > 0 && (
            <div style={{ ...cardBase, borderTop: '3px solid #f59e0b', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Trophy size={17} color="#f59e0b" />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Top indicadores do mês</span>
                <button
                  onClick={() => setShowRankingModal(true)}
                  style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: t.muted, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                >
                  Ver todos →
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {ranking.slice(0, 3).map((r, i) => {
                  const medals = ['🥇', '🥈', '🥉']
                  const { initials, colorClass } = getAvatarInfo(r.full_name || 'U')
                  return (
                    <div key={r.user_id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '8px 10px' }}>
                      <span style={{ fontSize: '16px' }}>{medals[i]}</span>
                      <div className={`${colorClass} w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>{initials}</div>
                      <span style={{ flex: 1, fontSize: '12px', color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name || 'Usuário'}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: t.accent, fontWeight: 700 }}>{r.total_earned}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        {/* ── Barra de progresso 3 cards ─────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '12px', marginBottom: '1.5rem' }}>

          {/* Card — Suas moedas */}
          <div style={{ background: '#0b2818', border: '1px solid #10b981', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Coins size={15} color="#10b981" />
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#10b981' }}>Suas moedas</span>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
              {coinsData?.balance ?? 0}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                R${((coinsData?.balance ?? 0) / 100).toFixed(2).replace('.', ',')}
              </span>
              <span style={{ fontSize: '10px', color: '#4ade80' }}>em reais · mín. R$10 p/ sacar</span>
            </div>
            <div style={{ marginTop: '10px', background: '#1C3050', borderRadius: '100px', height: '6px' }}>
              <div style={{ background: '#10b981', borderRadius: '100px', height: '6px', width: `${Math.min(((coinsData?.balance ?? 0) / 1000) * 100, 100)}%`, transition: 'width .5s' }} />
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              {Math.max(1000 - (coinsData?.balance ?? 0), 0)} moedas para o saque
            </div>
            {(() => {
              const hasEnough = (coinsData?.balance ?? 0) >= 1000
              return (
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  style={{
                    marginTop: '12px', width: '100%',
                    background: hasEnough ? '#10b981' : '#1C3050',
                    color: hasEnough ? '#fff' : '#64748b',
                    border: hasEnough ? 'none' : '1px solid #243F6A',
                    borderRadius: '8px', padding: '8px 0', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {hasEnough ? '💸 Sacar via Pix' : '💸 Sacar via Pix · faltam ' + Math.max(1000 - (coinsData?.balance ?? 0), 0) + ' moedas'}
                </button>
              )
            })()}
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
              <div style={{ background: monthlyStats?.bonus_credited ? '#10b981' : '#7c3aed', borderRadius: '100px', height: '6px', width: `${Math.min(((monthlyStats?.total_this_month ?? 0) / (monthlyStats?.goal ?? 5)) * 100, 100)}%`, transition: 'width .5s' }} />
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

          {/* Card — Seu indicado também ganha */}
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

        {/* ── Inline Withdrawal ─────────────────────────────────── */}
        <div style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderLeft: '4px solid #1D9E75',
          borderRadius: '1rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Coins size={17} color="#1D9E75" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Sacar moedas via Pix</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: t.muted }}>100 moedas = R$1,00 · mín. 1.000</span>
          </div>

          {(coinsData?.balance ?? 0) < 1000 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0d1929', border: '1px solid #1C3050', borderRadius: '8px', padding: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>🪙</span>
              <div>
                <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600 }}>Saldo insuficiente para saque</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Você tem <span style={{ color: '#f59e0b', fontWeight: 700 }}>{coinsData?.balance ?? 0}</span> moedas.
                  Faltam <span style={{ color: '#10b981', fontWeight: 700 }}>{Math.max(1000 - (coinsData?.balance ?? 0), 0)}</span> para sacar.
                </div>
              </div>
            </div>
          ) : hasPendingWithdrawal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', padding: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>⏳</span>
              <div>
                <div style={{ fontSize: '13px', color: '#fde047', fontWeight: 600 }}>Saque em andamento</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Aguarde o processamento do saque atual antes de solicitar outro.</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                {/* Amount */}
                <div>
                  <label style={{ fontSize: '12px', color: t.muted, display: 'block', marginBottom: '6px' }}>Quantidade de moedas</label>
                  <input
                    type="number"
                    value={coinsAmount}
                    min={1000}
                    max={coinsData?.balance ?? 0}
                    onChange={e => { setCoinsAmount(e.target.value); setWithdrawError(null) }}
                    style={{ width: '100%', background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '10px 12px', color: t.text, fontSize: '13px', fontFamily: 'DM Mono, monospace', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#1D9E75', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>
                    = R${(Math.max(parseInt(coinsAmount, 10) || 0, 0) / 100).toFixed(2).replace('.', ',')}
                  </div>
                </div>
                {/* Pix type */}
                <div>
                  <label style={{ fontSize: '12px', color: t.muted, display: 'block', marginBottom: '6px' }}>Tipo de chave Pix</label>
                  <select
                    value={inlinePixKeyType}
                    onChange={e => setInlinePixKeyType(e.target.value)}
                    style={{ width: '100%', background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '10px 12px', color: t.text, fontSize: '13px', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PHONE">Telefone</option>
                    <option value="EVP">Chave aleatória</option>
                  </select>
                </div>
                {/* Pix key */}
                <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
                  <label style={{ fontSize: '12px', color: t.muted, display: 'block', marginBottom: '6px' }}>Chave Pix</label>
                  <input
                    type="text"
                    value={inlinePixKey}
                    onChange={e => { setInlinePixKey(e.target.value); setWithdrawError(null) }}
                    placeholder={inlinePixKeyType === 'CPF' ? '000.000.000-00' : inlinePixKeyType === 'EMAIL' ? 'seu@email.com' : inlinePixKeyType === 'PHONE' ? '+5511999999999' : inlinePixKeyType === 'CNPJ' ? '00.000.000/0001-00' : 'chave aleatória (EVP)'}
                    style={{ width: '100%', background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '10px 12px', color: t.text, fontSize: '13px', fontFamily: 'DM Mono, monospace', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {withdrawError && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', fontSize: '12px', color: '#f87171' }}>
                  ⚠️ {withdrawError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: '11px', color: t.muted }}>
                  ⚠️ Verifique a chave antes de confirmar. O saque é processado em até 24h.
                </div>
                <button
                  onClick={() => inlineWithdrawMutation.mutate()}
                  disabled={!inlinePixKey.trim() || inlineWithdrawMutation.isPending}
                  style={{
                    flexShrink: 0, background: inlineWithdrawMutation.isPending ? '#0d6e4f' : '#1D9E75',
                    color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px',
                    fontSize: '13px', fontWeight: 700, cursor: !inlinePixKey.trim() || inlineWithdrawMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: !inlinePixKey.trim() ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
                  }}
                >
                  {inlineWithdrawMutation.isPending ? '⏳ Enviando…' : '💸 Solicitar saque'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Withdrawal History ─────────────────────────────────── */}
        {withdrawalHistory.length > 0 && (
          <div style={{ ...cardBase, marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Coins size={17} color={t.muted} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Histórico de saques</span>
              <span style={{ marginLeft: 'auto', background: t.border, color: t.muted, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontFamily: 'DM Mono, monospace' }}>
                {withdrawalHistory.length}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {['Data', 'Moedas', 'Valor R$', 'Chave Pix', 'Status', 'Nota'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: t.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawalHistory.map((w, i) => {
                    const statusColors: Record<string, { bg: string; color: string; label: string }> = {
                      pending:  { bg: 'rgba(234,179,8,0.1)',   color: '#fde047', label: '⏳ Pendente'  },
                      approved: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', label: '✅ Aprovado'  },
                      paid:     { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', label: '💸 Pago'       },
                      rejected: { bg: 'rgba(248,113,113,0.1)', color: '#f87171', label: '❌ Rejeitado' },
                    }
                    const s = statusColors[w.status] ?? statusColors.pending
                    return (
                      <tr key={w.id} style={{ borderBottom: i < withdrawalHistory.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                        <td style={{ padding: '8px 10px', color: t.muted, whiteSpace: 'nowrap' }}>
                          {new Date(w.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'DM Mono, monospace', color: t.text, fontWeight: 700 }}>
                          {w.coins_amount.toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'DM Mono, monospace', color: '#1D9E75', fontWeight: 700 }}>
                          R${(w.brl_amount ?? (w.coins_amount / 100)).toFixed(2).replace('.', ',')}
                        </td>
                        <td style={{ padding: '8px 10px', color: t.subtle, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>{w.pix_key}</span>
                          <span style={{ marginLeft: '4px', fontSize: '9px', color: t.muted, background: t.input, padding: '1px 5px', borderRadius: '4px' }}>{w.pix_key_type}</span>
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: t.muted, fontSize: '11px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {w.admin_note ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 2-column grid ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

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
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '10px' }}>
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

          {/* Card — Histórico de moedas */}
          {coinHistory.length > 0 && (
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <BarChart2 size={17} color={t.accent} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Histórico de moedas</span>
                <span style={{ marginLeft: 'auto', background: t.border, color: t.muted, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontFamily: 'DM Mono, monospace' }}>
                  {coinHistory.length}
                </span>
              </div>
              {coinHistory.slice(0, 10).map((tx, i) => {
                const { icon, label } = kindLabel(tx.kind)
                const isCredit = tx.amount > 0
                return (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < coinHistory.slice(0, 10).length - 1 ? `1px solid ${t.border}` : 'none' }}>
                    <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: t.text, fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: '10px', color: t.muted }}>
                        {new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 700, color: isCredit ? t.accent : '#f87171' }}>
                      {isCredit ? '+' : ''}{tx.amount}
                    </span>
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


          </div>
          {/* ══ END RIGHT COLUMN ════════════════════════════════════ */}
        </div>


      </div>

      {showRankingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#132236', border: '1px solid #1C3050', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>🏆 Top indicadores do mês</span>
              <button onClick={() => setShowRankingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {ranking.slice(0, 100).map((r, i) => {
                const medals = ['🥇', '🥈', '🥉']
                const { initials, colorClass } = getAvatarInfo(r.full_name || 'U')
                return (
                  <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: '16px', width: '28px', textAlign: 'center' }}>{medals[i] ?? `${i + 1}º`}</span>
                    <div className={`${colorClass} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>{initials}</div>
                    <span style={{ flex: 1, fontSize: '13px', color: t.text, fontWeight: 500 }}>{r.full_name || 'Usuário'}</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.accent, fontWeight: 700 }}>{r.total_earned} pts</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#132236', border: '1px solid #1C3050', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '420px', fontFamily: 'DM Sans, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>💸 Sacar via Pix</span>
              <button onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            {(coinsData?.balance ?? 0) >= 1000 ? (
              <>
                <div style={{ background: '#0b2818', border: '1px solid #10b981', borderRadius: '8px', padding: '12px', marginBottom: '1rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                    R${((coinsData?.balance ?? 0) / 100).toFixed(2).replace('.', ',')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#4ade80' }}>{coinsData?.balance ?? 0} moedas disponíveis</div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Tipo de chave Pix</label>
                  <select
                    value={pixKeyType}
                    onChange={e => setPixKeyType(e.target.value)}
                    style={{ width: '100%', background: '#0d1929', border: '1px solid #1C3050', borderRadius: '8px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    <option value="CPF">CPF</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PHONE">Telefone</option>
                    <option value="EVP">Chave aleatória</option>
                    <option value="CNPJ">CNPJ</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Chave Pix</label>
                  <input
                    type="text"
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    placeholder={pixKeyType === 'CPF' ? '000.000.000-00' : pixKeyType === 'EMAIL' ? 'seu@email.com' : pixKeyType === 'PHONE' ? '+5500000000000' : 'sua chave Pix'}
                    style={{ width: '100%', background: '#0d1929', border: '1px solid #1C3050', borderRadius: '8px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'DM Mono, monospace', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '1rem', padding: '8px', background: '#0d1929', borderRadius: '6px' }}>
                  ⚠️ O Pix será enviado instantaneamente. Verifique a chave antes de confirmar.
                </div>
                <button
                  onClick={() => withdrawMutation.mutate()}
                  disabled={!pixKey || withdrawMutation.isPending}
                  style={{
                    width: '100%', background: withdrawMutation.isPending ? '#065f46' : '#10b981',
                    color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 0',
                    fontSize: '14px', fontWeight: 700, cursor: pixKey ? 'pointer' : 'not-allowed',
                    opacity: pixKey ? 1 : 0.5, fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {withdrawMutation.isPending ? 'Processando...' : 'Confirmar saque'}
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🪙</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>
                  {coinsData?.balance ?? 0}/1000
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Você precisa de <span style={{ color: '#10b981', fontWeight: 700 }}>1.000 moedas</span> para sacar.<br/>
                  Faltam <span style={{ color: '#f59e0b', fontWeight: 700 }}>{Math.max(1000 - (coinsData?.balance ?? 0), 0)} moedas</span>.
                </div>
                <div style={{ background: '#1C3050', borderRadius: '100px', height: '8px', marginBottom: '16px' }}>
                  <div style={{ background: '#f59e0b', borderRadius: '100px', height: '8px', width: `${Math.min(((coinsData?.balance ?? 0) / 1000) * 100, 100)}%`, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', background: '#0d1929', borderRadius: '8px', padding: '12px' }}>
                  💡 Indique amigos e ganhe <span style={{ color: '#10b981', fontWeight: 700 }}>R$2 por indicação</span>.<br/>
                  Com 5 indicações você já pode sacar!
                </div>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                >
                  Entendi, vou indicar amigos!
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
