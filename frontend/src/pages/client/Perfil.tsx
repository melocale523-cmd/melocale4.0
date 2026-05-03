import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useClientProfile } from '../../hooks/useClientProfile';
import { clientProfileService } from '../../services/dbServices';
import { validateClientProfileForm, ClientFieldErrors } from '../../lib/profileHelpers';
import { User, MapPin, Phone, Mail, Settings, CheckCircle2, AlertCircle, Loader2, Hash } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

function formatCep(digits: string) {
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export default function ClientePerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useClientProfile();

  const [formData, setFormData] = useState({ name: '', phone: '', city: '' });
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFormData({ name: profile.full_name, phone: profile.phone, city: profile.city });
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => clientProfileService.saveProfile(user!.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientProfile', user?.id] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 5000);
    },
  });

  const { isError: mutationIsError, reset: mutationReset } = saveMutation;
  useEffect(() => {
    if (!mutationIsError) return;
    const t = setTimeout(mutationReset, 5000);
    return () => clearTimeout(t);
  }, [mutationIsError, mutationReset]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof ClientFieldErrors])
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCep(digits);
    setCepError(null);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError('CEP não encontrado.');
      } else {
        const city = `${data.localidade} - ${data.uf}`;
        setFormData(prev => ({ ...prev, city }));
        setFieldErrors(prev => ({ ...prev, city: undefined }));
      }
    } catch {
      setCepError('Não foi possível consultar o CEP. Tente novamente.');
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateClientProfileForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    saveMutation.mutate();
  };

  if (profileLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={40} label="Carregando perfil..." />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-slate-400" />
        <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-5">
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="shrink-0" /> Dados atualizados com sucesso!
          </div>
        )}
        {saveMutation.isError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {(saveMutation.error as Error).message}
          </div>
        )}

        {/* Name */}
        <div className="space-y-1">
          <label className="text-slate-400 text-sm flex items-center gap-2">
            <User size={14} /> Nome completo
          </label>
          <input
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Seu nome completo"
            className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white outline-none transition-colors ${
              fieldErrors.name
                ? 'border-red-500/60 focus:border-red-500'
                : 'border-slate-600/50 focus:border-emerald-500'
            }`}
          />
          {fieldErrors.name && (
            <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-slate-400 text-sm flex items-center gap-2">
            <Phone size={14} /> Telefone / WhatsApp
          </label>
          <input
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(11) 99999-9999"
            className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white outline-none transition-colors ${
              fieldErrors.phone
                ? 'border-red-500/60 focus:border-red-500'
                : 'border-slate-600/50 focus:border-emerald-500'
            }`}
          />
          {fieldErrors.phone && (
            <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {fieldErrors.phone}
            </p>
          )}
        </div>

        {/* Email (disabled) */}
        <div className="space-y-1">
          <label className="text-slate-400 text-sm flex items-center gap-2">
            <Mail size={14} /> E-mail
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full bg-slate-700/30 border border-slate-600/30 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed"
          />
        </div>

        {/* CEP auto-fill */}
        <div className="space-y-1">
          <label className="text-slate-400 text-sm flex items-center gap-2">
            <Hash size={14} /> CEP
            <span className="text-slate-600 text-xs">(preenche a cidade automaticamente)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={formatCep(cep)}
              onChange={handleCepChange}
              placeholder="00000-000"
              maxLength={9}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none transition-colors pr-8"
            />
            {cepLoading && (
              <Loader2 size={14} className="animate-spin text-slate-400 absolute right-3 top-2.5" />
            )}
          </div>
          {cepError && (
            <p className="text-amber-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {cepError}
            </p>
          )}
        </div>

        {/* City */}
        <div className="space-y-1">
          <label className="text-slate-400 text-sm flex items-center gap-2">
            <MapPin size={14} /> Cidade
          </label>
          <input
            name="city"
            type="text"
            value={formData.city}
            onChange={handleChange}
            placeholder="Sua cidade"
            className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white outline-none transition-colors ${
              fieldErrors.city
                ? 'border-red-500/60 focus:border-red-500'
                : 'border-slate-600/50 focus:border-emerald-500'
            }`}
          />
          {fieldErrors.city && (
            <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {fieldErrors.city}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {saveMutation.isPending
            ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
            : 'Salvar Alterações'
          }
        </button>
      </form>
    </div>
  );
}
