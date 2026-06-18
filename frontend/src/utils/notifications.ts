import { Trophy, Coins, Briefcase, MessageCircle, Bell } from 'lucide-react';
import type { FC } from 'react';

export interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export type NotifType = 'award' | 'coins' | 'lead' | 'message' | 'system';
export type FilterId  = 'all' | 'unread' | 'coins' | 'leads';

export function getNotifType(n: Notification): NotifType {
  const t = (n.data?.type as string | undefined) ?? '';
  const title = n.title.toLowerCase();
  if (t === 'award'   || title.includes('premiado'))                                    return 'award';
  if (t === 'coins'   || title.includes('moeda') || title.includes('starter') ||
      title.includes('pro') || title.includes('elite'))                                 return 'coins';
  if (t === 'lead'    || title.includes('orçamento') || title.includes('lead'))        return 'lead';
  if (t === 'message' || title.includes('mensagem'))                                    return 'message';
  return 'system';
}

export const TYPE_CFG = {
  award:   { Icon: Trophy,        bg: 'rgba(234,179,8,0.15)',    color: '#CA8A04', chipText: (n: Notification) => `+${n.data?.coins ?? ''} moedas`, chipBg: 'rgba(234,179,8,0.15)',    chipColor: '#CA8A04'  },
  coins:   { Icon: Coins,         bg: 'rgba(16,185,129,0.12)',   color: '#10b981', chipText: (n: Notification) => `+${n.data?.coins ?? ''} moedas`, chipBg: 'rgba(16,185,129,0.12)',   chipColor: '#10b981'  },
  lead:    { Icon: Briefcase,     bg: 'rgba(59,130,246,0.12)',   color: '#3B82F6', chipText: ()                => 'Lead',                           chipBg: 'rgba(59,130,246,0.12)',   chipColor: '#3B82F6'  },
  message: { Icon: MessageCircle, bg: 'rgba(139,92,246,0.12)',   color: '#8B5CF6', chipText: ()                => 'Mensagem',                       chipBg: 'rgba(139,92,246,0.12)',   chipColor: '#8B5CF6'  },
  system:  { Icon: Bell,          bg: 'rgba(148,163,184,0.10)',  color: '#94A3B8', chipText: ()                => '',                               chipBg: 'transparent',             chipColor: '#94A3B8'  },
} satisfies Record<NotifType, {
  Icon: FC<{ size?: number; color?: string }>;
  bg: string; color: string;
  chipText: (n: Notification) => string;
  chipBg: string; chipColor: string;
}>;

export function fmtTs(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)    return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',    label: 'Todas'     },
  { id: 'unread', label: 'Não lidas' },
  { id: 'coins',  label: 'Moedas'    },
  { id: 'leads',  label: 'Leads'     },
];
