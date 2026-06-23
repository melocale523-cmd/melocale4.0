import { AlertCircle, Loader2, X } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from './constants';

interface Props {
  open: boolean;
  onClose: () => void;
  buyingId: string | null;
  onSelectPlan: (planId: string) => void;
}

export default function ChangePlanModal({ open, onClose, buyingId, onSelectPlan }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1C3454] border border-[#243F6A] rounded-xl p-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-lg">Mudar de Plano</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
          <AlertCircle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-yellow-300 text-xs">Ao mudar de plano, o plano atual será cancelado automaticamente.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div key={plan.id} className={`bg-[#0E1C32] border ${plan.popular ? 'border-emerald-500/40' : plan.color === 'blue' ? 'border-blue-500/20' : 'border-yellow-500/20'} rounded-xl p-3 flex flex-col`}>
              <div className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-md mb-1.5 ${
                plan.popular ? 'bg-emerald-500/20 text-emerald-400' : plan.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {plan.discount} OFF
              </div>
              <h3 className="text-white font-bold text-sm mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-0.5 mb-1">
                <span className="text-slate-400 text-xs">R$</span>
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-500 text-xs ml-0.5">/mês</span>
              </div>
              <p className="text-slate-400 text-xs mb-3 flex-1">{plan.description}</p>
              <button
                disabled={!!buyingId}
                onClick={() => { onClose(); onSelectPlan(plan.id); }}
                className={`w-full h-10 ${
                  plan.popular ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : plan.color === 'blue' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                } text-sm font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {buyingId === plan.id ? <Loader2 size={14} className="animate-spin" /> : 'Assinar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
