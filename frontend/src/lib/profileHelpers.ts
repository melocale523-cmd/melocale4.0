import { ProfileData } from '../hooks/useProfile';
import { ClientProfileData } from '../hooks/useClientProfile';

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

// ─── Client profile helpers ───────────────────────────────────────────────────

export function isClientProfileComplete(profile: ClientProfileData | null | undefined): boolean {
  if (!profile) return false;
  return !!(profile.full_name?.trim() && profile.phone?.trim() && profile.city?.trim());
}

// Brazilian phone: 10 digits (landline) or 11 digits (mobile with 9-prefix)
export const BR_PHONE_RE = /^\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$/;

export type ClientFieldErrors = { name?: string; phone?: string; city?: string };

export function validateClientProfileForm(data: {
  name: string;
  phone: string;
  city: string;
}): ClientFieldErrors {
  const errors: ClientFieldErrors = {};
  if (!data.name.trim() || data.name.trim().length < 3)
    errors.name = 'Nome deve ter pelo menos 3 caracteres.';
  const digits = data.phone.replace(/\D/g, '');
  if (!digits || digits.length < 10 || digits.length > 11)
    errors.phone = 'Telefone inválido. Use (11) 99999-9999.';
  if (!data.city.trim())
    errors.city = 'Informe sua cidade.';
  return errors;
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
