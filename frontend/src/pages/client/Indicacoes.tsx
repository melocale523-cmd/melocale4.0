import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '../../hooks/useIsMobile'
import { toast } from 'sonner'
import { useAuthStore } from '../../store/authStore'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import {
  ReferralCode, ReferralItem, BonusConfig, WithdrawalHistoryItem,
  RankingItem, CoinTx, CoinsData, MonthlyStats, loadImg, t,
} from './indicacoes/constants'
import IndicacoesHeader from './indicacoes/IndicacoesHeader'
import HowToEarnCard from './indicacoes/HowToEarnCard'
import TopRankingCard from './indicacoes/TopRankingCard'
import CoinsBalanceCard from './indicacoes/CoinsBalanceCard'
import MonthlyMissionCard from './indicacoes/MonthlyMissionCard'
import ReferredBonusCard from './indicacoes/ReferredBonusCard'
import WithdrawalHistoryTable from './indicacoes/WithdrawalHistoryTable'
import ReferralLinkCard from './indicacoes/ReferralLinkCard'
import ReferralResultsCard from './indicacoes/ReferralResultsCard'
import HowItWorksCard from './indicacoes/HowItWorksCard'
import CoinHistoryCard from './indicacoes/CoinHistoryCard'
import ReferralsListCard from './indicacoes/ReferralsListCard'
import ReferralBalanceHighlight from './indicacoes/ReferralBalanceHighlight'
import BonusTiersCard from './indicacoes/BonusTiersCard'
import RankingModal from './indicacoes/RankingModal'
import WithdrawModal from './indicacoes/WithdrawModal'

export default function ClientIndicacoes() {
  const isMobile = useIsMobile()
  const user = useAuthStore((state) => state.user)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [generatingStories, setGeneratingStories] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('cpf')
  const [modalCoinsAmount, setModalCoinsAmount] = useState('1000')

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

  const { data: ranking = [] } = useQuery<RankingItem[]>({
    queryKey: ['clientCoinsRanking'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/ranking')
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const { data: coinHistory = [] } = useQuery<CoinTx[]>({
    queryKey: ['clientCoinHistory'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/transactions')
      if (!res.ok) return []
      return res.json()
    },
    enabled: authReady,
    staleTime: 30 * 1000,
  })

  const { data: coinsData } = useQuery<CoinsData>({
    queryKey: ['clientCoins'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/balance')
      if (!res.ok) return { balance: 0, total_earned: 0 }
      return res.json()
    },
    enabled: authReady,
  })

  const { data: monthlyStats } = useQuery<MonthlyStats>({
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

  const queryClient = useQueryClient()

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(modalCoinsAmount, 10)
      if (isNaN(amount) || amount < 1000) throw new Error('Mínimo de 1.000 moedas para sacar.')
      if (amount > (coinsData?.balance ?? 0)) throw new Error('Saldo insuficiente.')
      if (!pixKey.trim()) throw new Error('Informe sua chave Pix.')
      const { error } = await supabase.rpc('request_withdrawal', {
        p_coins_amount: amount,
        p_pix_key: pixKey.trim(),
        p_pix_key_type: pixKeyType,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Saque solicitado com sucesso! Você receberá o valor em até 24h. 🎉')
      setShowWithdrawModal(false)
      setPixKey('')
      queryClient.invalidateQueries({ queryKey: ['clientCoins'] })
      queryClient.invalidateQueries({ queryKey: ['withdrawalHistory'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const hasPendingWithdrawal = withdrawalHistory.some(w => w.status === 'pending' || w.status === 'approved')
  const totalWithdrawn = withdrawalHistory
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + (w.coins_amount ?? 0), 0)

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
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        <IndicacoesHeader
          rewardLabel={rewardLabel}
          rewardDesc={rewardDesc}
          hasDoubleBonus={hasDoubleBonus}
          bonusConfig={bonusConfig}
        />

        <HowToEarnCard isMobile={isMobile} />

        {ranking.length > 0 && (
          <TopRankingCard
            ranking={ranking}
            onShowAll={() => setShowRankingModal(true)}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '12px', marginBottom: '1.5rem' }}>
          <CoinsBalanceCard
            coinsData={coinsData}
            totalWithdrawn={totalWithdrawn}
            referralData={referralData}
            hasPendingWithdrawal={hasPendingWithdrawal}
            onWithdraw={() => {
              setModalCoinsAmount(String(coinsData?.balance ?? 1000))
              setShowWithdrawModal(true)
            }}
          />
          <MonthlyMissionCard monthlyStats={monthlyStats} />
          <ReferredBonusCard />
        </div>

        {withdrawalHistory.length > 0 && (
          <WithdrawalHistoryTable withdrawalHistory={withdrawalHistory} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
            <ReferralLinkCard
              referralData={referralData}
              isEffectivelyLoading={isEffectivelyLoading}
              codeError={codeError}
              copied={copied}
              showQr={showQr}
              isMobile={isMobile}
              generatingStories={generatingStories}
              onSetShowQr={setShowQr}
              onCopyLink={copyLink}
              onShareWhatsApp={shareWhatsApp}
              onGenerateStoriesImage={generateStoriesImage}
            />
            <ReferralResultsCard
              referralData={referralData}
              isMobile={isMobile}
              isPro={isPro}
              totalEarned={totalEarned}
              baseReward={baseReward}
            />
            <HowItWorksCard isPro={isPro} rewardLabel={rewardLabel} />
            {coinHistory.length > 0 && (
              <CoinHistoryCard coinHistory={coinHistory} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
            <ReferralsListCard
              referrals={referrals}
              isListLoading={isListLoading}
              isPro={isPro}
              baseReward={baseReward}
            />
            <ReferralBalanceHighlight balanceLabel={balanceLabel} />
            <BonusTiersCard />
          </div>

        </div>

      </div>

      <RankingModal
        show={showRankingModal}
        onClose={() => setShowRankingModal(false)}
        ranking={ranking}
      />

      <WithdrawModal
        show={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        coinsData={coinsData}
        modalCoinsAmount={modalCoinsAmount}
        setModalCoinsAmount={setModalCoinsAmount}
        pixKey={pixKey}
        setPixKey={setPixKey}
        pixKeyType={pixKeyType}
        setPixKeyType={setPixKeyType}
        withdrawMutation={withdrawMutation}
      />
    </div>
  )
}
