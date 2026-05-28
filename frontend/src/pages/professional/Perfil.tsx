import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../hooks/useProfile';
import { profileService, avatarService, reviewService, professionalAddressService } from '../../services/dbServices';
import { compressImage } from '../../lib/compressImage';
import { User, Mail, Phone, Briefcase, Camera, Loader2, CheckCircle2, CheckCircle, CreditCard, AlertCircle, Trash2, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getConnectStatus, connectProfessionalAccount, createOnboardingLink, type ConnectStatus } from '../../lib/stripeConnect';
import LoadingSpinner from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { AddressForm, type AddressValue, emptyAddress } from '../../components/AddressForm';

export default function ProfessionalPerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: ['profile'] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => avatarService.upload(user!.id, file),
    onSuccess: () => { invalidateProfile(); toast.success('Foto atualizada!'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => avatarService.remove(user!.id),
    onSuccess: () => { invalidateProfile(); toast.success('Foto removida.'); },
    onError: (err: Error) => toast.error(err.message),
  });

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

  const avatarBusy = uploadMutation.isPending || removeMutation.isPending || compressing;

  const [successMsg, setSuccessMsg] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    category: '',
    customCategory: '',
    radius: '15',
    bio: '',
  });

  useEffect(() => {
    supabase
      .from('categories')
      .select('name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data?.length) {
          const sorted = [
            ...data.filter((c: { name: string }) => c.name === 'Outro'),
            ...data.filter((c: { name: string }) => c.name !== 'Outro'),
          ];
          setCategorias(sorted.map((c: { name: string }) => c.name));
        }
      });
  }, []);

  useEffect(() => {
    if (!profile || categorias.length === 0) return;
    const categoriaExiste = categorias.includes(profile.category || '');
    setFormData(prev => ({
      ...prev,
      name: profile.full_name || '',
      phone: profile.phone || '',
      category: categoriaExiste ? (profile.category || '') : 'Outro',
      customCategory: categoriaExiste ? '' : (profile.category || ''),
      radius: profile.serviceRadius ? String(profile.serviceRadius) : '15',
      bio: profile.bio || '',
    }));
  }, [profile, categorias]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const finalCategory = formData.category === 'Outro'
        ? formData.customCategory
        : formData.category;
      return profileService.saveProfile(user!.id, {
        name: formData.name,
        phone: formData.phone,
        bio: formData.bio,
        category: finalCategory,
        serviceRadius: formData.radius,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    },
  });

  // Auto-clear mutation error after 5 seconds
  const { isError: mutationIsError, reset: mutationReset } = saveMutation;
  useEffect(() => {
    if (!mutationIsError) return;
    const t = setTimeout(mutationReset, 5000);
    return () => clearTimeout(t);
  }, [mutationIsError, mutationReset]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValidationError(null);
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string | null => {
    if (!formData.name.trim() || formData.name.trim().length < 3)
      return 'Nome deve ter pelo menos 3 caracteres.';
    if (!formData.category)
      return 'Selecione uma categoria.';
    if (formData.category === 'Outro' && !formData.customCategory.trim())
      return 'Por favor, descreva sua profissão.';
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 11)
      return 'Telefone inválido. Use o formato (11) 90000-0000.';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    saveMutation.mutate();
  };

  // ─── Address section ─────────────────────────────────────────────────────────
  const [addrValue, setAddrValue] = useState<AddressValue>(emptyAddress);
  const [addrSuccessMsg, setAddrSuccessMsg] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setAddrValue({
      cep: profile.address_zipcode || '',
      street: profile.address_street || '',
      number: profile.address_number || '',
      block: profile.address_block || '',
      complement: profile.address_complement || '',
      neighborhood: profile.address_neighborhood || '',
      city: profile.address_city || '',
      state: profile.address_state || '',
    });
  }, [profile]);

  const savAddressMutation = useMutation({
    mutationFn: () => professionalAddressService.saveAddress(user!.id, {
      cep: addrValue.cep || undefined,
      address_zipcode: addrValue.cep || undefined,
      address_street: addrValue.street.trim() || undefined,
      address_number: addrValue.number.trim() || undefined,
      address_block: addrValue.block.trim() || undefined,
      address_complement: addrValue.complement.trim() || undefined,
      address_neighborhood: addrValue.neighborhood.trim() || undefined,
      address_city: addrValue.city.trim() || undefined,
      address_state: addrValue.state.trim() || undefined,
      city: addrValue.city && addrValue.state
        ? `${addrValue.city} - ${addrValue.state}`
        : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setAddrSuccessMsg(true);
      setTimeout(() => setAddrSuccessMsg(false), 3000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', 'professional', profile?.professionalId],
    queryFn: () => reviewService.getReviewsByProfessional(profile!.professionalId),
    enabled: !!profile?.professionalId,
    staleTime: 60_000,
  });

  const { data: connectStatus, isLoading: connectLoading, refetch: refetchConnect } = useQuery({
    queryKey: ['connectStatus'],
    queryFn: getConnectStatus,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const connectStatusValue: ConnectStatus = connectStatus?.status ?? 'not_connected';

  const [connectBusy, setConnectBusy] = useState(false);

  const handleConnectStripe = async () => {
    setConnectBusy(true);
    try {
      await connectProfessionalAccount(user?.email ?? '', connectStatusValue);
      const { url } = await createOnboardingLink();
      window.location.href = url;
    } catch (e) {
      if (import.meta.env.DEV) console.error('[Stripe Connect]', e);
      toast.error(e instanceof Error ? e.message : 'Erro ao iniciar conexão com Stripe.');
      void refetchConnect();
    } finally {
      setConnectBusy(false);
    }
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
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Perfil Profissional</h1>
        <p className="text-[#94A3B8] mt-1">Configure como os clientes verão seus serviços.</p>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-slate-800 to-emerald-900/30 relative">
          <div className="absolute -bottom-10 left-6 flex items-end gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={avatarBusy} />
            <div className="w-20 h-20 bg-slate-700 rounded-full border-4 border-[#1C3454] flex items-center justify-center text-slate-300 relative overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <User size={32} />
              )}
              {avatarBusy && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <Loader2 size={18} className="text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 mb-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-wait text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
              >
                <Camera size={12} />
                {profile?.avatar_url ? 'Alterar foto' : 'Adicionar foto'}
              </button>
              {profile?.avatar_url && !avatarBusy && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate()}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                >
                  <Trash2 size={12} /> Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-14 space-y-6">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center text-sm">
              <CheckCircle2 size={16} className="mr-2 shrink-0" /> Alterações salvas com sucesso!
            </div>
          )}
          {validationError && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-lg flex items-center text-sm">
              <AlertCircle size={16} className="mr-2 shrink-0" />
              {validationError}
            </div>
          )}
          {saveMutation.isError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center text-sm">
              <AlertCircle size={16} className="mr-2 shrink-0" />
              {(saveMutation.error as Error).message}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-[#4A6580]" size={18} />
                <input
                  name="name"
                  maxLength={100}
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0E1C32] border border-slate-800 text-slate-200 text-sm rounded-lg pl-10 px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-[#4A6580]" size={18} />
                <input
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full bg-[#0E1C32]/50 border border-slate-800/50 text-[#4A6580] cursor-not-allowed text-sm rounded-lg pl-10 px-3 py-2.5 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 text-[#4A6580]" size={18} />
                <input
                  name="phone"
                  maxLength={20}
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0E1C32] border border-slate-800 text-slate-200 text-sm rounded-lg pl-10 px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="(11) 90000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Categoria Principal</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 text-[#4A6580]" size={18} />
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full bg-[#0E1C32] border border-slate-800 text-slate-200 text-sm rounded-lg pl-10 px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none"
                >
                  <option value="" disabled>Selecione sua categoria</option>
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {formData.category === 'Outro' && (
                <input
                  type="text"
                  placeholder="Descreva sua profissão..."
                  maxLength={100}
                  className="w-full bg-[#0E1C32] border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all mt-2"
                  value={formData.customCategory}
                  onChange={e => setFormData(prev => ({ ...prev, customCategory: e.target.value }))}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Raio de Atendimento (km)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                name="radius"
                min="5" max="50" step="5"
                value={formData.radius}
                onChange={handleChange}
                className="flex-1 accent-emerald-500"
              />
              <span className="bg-[#0E1C32] border border-slate-800 px-3 py-1 rounded text-sm text-emerald-400 font-medium min-w-16 text-center">
                {formData.radius} km
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Resumo Profissional / Biografia</label>
            <textarea
              name="bio"
              maxLength={500}
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className="w-full bg-[#0E1C32] border border-slate-800 text-slate-200 text-sm rounded-lg p-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
              placeholder="Descreva suas habilidades, tempo de experiência e diferenciais..."
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center"
            >
              {saveMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Salvando...</>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Address */}
      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400">
            <MapPin size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Endereço</h2>
            <p className="text-sm text-[#94A3B8]">Localização para agendamentos de visitas.</p>
          </div>
        </div>

        {addrSuccessMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center text-sm">
            <CheckCircle2 size={16} className="mr-2 shrink-0" /> Endereço salvo com sucesso!
          </div>
        )}

        <AddressForm value={addrValue} onChange={setAddrValue} />

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => savAddressMutation.mutate()}
            disabled={savAddressMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            {savAddressMutation.isPending
              ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
              : 'Salvar Endereço'
            }
          </button>
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Recebimentos e Pagamentos</h2>
            <p className="text-sm text-[#94A3B8]">Conecte sua conta bancária para receber pagamentos de clientes.</p>
          </div>
        </div>

        <div className="p-4 bg-[#0E1C32] border border-slate-800 rounded-lg flex items-center justify-between gap-4">
          {connectLoading ? (
            <div className="flex items-center gap-2 text-[#4A6580] text-sm">
              <Loader2 size={16} className="animate-spin" /> Verificando status...
            </div>
          ) : connectStatusValue === 'active' ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-200">
                  Status da Conta: <span className="text-emerald-400">Ativo</span>
                </p>
                <p className="text-xs text-[#4A6580]">Sua conta Stripe está conectada e pronta para receber pagamentos.</p>
              </div>
            </div>
          ) : connectStatusValue === 'pending' ? (
            <>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-200">
                  Status da Conta: <span className="text-amber-400">Pendente</span>
                </p>
                <p className="text-xs text-[#4A6580]">Complete o cadastro no Stripe para começar a receber pagamentos.</p>
              </div>
              <button
                onClick={handleConnectStripe}
                disabled={connectBusy}
                className="shrink-0 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-wait text-black px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
              >
                {connectBusy ? <Loader2 size={15} className="animate-spin" /> : null}
                Continuar cadastro
              </button>
            </>
          ) : (
            <>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-200">
                  Status da Conta: <span className="text-slate-400">Não conectado</span>
                </p>
                <p className="text-xs text-[#4A6580]">Para receber pagamentos, você precisa concluir o cadastro no Stripe.</p>
              </div>
              <button
                onClick={handleConnectStripe}
                disabled={connectBusy}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-wait text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
              >
                {connectBusy ? <Loader2 size={15} className="animate-spin" /> : null}
                Conectar com Stripe
              </button>
            </>
          )}
        </div>
      </div>
      {/* Reviews */}
      {reviewsData && (
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-400">
                <Star size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Avaliações dos Clientes</h2>
                <p className="text-sm text-[#94A3B8]">{reviewsData.total} avaliação{reviewsData.total !== 1 ? 'ões' : ''} recebida{reviewsData.total !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {reviewsData.total > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={16}
                      className={s <= Math.round(reviewsData.average) ? 'text-yellow-400 fill-yellow-400' : 'text-[#1C3050] fill-[#1C3050]'}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-yellow-400 mt-0.5">
                  {reviewsData.average.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {reviewsData.reviews.length === 0 ? (
            <p className="text-sm text-[#4A6580] text-center py-4">Nenhuma avaliação ainda.</p>
          ) : (
            <div className="space-y-3">
              {reviewsData.reviews.map(review => (
                <div key={review.id} className="bg-[#0E1C32] border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">{review.client_name ?? 'Cliente'}</span>
                    <span className="text-xs text-[#4A6580]">
                      {format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={13}
                        className={s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#1C3050] fill-[#1C3050]'}
                      />
                    ))}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[#94A3B8]">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
