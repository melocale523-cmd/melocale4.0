import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, ArrowLeft, ChevronRight, Briefcase, User as UserIcon, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { API_URL } from '../../lib/api';
import { AddressForm, type AddressValue, emptyAddress } from '../../components/AddressForm';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Senha deve ter pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(password)) return 'Senha deve ter pelo menos um número.';
  return null;
}

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  return score as 0 | 1 | 2 | 3;
}

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  const loading = useAuthStore((state) => state.isLoading);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLockedMode, setIsLockedMode] = useState(false);
  const [authStep, setAuthStep] = useState<'basics' | 'details'>('basics');
  const [selectedRole, setSelectedRole] = useState<'client' | 'professional' | 'admin'>('client');
  const setMode = useAuthStore((state) => state.setMode);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    category: '',
    customCategory: '',
    bio: ''
  });
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [legalModal, setLegalModal] = useState<'termos' | 'privacidade' | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data?.length) {
          const sorted = [
            ...data.filter((c: { name: string }) => c.name === 'Outro'),
            ...data.filter((c: { name: string }) => c.name !== 'Outro'),
          ];
          setCategorias(sorted.map((c: { name: string }) => c.name));
        }
      });
  }, []);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.name) {
      setError("Por favor, preencha os dados básicos para continuar.");
      return;
    }
    const pwErr = validatePassword(formData.password);
    if (pwErr) { setError(pwErr); return; }
    setAuthStep('details');
    setError(null);
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login?oauth=1`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error("Erro no login com Google: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleForgotPassword = async () => {
    if (!formData.email || !validateEmail(formData.email)) {
      setError("Por favor, insira um e-mail válido para recuperar sua senha.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch {
      toast.error("Não encontramos uma conta com este e-mail.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Initialize state from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const roleParam = params.get('role');
    const refCode = params.get('ref');

    if (mode === 'signup') {
      setIsSignUp(true);
      setIsLockedMode(true);
    } else if (mode === 'login') {
      setIsSignUp(false);
      setIsLockedMode(true);
    }

    if (roleParam === 'professional' || roleParam === 'client') {
      setSelectedRole(roleParam as 'professional' | 'client');
    }

    if (refCode) sessionStorage.setItem('melocale_ref', refCode);
  }, []);

  // Wait for the router logic located in AuthRedirect to decide where to go
  // when authenticated. We use AuthRedirect on the /login route for this.


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(formData.email)) {
      setError("Por favor, insira um formato de e-mail válido.");
      return;
    }

    if (isSignUp) {
      const pwErr = validatePassword(formData.password);
      if (pwErr) { setError(pwErr); return; }
      if (formData.category === 'Outro' && !formData.customCategory.trim()) {
        setError('Por favor, descreva sua profissão.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const finalCategory = formData.category === 'Outro'
          ? formData.customCategory
          : formData.category;

        const derivedCity = [address.city, address.state].filter(Boolean).join(' - ');

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: selectedRole,
              phone: formData.phone,
              city: derivedCity || null,
              category: finalCategory,
              bio: formData.bio
            }
          }
        });

        if (signUpError) throw signUpError;

        setMode(selectedRole);

        await supabase.from('profiles').upsert({
          id: signUpData.user?.id,
          full_name: formData.name,
          phone: formData.phone || null,
          city: derivedCity || null,
          role: selectedRole,
          cep: address.cep || null,
          address_zipcode: address.cep || null,
          address_street: address.street || null,
          address_number: address.number || null,
          address_block: address.block || null,
          address_complement: address.complement || null,
          address_neighborhood: address.neighborhood || null,
          address_city: address.city || null,
          address_state: address.state || null,
        }, { onConflict: 'id' });

        if (selectedRole === 'professional' && signUpData.user) {
          await supabase.rpc('save_full_profile', {
            p_user_id: signUpData.user.id,
            p_full_name: formData.name ?? '',
            p_phone: formData.phone ?? '',
            p_bio: formData.bio ?? '',
            p_category: finalCategory ?? '',
            p_service_radius: 50,
          });
        }

        const pendingRef = sessionStorage.getItem('melocale_ref');
        if (pendingRef && signUpData.user?.id) {
          try {
            await fetch(`${API_URL}/api/referrals/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: pendingRef, newUserId: signUpData.user.id }),
            });
          } catch {
            // silencioso — não bloquear o cadastro por falha de indicação
          }
          sessionStorage.removeItem('melocale_ref');
        }

        toast.success("Conta criada! Verifique seu e-mail.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) throw signInError;

        toast.success("Bem-vindo(a)!");
        // Navigation handled by AuthInitializer → authStore → AuthRedirect using profiles.role
      }
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e clique no link que enviamos.');
      } else if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('E-mail ou senha incorretos. Verifique seus dados e tente novamente.');
      } else if (msg.includes('too many requests')) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOAuth = new URLSearchParams(window.location.search).get('oauth') === '1';

  if (loading || isOAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-[#B0C4D8] font-medium">{isOAuth ? 'Entrando com Google...' : 'Carregando...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
          {selectedRole === 'admin' ? 'Acesso Restrito' : (isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta')}
        </h1>
        <p className="text-[#7A9EBF] font-medium">
          {selectedRole === 'admin' ? 'Apenas administradores autorizados' : (isSignUp ? 'Comece agora sua jornada no MeloCalé' : 'Sentimos sua falta! Entre para continuar.')}
        </p>
      </div>

      {isAuthenticated && !role && (
        <div className="mb-8 p-6 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
          <p className="font-bold mb-2 flex items-center gap-2">
            <AlertCircle size={18} />
            Não encontramos seu perfil
          </p>
          <p className="mb-4 text-[#B0C4D8]">
            Você está autenticado, mas não conseguimos carregar suas informações de perfil. Escolha sua função abaixo ou tente entrar novamente.
          </p>
          <button 
            onClick={() => { useAuthStore.getState().logout(); supabase.auth.signOut(); }}
            className="text-xs font-black uppercase tracking-widest text-white border border-white/20 px-4 py-2 rounded-xl hover:bg-white/5 transition-all"
          >
            Sair e tentar de novo
          </button>
        </div>
      )}

      {!isAuthenticated && selectedRole !== 'admin' && (
        <div className="mb-10">
          <button 
            onClick={handleGoogleLogin}
            className="w-full h-14 bg-white hover:bg-slate-100 text-[#0E1C32] rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl mb-8 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#1C3050]"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-black"><span className="bg-[#0E1C32] px-6 text-[#94A3B8]">Ou use seu e-mail</span></div>
          </div>
        </div>
      )}

      {!isAuthenticated && selectedRole !== 'admin' && !isLockedMode && (
        <div className="flex bg-[#0E1C32] p-1.5 rounded-2xl mb-8 border border-[#1C3050]">
          <button
            onClick={() => { setIsSignUp(false); setAuthStep('basics'); setError(null); }}
            className={cn("flex-1 py-3 text-sm font-black rounded-xl transition-all", !isSignUp ? "bg-white/5 text-white" : "text-[#7A9EBF] hover:text-slate-300")}
          >
            Entrar
          </button>
          <button
            onClick={() => { setIsSignUp(true); setAuthStep('basics'); setError(null); }}
            className={cn("flex-1 py-3 text-sm font-black rounded-xl transition-all", isSignUp ? "bg-white/5 text-white" : "text-[#7A9EBF] hover:text-slate-300")}
          >
            Cadastrar
          </button>
        </div>
      )}

      {selectedRole !== 'admin' && (
        <>
        <p className="text-[10px] font-black text-[#7A9EBF] uppercase tracking-widest mb-3">
          {isSignUp ? 'Como deseja se cadastrar?' : 'Como deseja acessar?'}
        </p>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelectedRole('client')}
            className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all", selectedRole === 'client' ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-[#1C3050] text-[#7A9EBF] bg-white/[0.02] hover:bg-white/[0.05]")}
          >
            <UserIcon size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sou Cliente</span>
          </button>
          <button
            onClick={() => setSelectedRole('professional')}
            className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all", selectedRole === 'professional' ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-[#1C3050] text-[#7A9EBF] bg-white/[0.02] hover:bg-white/[0.05]")}
          >
            <Briefcase size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sou Profissional</span>
          </button>
        </div>
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${isSignUp}-${authStep}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {error && (
            <div className="mb-8 p-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex gap-3 items-center italic font-medium">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={isSignUp && authStep === 'basics' ? handleNextStep : handleSubmit} className="space-y-6">
            {authStep === 'basics' && (
              <>
                {isSignUp && (
                  <div>
                    <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">Nome Completo</label>
                    <input
                      required type="text" placeholder="João da Silva" maxLength={100}
                      className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                      value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">E-mail</label>
                  <input
                    required type="email" placeholder="seu@email.com" maxLength={254}
                    className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                    value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] ml-1">Sua Senha</label>
                    {!isSignUp && (
                      <button type="button" onClick={handleForgotPassword} className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400 tracking-widest transition-colors">Esqueci a senha</button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      required type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 pr-12 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                      value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} minLength={8} maxLength={128}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B0C4D8] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isSignUp && formData.password.length > 0 && (() => {
                    const strength = getPasswordStrength(formData.password);
                    const colors = { 0: 'bg-white/10', 1: 'bg-red-500', 2: 'bg-yellow-400', 3: 'bg-emerald-500' } as const;
                    const activeColor = colors[strength];
                    return (
                      <div className="flex gap-1 mt-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? activeColor : 'bg-white/10'}`} />
                        ))}
                      </div>
                    );
                  })()}
                  {isSignUp && (
                    <div className="flex items-center gap-3 mt-2">
                      {[
                        { ok: formData.password.length >= 8, label: '8+ chars' },
                        { ok: /[A-Z]/.test(formData.password), label: 'Maiúscula' },
                        { ok: /[0-9]/.test(formData.password), label: 'Número' },
                      ].map(({ ok, label }) => (
                        <span
                          key={label}
                          className={`text-[13px] font-bold flex items-center gap-1 transition-colors ${ok ? 'text-emerald-400' : 'text-[#7A9EBF]'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-[#7A9EBF]'}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {authStep === 'details' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">WhatsApp de Contato</label>
                  <input
                    required type="tel" placeholder="(11) 99999-9999" maxLength={20}
                    className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium"
                    value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">Endereço</label>
                  <AddressForm value={address} onChange={setAddress} variant="signup" />
                </div>
                {selectedRole === 'professional' && (
                  <div>
                    <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">Especialidade / Categoria</label>
                    <select
                      required
                      className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium appearance-none cursor-pointer"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="" disabled>Selecione sua especialidade</option>
                      {categorias.map(cat => (
                        <option key={cat} value={cat} className="bg-[#0E1C32] text-white">{cat}</option>
                      ))}
                    </select>
                    {formData.category === 'Outro' && (
                      <input
                        type="text"
                        required
                        placeholder="Descreva sua profissão..."
                        maxLength={100}
                        className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium mt-3"
                        value={formData.customCategory}
                        onChange={(e) => setFormData({...formData, customCategory: e.target.value})}
                      />
                    )}
                  </div>
                )}
                {selectedRole === 'professional' && (
                  <div>
                    <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">
                      Sobre você (opcional)
                    </label>
                    <textarea
                      placeholder="Descreva brevemente sua experiência e serviços..."
                      rows={3}
                      maxLength={500}
                      className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium resize-none text-sm leading-relaxed"
                      value={formData.bio}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    />
                  </div>
                )}
                <button type="button" onClick={() => setAuthStep('basics')} className="flex items-center gap-2 text-[#7A9EBF] hover:text-white text-xs font-bold transition-all"><ArrowLeft size={14} /> Voltar para o início</button>
              </div>
            )}

            <button 
              disabled={isSubmitting}
              type="submit"
              className={cn(
                "w-full h-16 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-2xl mt-12 uppercase tracking-widest",
                isSignUp 
                  ? "bg-yellow-400 hover:bg-yellow-500 text-black shadow-yellow-500/20 active:scale-95" 
                  : (selectedRole === 'admin' ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20" :
                    "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20")
              )}
            >
              {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (
                isSignUp && authStep === 'basics' ? <>Próximo Passo <ChevronRight size={20} /></> :
                isSignUp ? "Concluir Cadastro" : "Entrar na Plataforma"
              )}
            </button>
          </form>

          {isSignUp && (
            <p className="text-[#7A9EBF] text-xs font-medium leading-relaxed text-center mt-4">
              Ao continuar você declara que leu e concorda com nossos{' '}
              <button type="button" onClick={() => setLegalModal('termos')} className="text-[#B0C4D8] hover:text-white underline font-semibold">
                Termos de Uso
              </button>
              {' '}e{' '}
              <button type="button" onClick={() => setLegalModal('privacidade')} className="text-[#B0C4D8] hover:text-white underline font-semibold">
                Políticas de Privacidade
              </button>.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {legalModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setLegalModal(null)} />
          <div className="relative w-full max-w-lg bg-[#0E1C32] border border-[#1C3050] rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C3050] shrink-0">
              <h3 className="text-white font-black text-lg">
                {legalModal === 'termos' ? 'Termos de Uso' : 'Políticas de Privacidade'}
              </h3>
              <button type="button" onClick={() => setLegalModal(null)} className="p-2 rounded-xl hover:bg-white/5 text-[#7A9EBF] hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 text-[#94A3B8] text-sm leading-relaxed space-y-4">
              {legalModal === 'termos' ? (
                <>
                  <section><h4 className="text-white font-bold mb-2">1. Aceitação dos Termos</h4><p>Ao acessar e usar o MeloCalé, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.</p></section>
                  <section><h4 className="text-white font-bold mb-2">2. Descrição do Serviço</h4><p>O MeloCalé é uma plataforma que conecta clientes que precisam de serviços domésticos a profissionais qualificados.</p></section>
                  <section><h4 className="text-white font-bold mb-2">3. Responsabilidades do Usuário</h4><p>Você é responsável por manter a confidencialidade de sua conta e senha, e por todas as atividades realizadas sob sua conta.</p></section>
                  <section><h4 className="text-white font-bold mb-2">4. Pagamentos</h4><p>Profissionais adquirem moedas para acessar leads. Valores e condições estão descritos na página de planos. Pagamentos são processados via Stripe.</p></section>
                  <section><h4 className="text-white font-bold mb-2">5. Alterações</h4><p>Reservamos o direito de modificar estes termos a qualquer momento. Alterações serão comunicadas via e-mail ou notificação na plataforma.</p></section>
                  <section><h4 className="text-white font-bold mb-2">6. Contato</h4><p>Dúvidas sobre os termos: contato@melocale.com.br</p></section>
                </>
              ) : (
                <>
                  <section><h4 className="text-white font-bold mb-2">1. Dados Coletados</h4><p>Coletamos nome, e-mail, telefone, localização e dados de uso para operar a plataforma e conectar clientes a profissionais.</p></section>
                  <section><h4 className="text-white font-bold mb-2">2. Uso dos Dados</h4><p>Seus dados são usados exclusivamente para prestação do serviço, comunicações relacionadas à plataforma e melhorias do produto.</p></section>
                  <section><h4 className="text-white font-bold mb-2">3. Compartilhamento</h4><p>Não vendemos seus dados. Compartilhamos apenas com parceiros essenciais para operação (processador de pagamento, provedor de e-mail).</p></section>
                  <section><h4 className="text-white font-bold mb-2">4. Segurança</h4><p>Utilizamos criptografia e boas práticas de segurança para proteger seus dados. Autenticação gerenciada pelo Supabase Auth.</p></section>
                  <section><h4 className="text-white font-bold mb-2">5. Seus Direitos</h4><p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail: contato@melocale.com.br</p></section>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#1C3050] shrink-0">
              <button type="button" onClick={() => setLegalModal(null)} className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-2xl transition-all">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
