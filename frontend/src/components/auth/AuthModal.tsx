import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthForm, validatePassword } from '../../hooks/useAuthForm';
import { RoleSelector } from './RoleSelector';
import { BasicsStep } from './BasicsStep';
import { DetailsStep } from './DetailsStep';
import { LegalModal } from './LegalModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const [step, setStep] = useState<'role' | 'basics' | 'details'>('role');
  const [selectedRole, setSelectedRole] = useState<'client' | 'professional' | null>(null);
  const [legalModal, setLegalModal] = useState<'termos' | 'privacidade' | null>(null);

  const {
    formData,
    onChange,
    address,
    onAddressChange,
    isSubmitting,
    error,
    setError,
    showPassword,
    setShowPassword,
    categorias,
    handleForgotPassword,
    handleGoogleLogin,
    handleSubmit,
  } = useAuthForm({ mode, selectedRole, onClose });

  const handleRoleSelect = (role: 'client' | 'professional') => {
    setSelectedRole(role);
    setStep('basics');
  };

  const handleNextStep = () => {
    if (step === 'basics') {
      if (!formData.email || !formData.password || (mode === 'signup' && !formData.name)) {
        setError('Por favor, preencha todos os campos.');
        return;
      }
      if (mode === 'signup') {
        const pwErr = validatePassword(formData.password);
        if (pwErr) { setError(pwErr); return; }
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-9 sm:p-6 overflow-y-auto">
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
                'relative w-full bg-[#0E1C32] rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-[#1C3050] my-auto transition-all duration-500',
                step === 'role' ? 'max-w-4xl' : 'max-w-xl',
              )}
            >
              {mode === 'signup' && step !== 'role' && (
                <div className="flex h-1.5 w-full bg-white/5">
                  <div className={cn('h-full bg-emerald-500 transition-all duration-500', step === 'basics' ? 'w-1/2' : 'w-full')} />
                </div>
              )}

              <button
                onClick={onClose}
                className="absolute top-8 right-8 p-8 hover:bg-white/5 rounded-2xl text-[#7A9EBF] hover:text-white transition-all z-10"
              >
                <X size={24} />
              </button>

              <div className="p-8 md:p-12">
                {step === 'role' ? (
                  <RoleSelector
                    mode={mode}
                    onSelect={handleRoleSelect}
                    onGoogleLogin={handleGoogleLogin}
                  />
                ) : (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-11">
                    <div className="flex items-center gap-9 mb-13">
                      <button onClick={handleBack} className="p-8 bg-white/5 hover:bg-white/10 rounded-2xl text-[#B0C4D8] hover:text-white transition-all border border-[#1C3050]">
                        <ArrowLeft size={20} />
                      </button>
                      <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                          {mode === 'signup' ? 'Falta pouco...' : 'Acessar minha conta'}
                        </h2>
                        <p className="text-[#7A9EBF] text-xs font-bold uppercase tracking-widest mt-6">
                          {selectedRole === 'client' ? 'Perfil de Cliente' : 'Perfil de Profissional'}
                        </p>
                      </div>
                    </div>

                    {error && (
                      <div className="p-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex gap-8 items-center italic font-medium">
                        <AlertCircle size={20} className="shrink-0" /> {error}
                      </div>
                    )}

                    <form
                      onSubmit={step === 'basics' && mode === 'signup' ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit}
                      className="space-y-11"
                    >
                      {step === 'basics' && (
                        <BasicsStep
                          mode={mode}
                          formData={formData}
                          onChange={onChange}
                          showPassword={showPassword}
                          onTogglePassword={() => setShowPassword(p => !p)}
                          onForgotPassword={handleForgotPassword}
                          isSubmitting={isSubmitting}
                        />
                      )}

                      {step === 'details' && (
                        <DetailsStep
                          formData={formData}
                          onChange={onChange}
                          address={address}
                          onAddressChange={onAddressChange}
                          categorias={categorias}
                          selectedRole={selectedRole}
                        />
                      )}

                      <button
                        disabled={isSubmitting}
                        type="submit"
                        className={cn(
                          'w-full h-16 rounded-[1.25rem] font-black text-lg transition-all flex items-center justify-center gap-8 shadow-2xl mt-13 uppercase tracking-widest',
                          mode === 'signup'
                            ? 'bg-yellow-400 hover:bg-yellow-500 text-black shadow-yellow-500/20'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20',
                        )}
                      >
                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (
                          step === 'basics' && mode === 'signup'
                            ? <>Próximo Passo <ChevronRight size={20} /></>
                            : mode === 'signup' ? 'Concluir Cadastro' : 'Entrar na Plataforma'
                        )}
                      </button>
                    </form>

                    {mode === 'signup' && (
                      <p className="text-[#7A9EBF] text-xs font-medium leading-relaxed text-center mt-9">
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
                )}
              </div>
            </motion.div>
          </div>

          {legalModal && (
            <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
