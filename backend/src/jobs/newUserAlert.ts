import { supabaseAdmin } from "../config.js";
import { sendTelegram } from "../lib/telegram.js";

export async function sendNewUserAlert(user: {
  full_name?: string | null;
  email?: string;
  role: string;
  city?: string | null;
  origin?: string | null;
  phone?: string | null;
}): Promise<void> {
  const roleLabel = user.role === 'professional' ? '🔧 Profissional' : user.role === 'client' ? '🏠 Cliente' : '👤 Outro';
  const originLabel = user.origin === 'meta_ads' ? '📣 Meta Ads' : user.origin === 'referral' ? '👥 Indicação' : user.origin === 'organic' ? '🌐 Orgânico' : '❔ Desconhecido';

  const text = `🆕 *Novo cadastro!*\n\n👤 ${user.full_name || 'Sem nome'}\n📧 ${user.email || '—'}\n${roleLabel}\n📍 ${user.city || 'Cidade não informada'}\n📱 ${user.phone || 'Sem telefone'}\n🔗 ${originLabel}`;

  // 1. Telegram
  void sendTelegram(text);

  // 2. Notificação no sino para todos os admins
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const notifications = admins.map((a: { id: string }) => ({
        user_id: a.id,
        title: `Novo cadastro: ${user.full_name || user.email || 'usuário'}`,
        body: `${roleLabel} · ${user.city || 'cidade não informada'} · ${originLabel}`,
        data: { type: 'system' },
      }));
      await supabaseAdmin.from('notifications').insert(notifications);
    }
  } catch (e) {
    console.error('[newUserAlert] erro ao inserir notif admin:', e);
  }
}
