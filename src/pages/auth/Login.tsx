import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, ArrowLeft, ChevronRight, Briefcase, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

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
    city: '',
    category: '',
    bio: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.name) {
      setError("Por favor, preencha os dados básicos para continuar.");
      return;
    }
    setAuthStep('details');
    setError(null);
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error("Erro no login com Google: " + err.message);
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
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail de recuperação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Initialize state from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const roleParam = params.get('role');
    
    if (mode === 'signup') {
      setIsSignUp(true);
      setIsLockedMode(true);
    } else if (mode === 'login') {
      setIsSignUp(false);
      setIsLockedMode(true);
    }

    if (roleParam === 'professional' || roleParam === 'client' || roleParam === 'admin') {
      setSelectedRole(roleParam as any);
    }
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

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        setMode(selectedRole as any);
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              phone: formData.phone,
              city: formData.city,
              category: formData.category,
              bio: formData.bio
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        toast.success("Conta criada! Verifique seu e-mail.");
      } else {
        setMode(selectedRole as any);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        
        if (signInError) throw signInError;
        
        toast.success("Bem-vindo(a)!");
        // Navigation will be handled by the useEffect once the auth store is updated by AuthInitializer
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-slate-400 font-medium">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
          {selectedRole === 'admin' ? 'Acesso Restrito' : (isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta')}
        </h1>
        <p className="text-slate-500 font-medium">
          {selectedRole === 'admin' ? 'Apenas administradores autorizados' : (isSignUp ? 'Comece agora sua jornada no MeloCalé' : 'Sentimos sua falta! Entre para continuar.')}
        </p>
      </div>

      {isAuthenticated && !role && (
        <div className="mb-8 p-6 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
          <p className="font-bold mb-2 flex items-center gap-2">
            <AlertCircle size={18} />
            Não encontramos seu perfil
          </p>
          <p className="mb-4 text-slate-400">
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
            className="w-full h-14 bg-white hover:bg-slate-100 text-[#0A0B0D] rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl mb-8 group"
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
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-black"><span className="bg-[#0A0B0D] px-6 text-slate-700">Ou use seu e-mail</span></div>
          </div>
        </div>
      )}

      {!isAuthenticated && selectedRole !== 'admin' && !isLockedMode && (
        <div className="flex bg-[#0A0B0D] p-1.5 rounded-2xl mb-8 border border-white/5">
          <button
            onClick={() => { setIsSignUp(false); setAuthStep('basics'); setError(null); }}
            className={cn("flex-1 py-3 text-sm font-black rounded-xl transition-all", !isSignUp ? "bg-white/5 text-white" : "text-slate-500 hover:text-slate-300")}
          >
            Entrar
          </button>
          <button
            onClick={() => { setIsSignUp(true); setAuthStep('basics'); setError(null); }}
            className={cn("flex-1 py-3 text-sm font-black rounded-xl transition-all", isSignUp ? "bg-white/5 text-white" : "text-slate-500 hover:text-slate-300")}
          >
            Cadastrar
          </button>
        </div>
      )}

      {selectedRole !== 'admin' && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelectedRole('client')}
            className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all", selectedRole === 'client' ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-white/5 text-slate-500 bg-white/[0.02] hover:bg-white/[0.05]")}
          >
            <UserIcon size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sou Cliente</span>
          </button>
          <button
            onClick={() => setSelectedRole('professional')}
            className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all", selectedRole === 'professional' ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-white/5 text-slate-500 bg-white/[0.02] hover:bg-white/[0.05]")}
          >
            <Briefcase size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sou Profissional</span>
          </button>
        </div>
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
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Nome Completo</label>
                    <input 
                      required type="text" placeholder="João da Silva" 
                      className="w-full h-16 bg-[#14161B] border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                      value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">E-mail</label>
                  <input 
                    required type="email" placeholder="seu@email.com" 
                    className="w-full h-16 bg-[#14161B] border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                    value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Sua Senha</label>
                    {!isSignUp && (
                      <button type="button" onClick={handleForgotPassword} className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400 tracking-widest transition-colors">Esqueci a senha</button>
                    )}
                  </div>
                  <input 
                    required type="password" placeholder="••••••••" 
                    className="w-full h-16 bg-[#14161B] border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                    value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} minLength={6}
                  />
                </div>
              </>
            )}

            {authStep === 'details' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">WhatsApp de Contato</label>
                  <input 
                    required type="tel" placeholder="(11) 99999-9999" 
                    className="w-full h-16 bg-[#14161B] border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium"
                    value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Sua Cidade</label>
                  <input 
                    required type="text" placeholder="Ex: São Paulo, SP" 
                    className="w-full h-16 bg-[#14161B] border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium"
                    value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                {selectedRole === 'professional' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Especialidade / Categoria</label>
                    <input 
                      required type="text" placeholder="Ex: Pintura, Elétrica..." 
                      className="w-full h-16 bg-[#14161B] border border-white/5 rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium"
                      value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                )}
                <button type="button" onClick={() => setAuthStep('basics')} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold transition-all"><ArrowLeft size={14} /> Voltar para o início</button>
              </div>
            )}

            <button 
              disabled={isSubmitting}
              type="submit"
              className={cn(
                "w-full h-16 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-2xl mt-12 uppercase tracking-widest",
                isSignUp 
                  ? "bg-yellow-400 hover:bg-yellow-500 text-black shadow-yellow-500/20 active:scale-95" 
                  : (selectedRole === 'admin' ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20" :
                    "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20")
              )}
            >
              {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (
                isSignUp && authStep === 'basics' ? <>Próximo Passo <ChevronRight size={20} /></> :
                isSignUp ? "Concluir Cadastro" : "Entrar na Plataforma"
              )}
            </button>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
