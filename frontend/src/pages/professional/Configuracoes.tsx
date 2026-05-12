import { useState, useEffect } from 'react';
import { Bell, Eye, Lock, LogOut, Shield, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

const NOTIF_KEY = 'prof_notif_messages';

export default function ProfessionalConfiguracoes() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Notificações (localStorage)
  const [notifMessages, setNotifMessages] = useState(() => {
    return localStorage.getItem(NOTIF_KEY) !== 'false';
  });

  // Perfil público (banco)
  const [profilePublic, setProfilePublic] = useState(true);
  const [profilePublicLoading, setProfilePublicLoading] = useState(true);
  const [profilePublicSaving, setProfilePublicSaving] = useState(false);

  // Modal de senha
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sair de todos os dispositivos
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase
        .from('professionals')
        .select('is_public')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (data) setProfilePublic(data.is_public ?? true);
      setProfilePublicLoading(false);
    };
    load();
  }, []);

  const handleNotifToggle = (val: boolean) => {
    setNotifMessages(val);
    localStorage.setItem(NOTIF_KEY, String(val));
  };

  const handleProfilePublicToggle = async (val: boolean) => {
    setProfilePublicSaving(true);
    setProfilePublic(val);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase
        .from('professionals')
        .update({ is_public: val })
        .eq('user_id', authUser.id);
    }
    setProfilePublicSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'As senhas não conferem.' });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message });
    } else {
      setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setShowPasswordModal(false); setPasswordMsg(null); }, 2000);
    }
    setPasswordLoading(false);
  };

  const handleSignOutAll = async () => {
    setSignOutLoading(true);
    await supabase.auth.signOut({ scope: 'global' });
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-[#4A6580] text-sm mt-1">Gerencie suas preferências de conta</p>
      </div>

      {/* Notificações */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Bell size={18} />
          </div>
          <div>
            <h2 className="text-white font-bold">Notificações</h2>
            <p className="text-[#4A6580] text-xs">Controle o que você recebe</p>
          </div>
        </div>
        <ToggleRow
          label="Notificações de mensagens"
          description="Receba alertas quando clientes enviarem mensagens"
          value={notifMessages}
          onChange={handleNotifToggle}
        />
      </div>

      {/* Privacidade */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Eye size={18} />
          </div>
          <div>
            <h2 className="text-white font-bold">Privacidade</h2>
            <p className="text-[#4A6580] text-xs">Visibilidade do seu perfil</p>
          </div>
        </div>
        <ToggleRow
          label="Perfil público"
          description="Clientes podem encontrar você nas buscas"
          value={profilePublic}
          onChange={handleProfilePublicToggle}
          loading={profilePublicLoading || profilePublicSaving}
        />
      </div>

      {/* Conta */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Lock size={18} />
          </div>
          <div>
            <h2 className="text-white font-bold">Conta</h2>
            <p className="text-[#4A6580] text-xs">Segurança e acesso</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-slate-200">Alterar senha</p>
            <p className="text-xs text-[#4A6580] mt-0.5">Atualize sua senha de acesso</p>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Alterar
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-slate-200">E-mail da conta</p>
            <p className="text-xs text-[#4A6580] mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Zona de perigo */}
      <div className="bg-[#1C3454] border border-red-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="text-red-400 font-bold">Zona de Perigo</h2>
            <p className="text-[#4A6580] text-xs">Ações irreversíveis</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-slate-200">Sair de todos os dispositivos</p>
            <p className="text-xs text-[#4A6580] mt-0.5">Encerra todas as sessões ativas</p>
          </div>
          <button
            onClick={handleSignOutAll}
            disabled={signOutLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {signOutLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Sair de tudo
          </button>
        </div>
      </div>

      {/* Modal Alterar Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1C3454] border border-[#243F6A] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Alterar Senha</h2>
              <button onClick={() => { setShowPasswordModal(false); setPasswordMsg(null); setNewPassword(''); setConfirmPassword(''); }} className="text-[#4A6580] hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMsg && (
                <div className={cn(
                  'p-3 rounded-xl border flex items-center gap-2 text-sm',
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                )}>
                  {passwordMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {passwordMsg.text}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[#94A3B8] text-sm">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#0E1C32] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[#94A3B8] text-sm">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-[#0E1C32] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  minLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordLoading && <Loader2 size={16} className="animate-spin" />}
                {passwordLoading ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, loading }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-[#4A6580] mt-0.5">{description}</p>
      </div>
      {loading ? (
        <Loader2 size={18} className="animate-spin text-[#4A6580] shrink-0" />
      ) : (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors shrink-0',
            value ? 'bg-emerald-500' : 'bg-slate-700'
          )}
        >
          <span className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
            value ? 'left-5' : 'left-0.5'
          )} />
        </button>
      )}
    </div>
  );
}
