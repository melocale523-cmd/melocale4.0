import { Loader2, Coins, ArrowLeft, Zap, ShieldCheck, TrendingUp } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

interface StepMoedasProps {
  completeMutation: UseMutationResult<void, Error, void>;
  onBack: () => void;
}

const FEATURES = [
  {
    icon: <Zap size={20} className="text-yellow-400" />,
    title: 'Acesso a leads qualificados',
    description: 'Clientes reais que precisam de serviços agora. Compre moedas e desbloqueie o contato.',
  },
  {
    icon: <ShieldCheck size={20} className="text-emerald-400" />,
    title: 'Pagamento único por lead',
    description: 'Você paga apenas para ver os dados do cliente. Sem mensalidade obrigatória.',
  },
  {
    icon: <TrendingUp size={20} className="text-blue-400" />,
    title: 'Quanto mais leads, mais oportunidades',
    description: 'Profissionais ativos faturam em média 3x mais do que os inativos na plataforma.',
  },
];

export function StepMoedas({ completeMutation, onBack }: StepMoedasProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-7">
        <div className="flex items-center gap-8">
          <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center">
            <Coins size={26} className="text-yellow-400" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Como funciona</h2>
        </div>
        <p className="text-[#7A9EBF] font-medium">
          Entenda como o sistema de moedas te conecta com clientes prontos para contratar.
        </p>
      </div>

      <div className="space-y-9">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex gap-9 p-10 bg-[#1C3454] border border-[#243F6A] rounded-2xl">
            <div className="w-10 h-10 bg-[#0E1C32] rounded-xl flex items-center justify-center shrink-0">
              {f.icon}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{f.title}</p>
              <p className="text-[#7A9EBF] text-xs mt-6 leading-relaxed">{f.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-10">
        <p className="text-yellow-400 text-xs font-black uppercase tracking-widest mb-6">Bônus de boas-vindas</p>
        <p className="text-white text-sm font-medium leading-relaxed">
          Seu perfil está pronto. Comece a receber leads e expanda seu negócio hoje mesmo.
        </p>
      </div>

      <div className="space-y-8 pt-2">
        <button
          type="button"
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-2xl transition-all flex items-center justify-center gap-7 text-lg uppercase tracking-widest shadow-lg shadow-yellow-400/20 disabled:opacity-50"
        >
          {completeMutation.isPending
            ? <Loader2 size={22} className="animate-spin" />
            : 'Começar a usar a plataforma'
          }
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={completeMutation.isPending}
          className="w-full h-11 flex items-center justify-center gap-7 text-[#7A9EBF] hover:text-white text-sm font-bold transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>
    </div>
  );
}
