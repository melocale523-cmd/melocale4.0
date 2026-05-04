import { ProfileData } from '../hooks/useProfile';
import { ClientProfileData } from '../hooks/useClientProfile';

// ─── Single source of truth for profile field validity ────────────────────────

export interface ProfileValidation {
  name: boolean;
  phone: boolean;
  bio: boolean;
  category: boolean;
  avatar: boolean;
}

export function getProfileValidation(
  profile: ProfileData | null | undefined,
  email: string | undefined,
): ProfileValidation {
  if (!profile) {
    return { name: false, phone: false, bio: false, category: false, avatar: false };
  }

  return {
    name:
      !!profile.full_name &&
      profile.full_name.trim().length > 2 &&
      profile.full_name.trim() !== email?.split('@')[0],
    phone: !!profile.phone?.trim(),
    bio: !!profile.bio && profile.bio.trim().length > 10,
    category: !!profile.category?.trim(),
    avatar: !!profile.avatar_url?.trim(),
  };
}

// ─── Professional profile completion ─────────────────────────────────────────

export interface CompletionResult {
  pct: number;
  missing: string[];
}

const FIELD_WEIGHTS: Record<keyof ProfileValidation, { pts: number; label: string }> = {
  name:     { pts: 20, label: 'Nome completo' },
  phone:    { pts: 20, label: 'Telefone' },
  bio:      { pts: 25, label: 'Biografia' },
  category: { pts: 20, label: 'Categoria' },
  avatar:   { pts: 15, label: 'Foto de perfil' },
};

export function calculateProfileCompletion(
  profile: ProfileData | null | undefined,
  email: string | undefined,
): CompletionResult {
  const v = getProfileValidation(profile, email);

  let pct = 0;
  const missing: string[] = [];

  for (const [field, { pts, label }] of Object.entries(FIELD_WEIGHTS) as [keyof ProfileValidation, { pts: number; label: string }][]) {
    if (v[field]) {
      pct += pts;
    } else {
      missing.push(label);
    }
  }

  return { pct, missing };
}

// ─── Dashboard checklist steps ────────────────────────────────────────────────

export interface DashboardStep {
  id: string;
  label: string;
  done: boolean;
  path: string | null;
}

export function calculateSteps(params: {
  profile: ProfileData | null | undefined;
  email: string | undefined;
  balanceCoins: number;
  purchaseCount: number;
}): DashboardStep[] {
  const v = getProfileValidation(params.profile, params.email);

  return [
    {
      id: 'profile',
      label: 'Completar perfil (nome, telefone, bio, categoria)',
      done: v.name && v.phone && v.bio && v.category,
      path: '/profissional/perfil',
    },
    {
      id: 'avatar',
      label: 'Adicionar foto de perfil',
      done: v.avatar,
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

// ─── Centralised dashboard state ─────────────────────────────────────────────

export interface DashboardState {
  validation: ProfileValidation;
  completion: CompletionResult;
  steps: DashboardStep[];
  displayDone: number;
  displayTotal: number;
  checklistPct: number;
  isChecklistComplete: boolean;
  onlyAvatarMissing: boolean;
  stats: { purchaseCount: number; balanceCoins: number };
}

export function getDashboardState(params: {
  profile: ProfileData | null | undefined;
  email: string | undefined;
  balanceCoins: number;
  purchaseCount: number;
}): DashboardState {
  const validation = getProfileValidation(params.profile, params.email);
  const completion = calculateProfileCompletion(params.profile, params.email);
  const steps = calculateSteps(params);

  const requiredSteps = steps.filter(s => s.id !== 'avatar');
  const requiredDone = requiredSteps.filter(s => s.done).length;
  const displayDone = requiredDone;
  const displayTotal = requiredSteps.length;
  const checklistPct = Math.round((displayDone / displayTotal) * 100);
  const isChecklistComplete = displayDone === displayTotal;

  const onlyAvatarMissing =
    isChecklistComplete && !steps.find(s => s.id === 'avatar')?.done;

  return {
    validation,
    completion,
    steps,
    displayDone,
    displayTotal,
    checklistPct,
    isChecklistComplete,
    onlyAvatarMissing,
    stats: { purchaseCount: params.purchaseCount, balanceCoins: params.balanceCoins },
  };
}

// ─── Client profile helpers ───────────────────────────────────────────────────

export function isClientProfileComplete(profile: ClientProfileData | null | undefined): boolean {
  if (!profile) return false;
  return !!(profile.full_name?.trim() && profile.phone?.trim() && profile.city?.trim());
}

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
  if (!digits || digits.length < 10 || digits.length > 11) {
    errors.phone = 'Telefone inválido. Use (11) 99999-9999.';
  } else if (digits === digits[0].repeat(digits.length)) {
    errors.phone = 'Telefone inválido. Verifique o número.';
  }

  if (!data.city.trim())
    errors.city = 'Informe sua cidade.';

  return errors;
}

export function normalizeClientProfileData(data: {
  name: string;
  phone: string;
  city: string;
}) {
  return {
    name: data.name.trim(),
    phone: data.phone.replace(/\D/g, ''),
    city: data.city.trim(),
  };
}
