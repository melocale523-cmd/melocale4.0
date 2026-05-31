import { useState } from 'react';
import { Settings, Lock, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function ClientConfiguracoes() {
  const { user } = useAuthStore();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Gerencie suas preferências de conta</p>
      </div>

      {/* Account info */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <Shield size={18} className="text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Conta</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-[#1C3050]">
            <div>
              <p className="text-sm font-medium text-white">E-mail</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-white">Tipo de conta</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">Cliente</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <Lock size={18} className="text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Segurança</h2>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-white">Senha</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Altere sua senha de acesso</p>
          </div>
          <button
            onClick={() => setShowPasswordForm(v => !v)}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-all"
          >
            {showPasswordForm ? 'Cancelar' : 'Alterar senha'}
          </button>
        </div>

        {showPasswordForm && (
          <div className="mt-2 pt-4 border-t border-[#1C3050] space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-widest">Senha atual</label>
              <input
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                placeholder="••••••••"
                maxLength={128}
                className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-widest">Nova senha</label>
              <input
                type="password"
                value={passwordForm.newPass}
                onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                maxLength={128}
                className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-widest">Confirmar nova senha</label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repita a nova senha"
                maxLength={128}
                className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
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
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Salvar nova senha
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-[#132540] border border-red-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 rounded-xl">
            <Settings size={18} className="text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Zona de Perigo</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Desativar conta</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Sua conta e dados serão desativados permanentemente</p>
          </div>
          <button
            onClick={() => toast.error('Entre em contato com o suporte para desativar sua conta.')}
            className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-red-500/20 transition-all"
          >
            Desativar
          </button>
        </div>
      </div>
    </div>
  );
}
