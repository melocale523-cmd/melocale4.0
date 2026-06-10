import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useClientProfile } from '../../hooks/useClientProfile';
import { clientProfileService, avatarService } from '../../services/dbServices';
import { validateClientProfileForm, normalizeClientProfileData, ClientFieldErrors } from '../../lib/profileHelpers';
import { compressImage } from '../../lib/compressImage';
import { UserCircle, MapPin, Phone, Mail, CheckCircle2, AlertCircle, Loader2, Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';
import { AddressForm, type AddressValue, emptyAddress } from '../../components/AddressForm';
import { apiFetch } from '../../lib/api';

function getAvatarInfo(name: string): { initials: string; colorClass: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const palette = ['bg-blue-800', 'bg-purple-700', 'bg-orange-700', 'bg-teal-700'];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return { initials, colorClass: palette[Math.abs(hash) % palette.length] };
}

const INPUT_BASE = 'bg-[#132236] border border-[#243F6A] rounded-xl px-3.5 py-2.5 text-sm text-white w-full focus:outline-none focus:border-emerald-500/50 transition-colors';
const INPUT_ERROR = 'bg-[#132236] border border-red-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white w-full focus:outline-none focus:border-red-500 transition-colors';
const LABEL = 'text-[11px] font-bold uppercase tracking-widest text-[#4A6580] flex items-center gap-1.5 mb-1.5';

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
      // Creditar 50 moedas por completar perfil (idempotente no backend)
      apiFetch('/api/client-coins/profile-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
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

  const displayName = formData.name || profile?.full_name || '';
  const { initials, colorClass } = getAvatarInfo(displayName || 'U');

  return (
    <div className="flex justify-center px-4 py-6"><div className="w-full max-w-2xl">
      <div className="bg-[#0E1C32] border border-[#243F6A] rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="bg-[#132236] px-5 py-4 border-b border-[#243F6A] flex items-center gap-3">
          <UserCircle size={18} className="text-emerald-400" />
          <h1 className="text-[15px] font-bold text-white">Meu Perfil</h1>
        </div>

        {/* Avatar section */}
        <div className="px-5 py-5 border-b border-[#243F6A]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={avatarBusy}
          />
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-xl font-bold text-white overflow-hidden',
              !profile?.avatar_url && colorClass,
              avatarBusy && 'opacity-50',
            )}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" loading="lazy" />
              ) : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white truncate">{displayName || '—'}</p>
              <p className="text-sm text-[#4A6580] truncate">{user?.email}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {avatarBusy ? (
                <Loader2 size={16} className="animate-spin text-[#4A6580]" />
              ) : profile?.avatar_url ? (
                <>
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
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors border border-[#243F6A]"
                >
                  <Camera size={12} /> Adicionar foto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" /> Dados atualizados com sucesso!
            </div>
          )}
          {saveMutation.isError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-sm flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {(saveMutation.error as Error).message}
            </div>
          )}

          {/* Name */}
          <div>
            <label className={LABEL}><span className="text-emerald-400/70">—</span> Nome completo</label>
            <input
              name="name"
              type="text"
              maxLength={100}
              value={formData.name}
              onChange={handleChange}
              placeholder="Seu nome completo"
              className={fieldErrors.name ? INPUT_ERROR : INPUT_BASE}
            />
            {fieldErrors.name && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className={LABEL}><Mail size={12} /> E-mail</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-[#0a1628] border border-[#1a2d45] rounded-xl px-3.5 py-2.5 text-sm text-[#4A6580] w-full cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div>
            <label className={LABEL}><Phone size={12} /> Telefone / WhatsApp</label>
            <input
              name="phone"
              type="tel"
              maxLength={20}
              value={formData.phone}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
              className={fieldErrors.phone ? INPUT_ERROR : INPUT_BASE}
            />
            {fieldErrors.phone && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* Address */}
          <div className="border-t border-[#243F6A] pt-4">
            <label className={LABEL}><MapPin size={12} /> Endereço</label>
            <AddressForm
              value={addressValue}
              onChange={handleAddressChange}
              cityError={fieldErrors.city}
            />
          </div>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {saveMutation.isPending
              ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
              : 'Salvar Alterações'
            }
          </button>
        </form>
      </div>
    </div></div>
  );
}
