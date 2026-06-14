import { useState } from 'react';
import { Lock, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

const CARD = 'bg-[#0E1C32] border border-[#243F6A] rounded-2xl overflow-hidden';
const CARD_HEADER = 'px-5 py-4 border-b border-[#243F6A] flex items-center gap-3';
const ICON_WRAP = 'w-9 h-9 rounded-xl flex items-center justify-center shrink-0';
const CARD_TITLE = 'text-[15px] font-bold text-white';
const ROW = 'px-5 py-3.5 border-b border-[#243F6A] last:border-0 flex items-center justify-between';
const INPUT_BASE = 'bg-[#132236] border border-[#243F6A] rounded-xl px-3.5 py-2.5 text-sm text-white w-full focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-600';
const LABEL_SM = 'text-[11px] font-bold uppercase tracking-widest text-[#4A6580]';

export default function ClientConfiguracoes() {
  const { user } = useAuthStore();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  return (
    <div className="flex justify-center px-4 py-6"><div className="w-full max-w-2xl space-y-4">
      {/* Page header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-[#4A6580] mt-1">Gerencie suas preferências de conta</p>
      </div>

      {/* Card Conta */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div className={`${ICON_WRAP} bg-emerald-500/12`}>
            <Shield size={17} className="text-emerald-400" />
          </div>
          <h2 className={CARD_TITLE}>Conta</h2>
        </div>
        <div>
          <div className={ROW}>
            <div>
              <p className="text-sm font-bold text-white">E-mail</p>
              <p className="text-xs text-[#4A6580] mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className={ROW}>
            <div>
              <p className="text-sm font-bold text-white">Tipo de conta</p>
              <p className="text-xs text-[#4A6580] mt-0.5">Cliente</p>
            </div>
            <span className="bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 text-[11px] font-bold px-3 py-0.5 rounded-full">
              Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Card Segurança */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div className={`${ICON_WRAP} bg-emerald-500/12`}>
            <Lock size={17} className="text-emerald-400" />
          </div>
          <h2 className={CARD_TITLE}>Segurança</h2>
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Senha</p>
            <p className="text-xs text-[#4A6580] mt-0.5">Altere sua senha de acesso</p>
          </div>
          <button
            onClick={() => setShowPasswordForm(v => !v)}
            className="text-[13px] text-emerald-400 font-bold bg-transparent border-none cursor-pointer hover:text-emerald-300 transition-colors"
          >
            {showPasswordForm ? 'Cancelar' : 'Alterar senha'}
          </button>
        </div>

        {showPasswordForm && (
          <div className="border-t border-[#243F6A] px-5 py-4 space-y-3">
            <div>
              <label className={`${LABEL_SM} block mb-1.5`}>Senha atual</label>
              <input
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                placeholder="••••••••"
                maxLength={128}
                className={INPUT_BASE}
              />
            </div>
            <div>
              <label className={`${LABEL_SM} block mb-1.5`}>Nova senha</label>
              <input
                type="password"
                value={passwordForm.newPass}
                onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                maxLength={128}
                className={INPUT_BASE}
              />
            </div>
            <div>
              <label className={`${LABEL_SM} block mb-1.5`}>Confirmar nova senha</label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repita a nova senha"
                maxLength={128}
                className={INPUT_BASE}
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
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Salvar nova senha
            </button>
          </div>
        )}
      </div>

      {/* Card Zona de Perigo */}
      <div className="bg-[#0E1C32] border border-red-500/25 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-red-500/15 flex items-center gap-3">
          <div className={`${ICON_WRAP} bg-red-500/10`}>
            <AlertTriangle size={17} className="text-red-400" />
          </div>
          <h2 className={CARD_TITLE}>Zona de Perigo</h2>
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Desativar conta</p>
            <p className="text-xs text-[#4A6580] mt-0.5">Sua conta e dados serão desativados permanentemente</p>
          </div>
          <button
            onClick={() => toast.error('Entre em contato com o suporte para desativar sua conta.')}
            className="text-xs text-red-400 border border-red-500/30 bg-red-500/5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors font-bold"
          >
            Desativar
          </button>
        </div>
      </div>
    </div></div>
  );
}
