import { useRef, useState, useEffect } from 'react';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';
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
  variant?: 'profile' | 'signup';
  cityError?: string;
  initialGeoTrigger?: boolean;
}

export function AddressForm({ value, onChange, variant = 'profile', cityError, initialGeoTrigger }: AddressFormProps) {
  const [loading, setLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [viacepFilled, setViacepFilled] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoTriggeredRef = useRef(false);

  // Keep a ref to avoid stale closure inside the async fetch
  const latestValue = useRef(value);
  latestValue.current = value;

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada neste dispositivo.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await res.json() as {
            address?: { postcode?: string; road?: string; suburb?: string; neighbourhood?: string; city?: string; town?: string; village?: string; state?: string; }
          };
          const addr = data.address ?? {};
          const cepDigits = (addr.postcode ?? '').replace(/\D/g, '').slice(0, 8);
          const city = addr.city || addr.town || addr.village || '';
          const neighborhood = addr.suburb || addr.neighbourhood || '';
          const newAddress = {
            ...latestValue.current,
            cep: cepDigits,
            street: addr.road || latestValue.current.street,
            neighborhood,
            city,
            state: addr.state ? addr.state.slice(0, 2).toUpperCase() : latestValue.current.state,
          };
          onChange(newAddress);
          setViacepFilled(true);
          if (cepDigits.length === 8) {
            const vRes = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
            const vData = await vRes.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
            if (!vData.erro) {
              onChange({
                ...newAddress,
                street: vData.logradouro || newAddress.street,
                neighborhood: vData.bairro || neighborhood,
                city: vData.localidade || city,
                state: vData.uf || newAddress.state,
              });
            }
          }
        } catch {
          setGeoError('Não foi possível obter o endereço. Preencha manualmente.');
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoError('Permissão negada. Preencha o CEP manualmente.');
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  };

  useEffect(() => {
    if (initialGeoTrigger && !geoTriggeredRef.current) {
      geoTriggeredRef.current = true;
      // Pequeno delay para garantir que o componente está montado e visível
      const t = setTimeout(() => handleUseLocation(), 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    ? 'block text-xs font-black text-slate-300 uppercase tracking-widest mb-3 pl-1'
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
      {geoLoading && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.75rem 1rem', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:12, marginBottom:'1.25rem' }}>
          <Loader2 size={15} className="animate-spin" style={{ color:'#34d399', flexShrink:0 }} />
          <p style={{ fontSize:13, color:'#34d399', margin:0 }}>Detectando sua localização...</p>
        </div>
      )}
      {geoError && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.75rem 1rem', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:12, marginBottom:'1.25rem' }}>
          <AlertCircle size={15} style={{ color:'#f87171', flexShrink:0 }} />
          <p style={{ fontSize:13, color:'#f87171', margin:0 }}>{geoError}</p>
        </div>
      )}
      {!geoLoading && !geoError && viacepFilled && initialGeoTrigger && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.75rem 1rem', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:12, marginBottom:'1.25rem' }}>
          <MapPin size={15} style={{ color:'#34d399', flexShrink:0 }} />
          <p style={{ fontSize:13, color:'#34d399', margin:0 }}>Endereço detectado automaticamente ✓</p>
        </div>
      )}
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
