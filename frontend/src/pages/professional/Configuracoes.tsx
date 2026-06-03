import { useState, useEffect } from 'react';
import { Settings, Bell, Lock, Shield, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function ProfessionalConfiguracoes() {
  const { user } = useAuthStore();

  const [notifications, setNotifications] = useState({
    newLead: true,
    appointmentConfirmed: true,
    appointmentCancelled: true,
    messages: true,
    promotions: false,
  });

  const [savingNotifications, setSavingNotifications] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // Load persisted preferences on mount
  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;
      const { data } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data && !cancelled) {
        setNotifications(prev => ({
          ...prev,
          newLead: data.email_new_lead,
          messages: data.email_messages,
          promotions: data.push_enabled,
          appointmentConfirmed: data.appointment_confirmed,
          appointmentCancelled: data.appointment_cancelled,
        }));
      }
    }
    loadPrefs();
    return () => { cancelled = true; };
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Sessão expirada');
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          email_new_lead: notifications.newLead,
          email_messages: notifications.messages,
          push_enabled: notifications.promotions,
          appointment_confirmed: notifications.appointmentConfirmed,
          appointment_cancelled: notifications.appointmentCancelled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('Preferências de notificação salvas!');
    } catch {
      toast.error('Erro ao salvar preferências. Tente novamente.');
    } finally {
      setSavingNotifications(false);
    }
  };

  return (
    <div className="w-full space-y-3">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Configurações</h1>
        <p className="text-xs uppercase tracking-wide text-slate-400">Gerencie suas preferências de conta</p>
      </div>

      {/* Conta */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
            <Shield size={14} className="text-emerald-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Conta</h2>
        </div>
        <div className="divide-y divide-[#1C3050]">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">E-mail</p>
              <p className="text-sm text-slate-200">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Tipo de conta</p>
              <p className="text-sm text-slate-200">Profissional</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
              Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Notificações */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
            <Bell size={14} className="text-emerald-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Notificações</h2>
        </div>
        <div className="divide-y divide-[#1C3050]">
          {[
            { key: 'newLead', label: 'Novo lead disponível', desc: 'Quando um cliente solicitar um serviço na sua área' },
            { key: 'appointmentConfirmed', label: 'Agendamento confirmado', desc: 'Quando um cliente confirmar um agendamento' },
            { key: 'appointmentCancelled', label: 'Agendamento cancelado', desc: 'Quando um cliente cancelar um agendamento' },
            { key: 'messages', label: 'Mensagens', desc: 'Quando receber uma nova mensagem' },
            { key: 'promotions', label: 'Promoções e novidades', desc: 'Ofertas especiais e atualizações da plataforma' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between gap-3 py-2 cursor-pointer group">
              <div>
                <p className="text-sm text-white group-hover:text-emerald-400 transition-colors">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={notifications[key as keyof typeof notifications]}
                onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
                  notifications[key as keyof typeof notifications] ? 'bg-emerald-500' : 'bg-[#1C3050]'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  notifications[key as keyof typeof notifications] ? 'left-5' : 'left-1'
                }`} />
              </button>
            </label>
          ))}
        </div>
        <div className="pt-3">
          <button
            onClick={handleSaveNotifications}
            disabled={savingNotifications}
            className="h-8 px-4 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {savingNotifications ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Salvar preferências
          </button>
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
            <Lock size={14} className="text-emerald-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Segurança</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-white">Senha</p>
            <p className="text-xs text-slate-500">Altere sua senha de acesso</p>
          </div>
          <button
            onClick={() => setShowPasswordForm(v => !v)}
            className="h-8 px-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-all"
          >
            {showPasswordForm ? 'Cancelar' : 'Alterar senha'}
          </button>
        </div>

        {showPasswordForm && (
          <div className="mt-2 pt-3 border-t border-[#1C3050] space-y-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Senha atual</label>
              <input
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                placeholder="••••••••"
                maxLength={128}
                className="w-full h-8 bg-[#0E1C32] border border-[#1C3050] rounded-lg px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Nova senha</label>
              <input
                type="password"
                value={passwordForm.newPass}
                onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                maxLength={128}
                className="w-full h-8 bg-[#0E1C32] border border-[#1C3050] rounded-lg px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Confirmar nova senha</label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repita a nova senha"
                maxLength={128}
                className="w-full h-8 bg-[#0E1C32] border border-[#1C3050] rounded-lg px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <button
              disabled={savingPassword}
              onClick={async () => {
                const { current, newPass, confirm } = passwordForm;
                if (newPass.length < 8) {
                  toast.error('A nova senha deve ter pelo menos 8 caracteres.');
                  return;
                }
                if (newPass === current) {
                  toast.error('A nova senha deve ser diferente da senha atual.');
                  return;
                }
                if (newPass !== confirm) {
                  toast.error('As senhas não coincidem.');
                  return;
                }
                setSavingPassword(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const email = session?.user?.email;
                  if (!email) throw new Error('Sessão expirada. Faça login novamente.');
                  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current });
                  if (signInError) throw new Error('Senha atual incorreta.');
                  const { error } = await supabase.auth.updateUser({ password: newPass });
                  if (error) throw error;
                  toast.success('Senha alterada com sucesso!');
                  setShowPasswordForm(false);
                  setPasswordForm({ current: '', newPass: '', confirm: '' });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha.');
                } finally {
                  setSavingPassword(false);
                }
              }}
              className="h-10 px-6 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg transition-all disabled:opacity-50"
            >
              {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Salvar nova senha
            </button>
          </div>
        )}
      </div>

      {/* Zona de Perigo */}
      <div className="bg-[#1C3454] border border-red-500/20 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
            <Settings size={14} className="text-red-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Zona de Perigo</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-white">Desativar conta</p>
            <p className="text-xs text-slate-500">Sua conta e dados serão desativados permanentemente</p>
          </div>
          <button
            onClick={() => toast.error('Entre em contato com o suporte para desativar sua conta.')}
            className="h-8 px-4 text-xs font-semibold text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 border border-red-500/20 transition-all"
          >
            Desativar
          </button>
        </div>
      </div>

    </div>
  );
}
