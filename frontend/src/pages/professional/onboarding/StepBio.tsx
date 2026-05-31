import { useState } from 'react';
import { Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

interface StepBioProps {
  bioMutation: UseMutationResult<void, Error, string>;
  onNext: () => void;
  onBack: () => void;
}

export function StepBio({ bioMutation, onNext, onBack }: StepBioProps) {
  const [bio, setBio] = useState('');

  const handleNext = async () => {
    await bioMutation.mutateAsync(bio);
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-7">
        <h2 className="text-3xl font-black text-white tracking-tight">Sobre você</h2>
        <p className="text-[#7A9EBF] font-medium">
          Clientes querem saber mais sobre quem vão contratar.
        </p>
      </div>

      <div>
        <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-8 pl-1">
          Sobre você <span className="normal-case font-medium">(opcional)</span>
        </label>
        <textarea
          rows={5}
          maxLength={500}
          placeholder="Ex: Eletricista com 10 anos de experiência em instalações residenciais e comerciais. Atendo toda a região com pontualidade e qualidade."
          value={bio}
          onChange={e => setBio(e.target.value)}
          className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-9 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium resize-none text-sm leading-relaxed"
        />
        <p className="text-[#4A6580] text-xs mt-6 text-right">{bio.length}/500</p>
      </div>

      <div className="space-y-8 pt-2">
        <button
          type="button"
          onClick={handleNext}
          disabled={bioMutation.isPending}
          className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all flex items-center justify-center gap-7 text-lg uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {bioMutation.isPending
            ? <Loader2 size={22} className="animate-spin" />
            : <><span>Próximo</span><ChevronRight size={20} /></>
          }
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full h-11 flex items-center justify-center gap-7 text-[#7A9EBF] hover:text-white text-sm font-bold transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>
    </div>
  );
}
