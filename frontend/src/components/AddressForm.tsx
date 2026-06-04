import { useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { logService } from '../lib/logService';

export interface AddressValue {
  cep: string;
  street: string;
  number: string;
  block: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export const emptyAddress: AddressValue = {
  cep: '', street: '', number: '', block: '', complement: '', neighborhood: '', city: '', state: '',
};

interface AddressFormProps {
  value: AddressValue;
  onChange: (address: AddressValue) => void;
  /** 'profile' uses the compact dark-card style; 'signup' matches the modal input style */
  variant?: 'profile' | 'signup';
  cityError?: string;
}

export function AddressForm({ value, onChange, variant = 'profile', cityError }: AddressFormProps) {
  const [loading, setLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [viacepFilled, setViacepFilled] = useState(false);

  // Keep a ref to avoid stale closure inside the async fetch
  const latestValue = useRef(value);
  latestValue.current = value;

  const isSignup = variant === 'signup';

  const baseInput = isSignup
    ? 'w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium'
    : 'w-full bg-[#0E1C32] border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all';

  const filledInput = isSignup
    ? 'w-full bg-[#1A2D44] border border-emerald-500/40 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium'
    : 'w-full bg-[#162A3A] border border-emerald-500/30 rounded-lg px-3 py-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all';

  const errorInput = isSignup
    ? 'w-full bg-[#1C3454] border border-red-500/60 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-red-500 transition-all font-medium'
    : 'w-full bg-[#0E1C32] border border-red-500/60 rounded-lg px-3 py-2.5 text-slate-200 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all';

  const labelClass = isSignup
    ? 'block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1'
    : 'block text-[#94A3B8] text-sm mb-1';

  const optionalSpan = isSignup
    ? <span className="normal-case font-normal tracking-normal text-slate-500"> (opcional)</span>
    : <span className="text-slate-600 font-normal"> (opcional)</span>;

  const autoFillHint = !isSignup && (
    <span className="text-slate-600 font-normal ml-1 text-xs">(preenche automaticamente)</span>
  );

  const fieldInput = (autoFilled: boolean) =>
    viacepFilled && autoFilled ? filledInput : baseInput;

  const formatCep = (digits: string) =>
    digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCepError(null);
    setViacepFilled(false);
    onChange({ ...latestValue.current, cep: digits });
    if (digits.length !== 8) return;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número e preencha os campos manualmente.');
      } else {
        onChange({
          ...latestValue.current,
          cep: digits,
          street: data.logradouro || latestValue.current.street,
          neighborhood: data.bairro || latestValue.current.neighborhood,
          city: data.localidade || latestValue.current.city,
          state: data.uf || latestValue.current.state,
        });
        setViacepFilled(true);
      }
    } catch (err) {
      logService.warn('AddressForm', 'ViaCEP lookup failed', err);
      setCepError('Erro ao consultar o CEP. Preencha os campos manualmente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* CEP */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label className={labelClass} style={{ marginBottom: '0.5rem' }}>
          CEP{autoFillHint}
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={formatCep(value.cep)}
            onChange={handleCepChange}
            placeholder="00000-000"
            maxLength={9}
            className={`${baseInput} pr-9`}
          />
          {loading && (
            <Loader2 size={15} className="animate-spin text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>
        {cepError && (
          <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5">
            <AlertCircle size={12} className="shrink-0" /> {cepError}
          </p>
        )}
      </div>

      {/* Rua + Número */}
      <div className="grid grid-cols-3 gap-8" style={{ marginBottom: '1.25rem' }}>
        <div className="col-span-2">
          <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Rua / Logradouro</label>
          <input
            type="text"
            maxLength={200}
            value={value.street}
            onChange={e => onChange({ ...value, street: e.target.value })}
            placeholder="Rua das Flores"
            className={fieldInput(!!value.street)}
          />
        </div>
        <div>
          <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Número</label>
          <input
            type="text"
            maxLength={20}
            value={value.number}
            onChange={e => onChange({ ...value, number: e.target.value })}
            placeholder="123"
            className={baseInput}
          />
        </div>
      </div>

      {/* Quadra + Complemento */}
      <div className="grid grid-cols-2 gap-8" style={{ marginBottom: '1.25rem' }}>
        <div>
          <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Quadra{optionalSpan}</label>
          <input
            type="text"
            maxLength={20}
            value={value.block}
            onChange={e => onChange({ ...value, block: e.target.value })}
            placeholder="Quadra A"
            className={baseInput}
          />
        </div>
        <div>
          <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Complemento{optionalSpan}</label>
          <input
            type="text"
            maxLength={100}
            value={value.complement}
            onChange={e => onChange({ ...value, complement: e.target.value })}
            placeholder="Apto 4B"
            className={baseInput}
          />
        </div>
      </div>

      {/* Bairro */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Bairro</label>
        <input
          type="text"
          maxLength={100}
          value={value.neighborhood}
          onChange={e => onChange({ ...value, neighborhood: e.target.value })}
          placeholder="Centro"
          className={fieldInput(!!value.neighborhood)}
        />
      </div>

      {/* Cidade + Estado */}
      <div className="grid grid-cols-3 gap-8" style={{ marginBottom: '1.25rem' }}>
        <div className="col-span-2">
          <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Cidade</label>
          <input
            type="text"
            maxLength={100}
            value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })}
            placeholder="Jacobina"
            className={cityError ? errorInput : fieldInput(!!value.city)}
          />
          {cityError && (
            <p className="flex items-center gap-6 text-red-400 text-xs mt-6">
              <AlertCircle size={11} className="shrink-0" /> {cityError}
            </p>
          )}
        </div>
        <div>
          <label className={labelClass} style={{ marginBottom: '0.5rem' }}>Estado</label>
          <input
            type="text"
            maxLength={2}
            value={value.state}
            onChange={e => onChange({ ...value, state: e.target.value.toUpperCase() })}
            placeholder="BA"
            className={fieldInput(!!value.state)}
          />
        </div>
      </div>
    </div>
  );
}
