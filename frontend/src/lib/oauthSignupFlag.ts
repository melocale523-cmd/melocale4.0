// Flag temporária usada pra comunicar a role escolhida (cliente/profissional) através do
// redirect OAuth do Google, que não preserva o estado do app (localStorage/sessionStorage
// são o único jeito de carregar essa info do clique inicial até a volta do Google).
//
// Tem timestamp + checagem de contexto de retorno real do OAuth (?oauth=1 na URL) pra não
// vazar pra uma sessão de auth futura não relacionada caso o usuário abandone o fluxo no
// meio (fecha o popup, cancela, troca de conta Google). Sem essas duas checagens, uma
// tentativa abandonada de "Cadastrar como Profissional" deixava a flag presa indefinidamente
// no localStorage, e o PRÓXIMO login/cadastro de QUALQUER conta no mesmo navegador herdava
// ela — foi isso que criou rows fantasma em `professionals` pra contas client/admin.
import type { Role } from '../store/authStore';

const STORAGE_KEY_SESSION = 'melocale_signup_role';
const STORAGE_KEY_LOCAL = 'melocale_signup_role_ls';
const TTL_MS = 5 * 60 * 1000; // 5 minutos — cobre o roundtrip normal do Google com folga

interface OAuthSignupFlag {
  role: Role;
  ts: number;
}

export function setOAuthSignupFlag(role: Role) {
  const payload = JSON.stringify({ role, ts: Date.now() } satisfies OAuthSignupFlag);
  sessionStorage.setItem(STORAGE_KEY_SESSION, payload);
  localStorage.setItem(STORAGE_KEY_LOCAL, payload);
}

export function clearOAuthSignupFlag() {
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
  localStorage.removeItem(STORAGE_KEY_LOCAL);
}

/**
 * Lê a role pendente do redirect OAuth — só retorna algo se:
 * (1) a URL atual indicar que estamos de fato voltando do Google (?oauth=1), e
 * (2) a flag tiver menos de 5 minutos.
 * Qualquer um desses falhando, retorna null e a flag é tratada como abandonada.
 */
export function readOAuthSignupRole(): Role | null {
  const isOAuthReturn = new URLSearchParams(window.location.search).get('oauth') === '1';
  if (!isOAuthReturn) return null;

  const raw = localStorage.getItem(STORAGE_KEY_LOCAL) || sessionStorage.getItem(STORAGE_KEY_SESSION);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as OAuthSignupFlag;
    if (Date.now() - parsed.ts < TTL_MS) return parsed.role;
  } catch {
    // formato antigo (string pura, pré-fix) ou JSON corrompido — não confia, descarta
  }
  return null;
}
