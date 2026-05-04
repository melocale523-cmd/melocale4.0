import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../hooks/useProfile';
import { useAvatarUrl } from '../../hooks/useAvatarUrl';
import { profileService, avatarService } from '../../services/dbServices';
import { User, Mail, Phone, Briefcase, Camera, Loader2, CheckCircle2, CreditCard, AlertCircle, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import AvatarCropModal from '../../components/AvatarCropModal';

export default function ProfessionalPerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const avatarDisplayUrl = useAvatarUrl(profile?.avatar_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    category: 'Pintura',
    radius: '15',
    bio: '',
  });

  useEffect(() => {
    if (!profile) return;
    setFormData(prev => ({
      ...prev,
      name: profile.full_name || '',
      phone: profile.phone || '',
      category: profile.category || 'Pintura',
      radius: profile.serviceRadius ? String(profile.serviceRadius) : '15',
      bio: profile.bio || '',
    }));
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () =>
      profileService.saveProfile(user!.id, {
        name: formData.name,
        phone: formData.phone,
        bio: formData.bio,
        category: formData.category,
        serviceRadius: formData.radius,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    },
  });

  const invalidateAvatar = () => {
    // Invalidate the full profile tree so useDashboardData recalculates steps
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['avatarSignedUrl'] });
  };

  const uploadMutation = useMutation({
    mutationFn: (blob: Blob) => avatarService.upload(user!.id, blob),
    onSuccess: () => {
      invalidateAvatar();
      setCropSrc(null);
      toast.success('Foto de perfil atualizada!');
    },
    onError: (err: Error) => {
      setCropSrc(null);
      toast.error(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => avatarService.remove(user!.id, profile!.avatar_url),
    onSuccess: () => {
      invalidateAvatar();
      toast.success('Foto removida.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

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
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 11)
      return 'Telefone inválido. Use o formato (11) 90000-0000.';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) { setValidationError(error); return; }
    setValidationError(null);
    saveMutation.mutate();
  };

  const avatarBusy = uploadMutation.isPending || removeMutation.isPending;

  if (profileLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={40} label="Carregando perfil..." />
      </div>
    );
  }

  return (
    <>
      {/* Crop Modal */}
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={blob => uploadMutation.mutate(blob)}
          onClose={() => setCropSrc(null)}
          isUploading={uploadMutation.isPending}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Perfil Profissional</h1>
          <p className="text-slate-400 mt-1">Configure como os clientes verão seus serviços.</p>
        </div>

        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl overflow-hidden">
          {/* Cover + Avatar */}
          <div className="h-32 bg-gradient-to-r from-slate-800 to-emerald-900/30 relative">
            <div className="absolute -bottom-10 left-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={avatarBusy}
              />

              {avatarDisplayUrl ? (
                <div className="group relative w-20 h-20">
                  <img
                    src={avatarDisplayUrl}
                    alt="avatar"
                    className="w-20 h-20 rounded-full border-4 border-[#14161B] object-cover transition-opacity duration-200"
                  />
                  {avatarBusy && (
                    <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}
                  {!avatarBusy && (
                    <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-[10px] font-bold text-white hover:text-emerald-300 transition-colors"
                      >
                        <Camera size={11} /> Alterar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate()}
                        className="flex items-center gap-1 text-[10px] font-bold text-white hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={11} /> Remover
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarBusy}
                  className="w-20 h-20 rounded-full border-4 border-[#14161B] bg-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-600 transition-all disabled:opacity-50"
                >
                  {avatarBusy ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <ImagePlus size={18} className="mb-0.5" />
                      <span className="text-[9px] font-bold leading-tight">Adicionar</span>
                    </>
                  )}
                </button>
              )}
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
                  <User className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#0A0B0D] border border-slate-800 text-slate-200 text-sm rounded-lg pl-10 px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full bg-[#0A0B0D]/50 border border-slate-800/50 text-slate-500 cursor-not-allowed text-sm rounded-lg pl-10 px-3 py-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#0A0B0D] border border-slate-800 text-slate-200 text-sm rounded-lg pl-10 px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="(11) 90000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Categoria Principal</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 text-slate-500" size={18} />
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full bg-[#0A0B0D] border border-slate-800 text-slate-200 text-sm rounded-lg pl-10 px-3 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none"
                  >
                    <option value="Pintura">Pintura e Acabamento</option>
                    <option value="Eletrica">Elétrica</option>
                    <option value="Encanamento">Encanamento</option>
                    <option value="Montagem">Montagem de Móveis</option>
                    <option value="Limpeza">Limpeza</option>
                    <option value="Jardinagem">Jardinagem</option>
                    <option value="Reformas">Reformas em Geral</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
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
                <span className="bg-[#0A0B0D] border border-slate-800 px-3 py-1 rounded text-sm text-emerald-400 font-medium min-w-16 text-center">
                  {formData.radius} km
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Resumo Profissional / Biografia</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                className="w-full bg-[#0A0B0D] border border-slate-800 text-slate-200 text-sm rounded-lg p-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
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

        {/* Stripe Connect */}
        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Recebimentos e Pagamentos</h2>
              <p className="text-sm text-slate-400">Conecte sua conta bancária para receber pagamentos de clientes.</p>
            </div>
          </div>

          <div className="p-4 bg-[#0A0B0D] border border-slate-800 rounded-lg flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">Status da Conta: <span className="text-amber-500">Pendente</span></p>
              <p className="text-xs text-slate-500">Para receber pagamentos, você precisa concluir o cadastro no Stripe.</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await apiFetch('/api/create-connected-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user?.email }),
                  });
                  const { accountId } = await res.json();
                  const linkRes = await apiFetch('/api/create-account-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accountId }),
                  });
                  const { url } = await linkRes.json();
                  window.location.href = url;
                } catch (e) {
                  console.error('Stripe Connect Error:', e);
                  alert('Erro ao iniciar conexão com Stripe.');
                }
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
            >
              Conectar com Stripe
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
