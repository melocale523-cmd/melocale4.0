import { useRef, useState, useEffect } from 'react';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';
import { TARGET_CITIES, normalizeCity } from '../utils/normalizeCity';

const OTHER_CITY = '__outra__';

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
  const [viacepFilled, setViacepFilled] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoTriggeredRef = useRef(false);
  // "Outra cidade" libera texto livre (que ainda passa por normalizeCity)
  const [otherCityMode, setOtherCityMode] = useState(
    () => !!value.city && !(TARGET_CITIES as readonly string[]).includes(value.city)
  );

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
          const rawCity = addr.city || addr.town || addr.village || '';
          const rawState = addr.state ? addr.state.slice(0, 2).toUpperCase() : latestValue.current.state;
          const norm = normalizeCity(rawCity, rawState);
          const neighborhood = addr.suburb || addr.neighbourhood || '';
          const newAddress = {
            ...latestValue.current,
            street: addr.road || latestValue.current.street,
            neighborhood,
            city: norm.city,
            state: norm.state || rawState,
          };
          setOtherCityMode(!!norm.city && !(TARGET_CITIES as readonly string[]).includes(norm.city));
          onChange(newAddress);
          setViacepFilled(true);
        } catch {
          setGeoError('Não foi possível obter o endereço. Preencha manualmente.');
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoError('Permissão negada. Preencha o endereço manualmente.');
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

  const fieldInput = (autoFilled: boolean) =>
    viacepFilled && autoFilled ? filledInput : baseInput;

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
          <select
            value={otherCityMode ? OTHER_CITY : value.city}
            onChange={e => {
              const sel = e.target.value;
              if (sel === OTHER_CITY) {
                setOtherCityMode(true);
                onChange({ ...value, city: '', state: value.state });
              } else {
                setOtherCityMode(false);
                // Cidades-alvo são todas na Bahia: UF vai fixa junto
                onChange({ ...value, city: sel, state: sel ? 'BA' : value.state });
              }
            }}
            className={cityError ? errorInput : fieldInput(!!value.city)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">Selecione a cidade</option>
            {TARGET_CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={OTHER_CITY}>Outra cidade</option>
          </select>
          {otherCityMode && (
            <input
              type="text"
              maxLength={100}
              value={value.city}
              onChange={e => onChange({ ...value, city: e.target.value })}
              onBlur={e => {
                // Texto livre também passa pela normalização; se o fuzzy-match
                // reconhecer uma das 6, volta pro modo select automaticamente
                const norm = normalizeCity(e.target.value, value.state);
                if ((TARGET_CITIES as readonly string[]).includes(norm.city)) setOtherCityMode(false);
                onChange({ ...value, city: norm.city, state: norm.state || value.state });
              }}
              placeholder="Digite sua cidade"
              className={cityError ? errorInput : fieldInput(!!value.city)}
              style={{ marginTop: '0.5rem' }}
            />
          )}
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
