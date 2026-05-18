import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useClientProfile } from '../../hooks/useClientProfile';
import { clientProfileService, avatarService } from '../../services/dbServices';
import { validateClientProfileForm, normalizeClientProfileData, ClientFieldErrors } from '../../lib/profileHelpers';
import { logService } from '../../lib/logService';
import { compressImage } from '../../lib/compressImage';
import { User, MapPin, Phone, Mail, Settings, CheckCircle2, AlertCircle, Loader2, Hash, Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';

function formatCep(digits: string) {
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export default function ClientePerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useClientProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const [formData, setFormData] = useState({ name: '', phone: '', city: '' });
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFormData({ name: profile.full_name, phone: profile.phone, city: profile.city });
    if (profile.cep) setCep(profile.cep);
  }, [profile]);

  const invalidateClientProfile = () =>
    queryClient.invalidateQueries({ queryKey: ['clientProfile', user?.id] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => avatarService.upload(user!.id, file),
    onSuccess: () => { invalidateClientProfile(); toast.success('Foto atualizada!'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => avatarService.remove(user!.id),
    onSuccess: () => { invalidateClientProfile(); toast.success('Foto removida.'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const avatarBusy = uploadMutation.isPending || removeMutation.isPending || compressing;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens são permitidas.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB.'); return; }
    setCompressing(true);
    let toUpload = file;
    try { toUpload = await compressImage(file); } catch { /* fallback silencioso */ }
    finally { setCompressing(false); }
    uploadMutation.mutate(toUpload);
  };

  const saveMutation = useMutation({
    mutationFn: () => clientProfileService.saveProfile(user!.id, normalizeClientProfileData({ ...formData, cep })),
    onSuccess: () => {
      invalidateClientProfile();
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
    if (name === 'city') setCepError(null);
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
    } catch (err) {
      logService.warn('CEP', 'ViaCEP lookup failed', err);
      setCepError('Não foi possível consultar o CEP. Insira a cidade manualmente.');
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveMutation.isPending) return;
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
        <Settings size={24} className="text-[#94A3B8]" />
        <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl overflow-hidden">
        {/* Banner + avatar */}
        <div className="h-32 bg-gradient-to-r from-slate-800 to-emerald-900/30 relative">
          <div className="absolute -bottom-10 left-6 flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={avatarBusy}
            />

            {/* Avatar circle */}
            <div className={cn(
              "w-20 h-20 bg-slate-700 rounded-full border-4 border-[#1C3454] overflow-hidden flex items-center justify-center text-[#94A3B8]",
              avatarBusy && "opacity-50"
            )}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <User size={32} />
              )}
            </div>

            {/* Action buttons */}
            {avatarBusy ? (
              <div className="flex items-center gap-2 h-7">
                <Loader2 size={14} className="text-[#94A3B8] animate-spin" />
                <span className="text-xs text-[#4A6580]">Aguarde…</span>
              </div>
            ) : profile?.avatar_url ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-[#243F6A]"
                >
                  <Camera size={12} /> Alterar
                </button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate()}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border border-red-500/20"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <Camera size={12} /> + Adicionar Foto
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-14 space-y-5">
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
            <label className="text-[#94A3B8] text-sm flex items-center gap-2">
              <User size={14} /> Nome completo
            </label>
            <input
              name="name"
              type="text"
              maxLength={100}
              value={formData.name}
              onChange={handleChange}
              placeholder="Seu nome completo"
              className={`w-full bg-[#0E1C32] border rounded-lg px-3 py-2.5 text-white outline-none transition-colors ${
                fieldErrors.name
                  ? 'border-red-500/60 focus:border-red-500'
                  : 'border-slate-700/50 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                <AlertCircle size={11} /> {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email (disabled) */}
          <div className="space-y-1">
            <label className="text-[#94A3B8] text-sm flex items-center gap-2">
              <Mail size={14} /> E-mail
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full bg-[#0E1C32] border border-slate-700/30 rounded-lg px-3 py-2.5 text-[#4A6580] cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-[#94A3B8] text-sm flex items-center gap-2">
              <Phone size={14} /> Telefone / WhatsApp
            </label>
            <input
              name="phone"
              type="tel"
              maxLength={20}
              value={formData.phone}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
              className={`w-full bg-[#0E1C32] border rounded-lg px-3 py-2.5 text-white outline-none transition-colors ${
                fieldErrors.phone
                  ? 'border-red-500/60 focus:border-red-500'
                  : 'border-slate-700/50 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.phone && (
              <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                <AlertCircle size={11} /> {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* CEP auto-fill */}
          <div className="space-y-1">
            <label className="text-[#94A3B8] text-sm flex items-center gap-2">
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
                className="w-full bg-[#0E1C32] border border-slate-700/50 rounded-lg px-3 py-2.5 text-white focus:border-emerald-500 outline-none transition-colors pr-8"
              />
              {cepLoading && (
                <Loader2 size={14} className="animate-spin text-[#94A3B8] absolute right-3 top-3" />
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
            <label className="text-[#94A3B8] text-sm flex items-center gap-2">
              <MapPin size={14} /> Cidade
            </label>
            <input
              name="city"
              type="text"
              maxLength={100}
              value={formData.city}
              onChange={handleChange}
              placeholder="Sua cidade"
              className={`w-full bg-[#0E1C32] border rounded-lg px-3 py-2.5 text-white outline-none transition-colors ${
                fieldErrors.city
                  ? 'border-red-500/60 focus:border-red-500'
                  : 'border-slate-700/50 focus:border-emerald-500'
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
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {saveMutation.isPending
              ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
              : 'Salvar Alterações'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
