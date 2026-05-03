import { ProfileData } from '../hooks/useProfile';

export interface CompletionResult {
  pct: number;
  missing: string[];
}

export function calculateProfileCompletion(
  profile: ProfileData | null | undefined,
  email: string | undefined,
): CompletionResult {
  if (!profile) return { pct: 0, missing: [] };

  const missing: string[] = [];
  let score = 0;

  const nameIsReal =
    profile.full_name &&
    profile.full_name !== email?.split('@')[0] &&
    profile.full_name.trim().length > 2;
  if (nameIsReal) { score += 20; } else { missing.push('Nome completo'); }

  if (profile.phone?.trim()) { score += 20; } else { missing.push('Telefone'); }

  if (profile.bio && profile.bio.trim().length > 10) { score += 25; } else { missing.push('Biografia'); }

  if (profile.category?.trim()) { score += 20; } else { missing.push('Categoria'); }

  if (profile.avatar_url?.trim()) { score += 15; } else { missing.push('Foto de perfil'); }

  return { pct: score, missing };
}

export interface DashboardStep {
  id: string;
  label: string;
  done: boolean;
  path: string | null;
}

export function calculateSteps(params: {
  hasUser: boolean;
  completionPct: number;
  balanceCoins: number;
  purchaseCount: number;
}): DashboardStep[] {
  return [
    {
      id: 'account',
      label: 'Criar conta',
      done: params.hasUser,
      path: null,
    },
    {
      id: 'profile',
      label: 'Completar perfil (80% ou mais)',
      done: params.completionPct >= 80,
      path: '/profissional/perfil',
    },
    {
      id: 'wallet',
      label: 'Recarregar carteira de moedas',
      done: params.balanceCoins > 0,
      path: '/profissional/carteira',
    },
    {
      id: 'lead',
      label: 'Comprar primeiro lead',
      done: params.purchaseCount > 0,
      path: '/profissional/leads',
    },
  ];
}
