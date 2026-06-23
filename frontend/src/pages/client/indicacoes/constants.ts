import React from 'react'

// ── Types ─────────────────────────────────────────────────────────────
export interface ReferralCode {
  code: string
  role: 'client' | 'professional'
  full_name: string
  avatar_url: string | null
  link: string
  stats: { total: number; registered: number; converted: number; credited: number }
}

export interface ReferralItem {
  id: string
  status: 'pending' | 'registered' | 'converted' | 'credited'
  referred_name: string | null
  referred_avatar: string | null
  reward_amount: number
  credited_at: string | null
  created_at: string
}

export interface BonusConfig {
  multiplier: number
  expires_at: string | null
  label: string | null
}

export interface WithdrawalHistoryItem {
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

export interface RankingItem {
  user_id: string
  full_name: string
  avatar_url: string | null
  total_earned: number
  position: number
}

export interface CoinTx {
  id: string
  amount: number
  kind: string
  balance_after: number
  created_at: string
}

export interface CoinsData {
  balance: number
  total_earned: number
}

export interface MonthlyStats {
  total_this_month: number
  goal: number
  bonus_credited: boolean
  bonus_coins: number
}

// ── Helpers ───────────────────────────────────────────────────────────
export function getAvatarInfo(name: string): { initials: string; colorClass: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  const palette = ['bg-blue-800', 'bg-purple-700', 'bg-orange-700', 'bg-teal-700']
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return { initials, colorClass: palette[Math.abs(hash) % palette.length] }
}

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

export function kindLabel(kind: string): { icon: string; label: string } {
  const map: Record<string, { icon: string; label: string }> = {
    referral_signup:   { icon: '🔗', label: 'Cadastro via indicação' },
    referral_order:    { icon: '🛒', label: 'Pedido de indicado' },
    first_order:       { icon: '🎉', label: 'Primeiro pedido' },
    profile_complete:  { icon: '📋', label: 'Perfil completo' },
    review:            { icon: '⭐', label: 'Avaliação enviada' },
    mission:           { icon: '🏆', label: 'Missão do mês' },
    withdrawal:        { icon: '💸', label: 'Saque via Pix' },
    withdrawal_refund: { icon: '↩️', label: 'Estorno de saque' },
    test:              { icon: '🧪', label: 'Teste' },
  }
  return map[kind] ?? { icon: '🪙', label: kind }
}

// ── Design tokens ─────────────────────────────────────────────────────
export const t = {
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

export const cardBase: React.CSSProperties = {
  background: t.card,
  border: `1px solid ${t.border}`,
  borderTop: `3px solid ${t.accent}`,
  borderRadius: '1rem',
  padding: '1.25rem',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'transform .25s',
}

export const kpiCard: React.CSSProperties = {
  background: t.input,
  border: `1px solid ${t.border}`,
  borderRadius: '8px',
  padding: '1rem .75rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
}

// ── Static data arrays ────────────────────────────────────────────────
export const HOW_TO_EARN_ACTIONS = [
  { icon: '🎉', label: 'Primeiro pedido', coins: 100 },
  { icon: '📋', label: 'Completar perfil', coins: 50 },
  { icon: '⭐', label: 'Avaliar profissional', coins: 30 },
  { icon: '🔗', label: 'Cadastro via indicação', coins: 20 },
  { icon: '💰', label: 'Indicar amigo (ele faz pedido)', coins: 200 },
] as const

export const BONUS_TIERS = [
  { label: '🥉 Bronze',   range: '1–4 indicações',   bonus: 'R$2 – R$8',   bg: '#3d200015', border: '#92400e40', color: '#f59e0b' },
  { label: '🥈 Prata',    range: '5–9 indicações',   bonus: 'R$10 – R$18', bg: '#1e293b',   border: '#47556940', color: '#94a3b8' },
  { label: '🥇 Ouro',     range: '10–19 indicações', bonus: 'R$20 – R$38', bg: '#3d290015', border: '#b4530940', color: '#fbbf24' },
  { label: '💎 Diamante', range: '20+ indicações',   bonus: 'R$40+',       bg: '#1a103d',   border: '#6d28d940', color: '#a78bfa' },
] as const
