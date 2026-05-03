import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Briefcase, ChevronRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore, Role } from '../../store/authStore';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'role' | 'basics' | 'details'>('role');
  const [selectedRole, setSelectedRole] = useState<'client' | 'professional' | null>(null);
  const setMode = useAuthStore((state) => state.setMode);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    city: '',
    category: '',
    specialty: '',
    bio: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelect = (role: 'client' | 'professional') => {
    setSelectedRole(role);
    setStep('basics');
  };

  const handleNextStep = () => {
    if (step === 'basics') {
      if (!formData.email || !formData.password || !formData.name) {
        setError("Por favor, preencha todos os campos.");
        return;
      }
      setStep('details');
      setError(null);
    }
  };

  const handleBack = () => {
    if (step === 'details') setStep('basics');
    else if (step === 'basics') setStep('role');
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
      toast.error("Erro ao entrar com Google: " + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
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
        
        toast.success("Conta criada com sucesso! Verifique seu e-mail.");
        onClose();
        navigate('/login');
      } else {
        setMode(selectedRole as any);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        
        if (signInError) throw signInError;
        
        toast.success("Bem-vindo(a) de volta!");
        onClose();
        // The router component (AuthRedirect or ProtectedRoute) handles redirection automatically
        // thanks to AuthInitializer!
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full bg-[#07080A] rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5 my-auto transition-all duration-500",
              step === 'role' ? 'max-w-4xl' : 'max-w-xl'
            )}
          >
            {/* Steps Progress */}
            {mode === 'signup' && step !== 'role' && (
              <div className="flex h-1.5 w-full bg-white/5">
                <div className={cn("h-full bg-emerald-500 transition-all duration-500", step === 'basics' ? 'w-1/2' : 'w-full')} />
              </div>
            )}

            {/* Close Button */}
            <button 
              onClick={onClose} 
              className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all z-10"
            >
              <X size={24} />
            </button>

            <div className="p-8 md:p-12">
              {step === 'role' ? (
                <div className="text-center">
                  {/* Security Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 mb-8">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Área de Acesso Seguro</span>
                  </div>

                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
                    {mode === 'signup' ? 'Escolha como deseja se cadastrar' : 'Entre na sua conta'}
                  </h1>
                  <p className="text-slate-500 font-medium mb-12">
                    {mode === 'signup' ? 'Selecione a opção que melhor se adequa ao seu perfil' : 'Escolha como deseja acessar seu painel'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Client Card */}
                    <button
                      onClick={() => handleRoleSelect('client')}
                      className="group relative flex flex-col text-left p-8 rounded-[2rem] bg-[#0F1116] border border-white/5 hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition-all duration-500 h-full"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform mb-8">
                        <User size={32} />
                      </div>
                      
                      <h3 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors mb-4">
                        {mode === 'signup' ? 'Sou Cliente' : 'Área do Cliente'}
                      </h3>
                      
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">
                        {mode === 'signup' 
                          ? 'Preciso contratar profissionais para serviços em minha casa' 
                          : 'Gerencie seus pedidos e contrate profissionais'}
                      </p>

                      {mode === 'signup' && (
                        <ul className="space-y-3 mb-8">
                          {['Solicite orçamentos grátis', 'Compare profissionais', 'Contrate com segurança'].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-xs font-bold text-slate-400">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto flex items-center gap-2 text-sm font-black text-slate-600 group-hover:text-blue-400 transition-all">
                        <span>{mode === 'signup' ? 'Sou Cliente' : 'Acessar Minha Conta'}</span>
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                    {/* Professional Card */}
                    <button
                      onClick={() => handleRoleSelect('professional')}
                      className="group relative flex flex-col text-left p-8 rounded-[2rem] bg-[#0F1116] border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all duration-500 h-full"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform mb-8">
                        <Briefcase size={32} />
                      </div>
                      
                      <h3 className="text-2xl font-black text-white group-hover:text-emerald-400 transition-colors mb-4">
                        {mode === 'signup' ? 'Sou Profissional' : 'Área do Profissional'}
                      </h3>
                      
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">
                        {mode === 'signup'
                          ? 'Quero oferecer meus serviços e receber solicitações de clientes'
                          : 'Acesse seus leads e envie propostas agora'}
                      </p>

                      {mode === 'signup' && (
                        <ul className="space-y-3 mb-8">
                          {['Aumente sua receita mensal', 'Clientes prontos para contratar', 'Expanda seu negócio'].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-xs font-bold text-slate-400">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto flex items-center gap-2 text-sm font-black text-slate-600 group-hover:text-emerald-400 transition-all">
                        <span>{mode === 'signup' ? 'Sou Profissional' : 'Acessar Painel Pro'}</span>
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </div>

                  {/* Google Login Footer */}
                  <div className="mt-12 pt-8 border-t border-white/5">
                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-6">Ou conecte-se instantaneamente</p>
                    <button 
                      onClick={handleGoogleLogin}
                      className="w-full h-16 bg-white hover:bg-slate-100 text-black rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-2xl group active:scale-95"
                    >
                      <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                      </svg>
                      {mode === 'signup' ? 'Cadastrar com Google' : 'Entrar com Google'}
                    </button>
                    
                    <button 
                      onClick={() => navigate('/login' + (mode === 'login' ? '?mode=signup' : ''))}
                      className="mt-8 text-slate-500 text-sm font-medium hover:text-white transition-colors"
                    >
                      {mode === 'signup' ? 'Já tem conta? ' : 'Ainda não é cadastrado? '}
                      <span className="text-blue-500 font-bold hover:underline">
                        {mode === 'signup' ? 'Fazer login' : 'Comece agora'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  {/* Header for steps */}
                  <div className="flex items-center gap-4 mb-8">
                    <button onClick={handleBack} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all border border-white/5">
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tight">
                        {mode === 'signup' ? 'Falta pouco...' : 'Acessar minha conta'}
                      </h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        {selectedRole === 'client' ? 'Perfil de Cliente' : 'Perfil de Profissional'}
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex gap-3 items-center italic font-medium">
                      <AlertCircle size={20} className="shrink-0" /> {error}
                    </div>
                  )}

                  <form onSubmit={step === 'basics' && mode === 'signup' ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit} className="space-y-6">
                    {step === 'basics' && (
                      <>
                        <div className="space-y-5">
                          <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">Nome Completo</label>
                            <input 
                              required type="text" placeholder="Como devemos te chamar?" 
                              className="w-full bg-[#14161B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">E-mail de Acesso</label>
                            <input 
                              required type="email" placeholder="seu@email.com" 
                              className="w-full bg-[#14161B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                              value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">Sua Senha</label>
                            <input 
                              required type="password" placeholder="Mínimo 6 caracteres" 
                              className="w-full bg-[#14161B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                              value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} minLength={6}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {step === 'details' && (
                      <>
                        <div className="space-y-5">
                          <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">WhatsApp para Contato</label>
                            <input 
                              required type="tel" placeholder="(00) 00000-0000" 
                              className="w-full bg-[#14161B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                              value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">Cidade / Localização</label>
                            <input 
                              required type="text" placeholder="Onde você está localizado?" 
                              className="w-full bg-[#14161B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                              value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})}
                            />
                          </div>
                          {selectedRole === 'professional' && (
                            <div>
                              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-1">Área de Atuação</label>
                              <input 
                                required type="text" placeholder="Ex: Eletricista, Pintor..." 
                                className="w-full bg-[#14161B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                                value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <button 
                      disabled={isSubmitting}
                      type="submit"
                      className={cn(
                        "w-full h-16 rounded-[1.25rem] font-black text-lg transition-all flex items-center justify-center gap-3 shadow-2xl mt-8 uppercase tracking-widest",
                        mode === 'signup' 
                          ? "bg-yellow-400 hover:bg-yellow-500 text-black shadow-yellow-500/20" 
                          : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20"
                      )}
                    >
                      {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (
                        step === 'basics' && mode === 'signup' ? <>Próximo Passo <ChevronRight size={20} /></> : 
                        mode === 'signup' ? 'Concluir Cadastro' : 'Entrar na Plataforma'
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 bg-[#0A0B0D] border-t border-white/5 text-center">
              <p className="text-slate-600 text-xs font-medium leading-relaxed">
                Ao continuar você declara que leu e concorda com nossos <br /> 
                <a href="#" className="text-slate-400 hover:text-white underline">Termos de Uso</a> e <a href="#" className="text-slate-400 hover:text-white underline">Políticas de Privacidade</a>.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
