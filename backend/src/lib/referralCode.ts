import { supabaseAdmin } from "../config.js";

function generateCode(userId: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const prefix = userId.slice(0, 4).toUpperCase().replace(/-/g, "X");
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${suffix}`;
}

/** Retorna o referral_code do usuário, gerando e persistindo se ainda não existir. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("referral_code").eq("id", userId).maybeSingle();
  if (profile?.referral_code) return profile.referral_code;

  let code = generateCode(userId);
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabaseAdmin
      .from("profiles").select("id").eq("referral_code", code).maybeSingle();
    if (!existing) break;
    code = generateCode(userId);
  }
  await supabaseAdmin.from("profiles").update({ referral_code: code }).eq("id", userId);
  return code;
}

export function referralLink(code: string): string {
  return `${process.env.FRONTEND_URL ?? "https://melocale.com.br"}/convite/${code}`;
}
