import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useOnboarding } from '../../hooks/useOnboarding';
import { StepFoto } from './onboarding/StepFoto';
import { StepBio } from './onboarding/StepBio';
import { StepMoedas } from './onboarding/StepMoedas';

type Step = 1 | 2 | 3;

const STEP_LABELS = ['Foto', 'Perfil', 'Como funciona'];

export default function Onboarding() {
  const [step, setStep] = useState<Step>(1);
  const { avatarMutation, bioMutation, completeMutation } = useOnboarding();

  return (
    <div className="min-h-screen bg-[#0E1C32] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Configure seu perfil
            </span>
          </div>
          <p className="text-[#7A9EBF] text-sm">
            Passo {step} de {STEP_LABELS.length}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-10">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col gap-1.5">
              <div className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                i + 1 <= step ? 'bg-emerald-500' : 'bg-[#1C3454]',
              )} />
              <span className={cn(
                'text-[9px] font-black uppercase tracking-widest text-center',
                i + 1 <= step ? 'text-emerald-500' : 'text-[#4A6580]',
              )}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
          {step === 1 && (
            <StepFoto
              avatarMutation={avatarMutation}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepBio
              bioMutation={bioMutation}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepMoedas
              completeMutation={completeMutation}
              onBack={() => setStep(2)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
