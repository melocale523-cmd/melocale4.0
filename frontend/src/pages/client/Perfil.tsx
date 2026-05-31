import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useClientProfile } from '../../hooks/useClientProfile';
import { clientProfileService, avatarService } from '../../services/dbServices';
import { validateClientProfileForm, normalizeClientProfileData, ClientFieldErrors } from '../../lib/profileHelpers';
import { compressImage } from '../../lib/compressImage';
import { User, MapPin, Phone, Mail, Settings, CheckCircle2, AlertCircle, Loader2, Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';
import { AddressForm, type AddressValue, emptyAddress } from '../../components/AddressForm';

export default function ClientePerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useClientProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const [formData, setFormData] = useState({ name: '', phone: '', city: '' });
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const [addressValue, setAddressValue] = useState<AddressValue>(emptyAddress);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFormData({ name: profile.full_name, phone: profile.phone, city: profile.city });
    setAddressValue({
      cep: profile.cep || profile.address_zipcode || '',
      street: profile.address_street || '',
      number: profile.address_number || '',
      block: profile.address_block || '',
      complement: profile.address_complement || '',
      neighborhood: profile.address_neighborhood || '',
      city: profile.address_city || '',
      state: profile.address_state || '',
    });
  }, [profile]);

  const handleAddressChange = (addr: AddressValue) => {
    setAddressValue(addr);
    const derived = [addr.city, addr.state].filter(Boolean).join(' - ');
    setFormData(prev => ({ ...prev, city: derived }));
    if (derived && fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: undefined }));
  };

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
    mutationFn: () => clientProfileService.saveProfile(
      user!.id,
      {
        ...normalizeClientProfileData({
          ...formData,
          cep: addressValue.cep,
          addressStreet: addressValue.street,
          addressNumber: addressValue.number,
          addressBlock: addressValue.block,
          addressComplement: addressValue.complement,
          addressNeighborhood: addressValue.neighborhood,
          addressCity: addressValue.city,
          addressState: addressValue.state,
        }),
        userEmail: user?.email,
      },
    ),
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
    <div className="max-w-3xl mx-auto space-y-11">
      <div className="flex items-center gap-8 mb-11">
        <Settings size={24} className="text-[#94A3B8]" />
        <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl overflow-hidden">
        {/* Banner + avatar */}
        <div className="h-32 bg-gradient-to-r from-slate-800 to-emerald-900/30 relative">
          <div className="absolute -bottom-10 left-6 flex flex-col gap-7">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={avatarBusy}
            />

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

            {avatarBusy ? (
              <div className="flex items-center gap-7 h-7">
                <Loader2 size={14} className="text-[#94A3B8] animate-spin" />
                <span className="text-xs text-[#4A6580]">Aguarde…</span>
              </div>
            ) : profile?.avatar_url ? (
              <div className="flex gap-7">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-medium px-8 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-[#243F6A]"
                >
                  <Camera size={12} /> Alterar
                </button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate()}
                  className="flex items-center gap-1.5 text-xs font-medium px-8 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border border-red-500/20"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium px-8 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <Camera size={12} /> + Adicionar Foto
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-11 pt-14 space-y-10">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-8 rounded-lg flex items-center gap-7 text-sm">
              <CheckCircle2 size={16} className="shrink-0" /> Dados atualizados com sucesso!
            </div>
          )}
          {saveMutation.isError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-8 rounded-lg flex items-center gap-7 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {(saveMutation.error as Error).message}
            </div>
          )}

          {/* Name */}
          <div className="space-y-6">
            <label className="text-[#94A3B8] text-sm flex items-center gap-7">
              <User size={14} /> Nome completo
            </label>
            <input
              name="name"
              type="text"
              maxLength={100}
              value={formData.name}
              onChange={handleChange}
              placeholder="Seu nome completo"
              className={`w-full border rounded-lg px-8 py-2.5 text-white outline-none transition-colors ${
                fieldErrors.name
                  ? 'bg-[#0E1C32] border-red-500/60 focus:border-red-500'
                  : 'bg-[#0E1C32] border-slate-700/50 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-red-400 text-xs flex items-center gap-6 mt-6">
                <AlertCircle size={11} /> {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email (disabled) */}
          <div className="space-y-6">
            <label className="text-[#94A3B8] text-sm flex items-center gap-7">
              <Mail size={14} /> E-mail
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full bg-[#0E1C32] border border-slate-700/30 rounded-lg px-8 py-2.5 text-[#4A6580] cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div className="space-y-6">
            <label className="text-[#94A3B8] text-sm flex items-center gap-7">
              <Phone size={14} /> Telefone / WhatsApp
            </label>
            <input
              name="phone"
              type="tel"
              maxLength={20}
              value={formData.phone}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
              className={`w-full border rounded-lg px-8 py-2.5 text-white outline-none transition-colors ${
                fieldErrors.phone
                  ? 'bg-[#0E1C32] border-red-500/60 focus:border-red-500'
                  : 'bg-[#0E1C32] border-slate-700/50 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.phone && (
              <p className="text-red-400 text-xs flex items-center gap-6 mt-6">
                <AlertCircle size={11} /> {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* Address section */}
          <div className="pt-2 border-t border-slate-700/40 space-y-9">
            <p className="text-[#94A3B8] text-sm font-medium flex items-center gap-7">
              <MapPin size={14} /> Endereço
            </p>
            <AddressForm
              value={addressValue}
              onChange={handleAddressChange}
              cityError={fieldErrors.city}
            />
          </div>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-8 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-7 mt-7"
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
