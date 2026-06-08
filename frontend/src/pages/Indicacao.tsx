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

  const TIERS = [
    { emoji:'🥉', name:'Bronze',   range:'1–4',  bonus: 0,  color:'#94a3b8', border:'rgba(148,163,184,.2)', bg:'rgba(148,163,184,.04)' },
    { emoji:'🥈', name:'Prata',    range:'5–9',  bonus: 15, color:'#60a5fa', border:'rgba(96,165,250,.2)',  bg:'rgba(96,165,250,.04)'  },
    { emoji:'🥇', name:'Ouro',     range:'10–19',bonus: 30, color:'#fbbf24', border:'rgba(251,191,36,.2)', bg:'rgba(251,191,36,.04)'  },
    { emoji:'💎', name:'Diamante', range:'20+',  bonus: 60, color:'#a78bfa', border:'rgba(167,139,250,.2)',bg:'rgba(167,139,250,.04)' },
  ]
  const currentTier = (referralData?.stats.total ?? 0) >= 20 ? TIERS[3] : (referralData?.stats.total ?? 0) >= 10 ? TIERS[2] : (referralData?.stats.total ?? 0) >= 5 ? TIERS[1] : TIERS[0]
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1] ?? null
  const indToNext = nextTier ? (currentTier.name === 'Bronze' ? 5 : currentTier.name === 'Prata' ? 10 : 20) - (referralData?.stats.total ?? 0) : 0

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
    <div className="w-full space-y-5" style={{ fontFamily:"'DM Sans',sans-serif" }}>

      {/* HERO */}
      <div style={{ background:'linear-gradient(135deg,rgba(16,185,129,.1),rgba(5,150,105,.06))', border:'1px solid rgba(16,185,129,.25)', borderRadius:18, padding:'1.25rem 1.5rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#10b981,#059669)' }} />
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px #10b981', flexShrink:0 }} />
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#34d399' }}>Programa de Indicações — Ativo</p>
            </div>
            <p style={{ fontSize:20, fontWeight:900, color:'white', marginBottom:5 }}>Indique e Ganhe</p>
            <p style={{ fontSize:13, color:'#4A6580' }}>
              <span style={{ color:'#34d399', fontWeight:600 }}>{rewardLabel}</span> por indicação que assinar · Bônus de até <span style={{ color:'#fbbf24', fontWeight:600 }}>+60 moedas extras</span> por mês
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
            {hasDoubleBonus && (
              <div style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.25)', borderRadius:10, padding:'6px 14px', textAlign:'center' }}>
                <p style={{ fontSize:11, fontWeight:700, color:'#fbbf24' }}>⚡ Bônus {bonusConfig!.multiplier}× ativo!</p>
                {bonusConfig?.label && <p style={{ fontSize:10, color:'#4A6580', marginTop:2 }}>{bonusConfig.label}</p>}
              </div>
            )}
            {nextTier && indToNext > 0 && (
              <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.15)', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'#4A6580', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>Você está a</p>
                <p style={{ fontSize:20, fontWeight:900, color:'#fbbf24', lineHeight:1 }}>{indToNext}</p>
                <p style={{ fontSize:11, color:'#4A6580' }}>ind. para {nextTier.emoji} {nextTier.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LINK + KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:12 }}>
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:10 }}>Seu link de indicação</p>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#0d1929', border:'1px solid #1C3050', borderRadius:10, padding:'9px 12px', marginBottom:10 }}>
            <span style={{ fontSize:11, color:'#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>{referralData?.link ?? '—'}</span>
            <button onClick={copyLink} style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)', cursor:'pointer', flexShrink:0 }}>
              <Copy size={11} style={{ marginRight:3 }} />{copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <p style={{ fontSize:12, color:'#4A6580' }}>Código:</p>
            <code style={{ fontFamily:'monospace', fontSize:14, fontWeight:600, color:'white', background:'#0d1929', padding:'3px 10px', borderRadius:6, border:'1px solid #1C3050' }}>{referralData?.code ?? '—'}</code>
          </div>
          <button onClick={shareWhatsApp} style={{ width:'100%', height:40, background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:12, color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 4px 16px rgba(16,185,129,.25)', marginBottom:8 }}>
            Compartilhar no WhatsApp agora →
          </button>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            <button onClick={copyLink} style={{ height:32, background:'#0d1929', border:'1px solid #1C3050', borderRadius:8, color:'#94a3b8', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <Copy size={13} />Copiar
            </button>
            <button onClick={() => setShowQr(v => !v)} style={{ height:32, background:'#0d1929', border:'1px solid #1C3050', borderRadius:8, color:'#94a3b8', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <QrCode size={13} />{showQr ? 'Fechar' : 'QR Code'}
            </button>
            <button onClick={generateStoriesImage} disabled={generatingStories} style={{ height:32, background:'rgba(139,92,246,.1)', border:'1px solid rgba(139,92,246,.2)', borderRadius:8, color:'#a78bfa', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, opacity: generatingStories ? .5 : 1 }}>
              <Share2 size={13} />{generatingStories ? '...' : 'Stories'}
            </button>
          </div>
          {showQr && referralData?.link && (
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:'white', padding:16, borderRadius:12 }}>
              <QRCodeSVG value={referralData.link} size={160} bgColor="#ffffff" fgColor="#060d1a" level="M" />
              <p style={{ color:'#060d1a', fontSize:12, fontFamily:'monospace', fontWeight:700 }}>{referralData.code}</p>
            </div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:12, padding:10, textAlign:'center', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(255,255,255,.1)' }} />
              <p style={{ fontSize:20, fontWeight:900, color:'white', lineHeight:1, marginBottom:3 }}>{referralData?.stats.total ?? 0}</p>
              <p style={{ fontSize:10, color:'#4A6580', textTransform:'uppercase', letterSpacing:'.05em' }}>enviados</p>
            </div>
            <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:12, padding:10, textAlign:'center', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(96,165,250,.3)' }} />
              <p style={{ fontSize:20, fontWeight:900, color:'#60a5fa', lineHeight:1, marginBottom:3 }}>{referralData?.stats.registered ?? 0}</p>
              <p style={{ fontSize:10, color:'#4A6580', textTransform:'uppercase', letterSpacing:'.05em' }}>cadastraram</p>
            </div>
            <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:12, padding:10, textAlign:'center', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(16,185,129,.3)' }} />
              <p style={{ fontSize:20, fontWeight:900, color:'#34d399', lineHeight:1, marginBottom:3 }}>{totalEarned}</p>
              <p style={{ fontSize:10, color:'#4A6580', textTransform:'uppercase', letterSpacing:'.05em' }}>{isPro ? 'moedas' : 'créditos'}</p>
            </div>
          </div>

          <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:14, padding:'1rem', position:'relative', overflow:'hidden', flex:1 }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'white' }}>Nível atual</p>
              <div style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(148,163,184,.08)', color: currentTier.color, border:`1px solid ${currentTier.border}` }}>{currentTier.emoji} {currentTier.name}</div>
            </div>
            <div style={{ height:5, background:'#0d1929', borderRadius:5, overflow:'hidden', marginBottom:6 }}>
              <div style={{ width: nextTier ? `${Math.min(100, ((referralData?.stats.total ?? 0) / (currentTier.name === 'Bronze' ? 5 : currentTier.name === 'Prata' ? 10 : 20)) * 100)}%` : '100%', height:'100%', background:'linear-gradient(90deg,#10b981,#059669)', borderRadius:5, transition:'width .4s' }} />
            </div>
            {nextTier
              ? <p style={{ fontSize:11, color:'#4A6580', marginBottom:8 }}>{indToNext} ind. para <span style={{ color: nextTier.color }}>{nextTier.name}</span> · <span style={{ color:'#34d399' }}>+{nextTier.bonus} bônus</span></p>
              : <p style={{ fontSize:11, color:'#34d399', marginBottom:8, fontWeight:600 }}>Nível máximo atingido! 💎</p>
            }
            <div style={{ background:'rgba(251,191,36,.06)', border:'1px solid rgba(251,191,36,.12)', borderRadius:8, padding:'8px 10px' }}>
              <p style={{ fontSize:11, color:'#fbbf24', fontWeight:600 }}>💡 {(referralData?.stats.total ?? 0) * 10 + (currentTier.bonus)} moedas = ~{Math.floor(((referralData?.stats.total ?? 0) * 10 + currentTier.bonus) / 10)} leads grátis</p>
              <p style={{ fontSize:10, color:'#4A6580', marginTop:2 }}>sem gastar um centavo</p>
            </div>
          </div>
        </div>
      </div>

      {/* METAS */}
      <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#a78bfa,#7c3aed)' }} />
        <p style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:12 }}>Metas mensais — quanto você pode ganhar</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {TIERS.map(t => (
            <div key={t.name} style={{ background: t.bg, border:`1px solid ${t.border}`, borderRadius:10, padding:10 }}>
              <p style={{ fontSize:18, marginBottom:4 }}>{t.emoji}</p>
              <p style={{ fontSize:12, fontWeight:700, color: t.color, marginBottom:2 }}>{t.name}</p>
              <p style={{ fontSize:10, color:'#4A6580', marginBottom:6 }}>{t.range} ind.</p>
              <p style={{ fontSize:10, color: t.bonus > 0 ? '#34d399' : '#4A6580', fontWeight: t.bonus > 0 ? 600 : 400 }}>bônus {t.bonus > 0 ? `+${t.bonus}` : '—'}</p>
              <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,.04)' }}>
                <p style={{ fontSize:13, fontWeight:700, color: t.color }}>{t.name === 'Bronze' ? '10–40' : t.name === 'Prata' ? '65–105' : t.name === 'Ouro' ? '130–220' : '260+'}</p>
                <p style={{ fontSize:10, color:'#4A6580' }}>moedas</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:'#0d1929', border:'1px solid #1C3050', borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ fontSize:11, color:'#4A6580' }}>Diamante este mês =</p>
          <p style={{ fontSize:12, fontWeight:700, color:'#a78bfa' }}>260+ moedas ≈ ~25 leads grátis</p>
        </div>
      </div>

      {/* META DO MÊS */}
      {monthly && (
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#818cf8,#a78bfa)' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:7 }}><Target size={15} className="text-purple-400" /> Meta do mês</p>
            <p style={{ fontSize:11, color:'#4A6580' }}>{monthly.total_this_month}/{monthly.goal}</p>
          </div>
          <div style={{ height:5, background:'#0d1929', borderRadius:5, overflow:'hidden', marginBottom:6 }}>
            <div style={{ width:`${Math.min(100,(monthly.total_this_month/monthly.goal)*100)}%`, height:'100%', background: monthly.bonus_credited ? '#10b981' : 'linear-gradient(90deg,#818cf8,#a78bfa)', borderRadius:5, transition:'width .5s' }} />
          </div>
          <p style={{ fontSize:11, color:'#4A6580' }}>
            {monthly.bonus_credited
              ? 'Parabéns! Você já ganhou o bônus este mês. 🎉'
              : `Mais ${monthly.goal - monthly.total_this_month} indicação${monthly.goal - monthly.total_this_month !== 1 ? 'ões' : ''} para ganhar ${monthly.bonus_coins} moedas bônus!`}
          </p>
        </div>
      )}

      {/* O QUE O INDICADO GANHA */}
      <div style={{ background:'linear-gradient(135deg,rgba(96,165,250,.08),rgba(55,138,221,.05))', border:'1px solid rgba(96,165,250,.2)', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#60a5fa,#378ADD)' }} />
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#60a5fa', marginBottom:6 }}>Para quem você indica</p>
            <p style={{ fontSize:15, fontWeight:700, color:'white', marginBottom:4 }}>Seu indicado também ganha ao assinar</p>
            <p style={{ fontSize:12, color:'#4A6580' }}>Moedas de boas-vindas incluídas — até <span style={{ color:'#fbbf24', fontWeight:600 }}>200 moedas grátis</span> no Elite</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, minWidth:220 }}>
            {[{p:'Starter',m:'30',c:'#60a5fa'},{p:'PRO',m:'80',c:'#34d399'},{p:'Elite',m:'200',c:'#fbbf24'}].map(pl => (
              <div key={pl.p} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:8, textAlign:'center' }}>
                <p style={{ fontSize:11, color:'#4A6580', marginBottom:3 }}>{pl.p}</p>
                <p style={{ fontSize:16, fontWeight:700, color: pl.c }}>{pl.m}</p>
                <p style={{ fontSize:10, color:'#4A6580' }}>moedas</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RANKING */}
      {ranking.length > 0 && (
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
          <p style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:12, display:'flex', alignItems:'center', gap:7 }}><Trophy size={15} className="text-yellow-400" /> Top indicadores do mês</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {ranking.map(r => {
              const isMe = r.referrer_id === user?.id
              return (
                <div key={r.referrer_id} style={{ display:'flex', alignItems:'center', gap:10, background: isMe ? 'rgba(16,185,129,.08)' : 'rgba(255,255,255,.03)', border:`1px solid ${isMe ? 'rgba(16,185,129,.2)' : 'rgba(255,255,255,.06)'}`, borderRadius:10, padding:'8px 12px' }}>
                  <span style={{ fontSize:14, fontWeight:700, width:24, textAlign:'center' }}>{medalEmoji(r.position)}</span>
                  {r.avatar_url
                    ? <img src={r.avatar_url} alt={r.full_name} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#4A6580', flexShrink:0 }}>{r.full_name.charAt(0).toUpperCase()}</div>
                  }
                  <span style={{ flex:1, fontSize:13, color:'white', fontWeight:500 }}>{r.full_name}{isMe && <span style={{ color:'#34d399', fontSize:11 }}> (você)</span>}</span>
                  <span style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#94a3b8' }}>{r.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* COMO FUNCIONA + FAQ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <p style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:14 }}>Como funciona</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { icon:<Share2 size={15} />, title:'Compartilhe seu link', desc:`Envie para outros ${isPro ? 'profissionais' : 'clientes'} pelo WhatsApp, Instagram ou onde quiser.`, color:'#34d399' },
              { icon:<Users size={15} />, title:'Indicado se cadastra', desc:'Aparece automaticamente no seu painel.', color:'#60a5fa' },
              { icon:<CheckCircle size={15} />, title:'Indicado assina um plano', desc:'Qualquer plano pago conta.', color:'#fbbf24' },
              { icon:<Gift size={15} />, title:`Você ganha ${rewardLabel}`, desc:'Caem na carteira automaticamente.', color:'#a78bfa' },
            ].map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: s.color }}>{s.icon}</div>
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:'white', marginBottom:2 }}>{s.title}</p>
                  <p style={{ fontSize:11, color:'#4A6580' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#4A6580,#243F6A)' }} />
          <p style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:12 }}>Perguntas frequentes</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { q:'Quando recebo as moedas?', a:'Assim que o indicado assinar qualquer plano pago.' },
              { q:'Tem limite de indicações?', a:'Não. Indique quantas pessoas quiser, sem limite mensal.' },
              { q:'Bônus em cascata?', a:'Se seu indicado indicar alguém, você ganha mais 20 moedas extras automaticamente.' },
              { q:'As moedas expiram?', a:'No PRO e Elite nunca expiram. Use quando quiser.' },
            ].map((f, i) => (
              <div key={i} style={{ background:'#0d1929', border:'1px solid #1C3050', borderRadius:8, padding:10 }}>
                <p style={{ fontSize:11, fontWeight:600, color:'#8aafcf', marginBottom:4 }}>{f.q}</p>
                <p style={{ fontSize:11, color:'#4A6580', lineHeight:1.5 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HISTÓRICO */}
      <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#378ADD,#1d6fa8)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <p style={{ fontSize:13, fontWeight:700, color:'white' }}>Suas indicações</p>
          {referrals.length > 0 && <span style={{ background:'rgba(255,255,255,.06)', color:'#4A6580', fontSize:11, padding:'2px 8px', borderRadius:20, fontFamily:'monospace' }}>{referrals.length}</span>}
        </div>
        {loadingList ? (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[1,2,3].map(i => <div key={i} style={{ height:48, background:'#0d1929', borderRadius:10 }} />)}
          </div>
        ) : referrals.length === 0 ? (
          <div style={{ border:'1px dashed rgba(255,255,255,.08)', borderRadius:14, padding:'2rem', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(96,165,250,.1)', border:'1px solid rgba(96,165,250,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={20} style={{ color:'#60a5fa' }} />
            </div>
            <p style={{ fontSize:13, color:'white', fontWeight:500 }}>Nenhuma indicação ainda</p>
            <p style={{ fontSize:11, color:'#4A6580' }}>Compartilhe seu link e comece a ganhar moedas</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {referrals.map(r => {
              const cfg = STATUS_CONFIG[r.status]
              const Icon = cfg.icon
              return (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'10px 12px' }}>
                  {r.referred_avatar
                    ? <img src={r.referred_avatar} alt={r.referred_name ?? ''} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ padding:6, borderRadius:8, background: cfg.bg, flexShrink:0 }}><Icon size={14} className={cfg.color} /></div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:12, fontWeight:500, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.referred_name ?? 'Usuário'}</p>
                    <p style={{ fontSize:11, color:'#4A6580' }}>{fmtDate(r.created_at)}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20 }} className={`${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                    {r.status === 'credited' && <p style={{ fontSize:11, color:'#34d399', fontFamily:'monospace', marginTop:3 }}>+{r.reward_amount || baseReward}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
