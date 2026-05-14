import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useClientProfile } from '../../hooks/useClientProfile';
import { clientProfileService, avatarService } from '../../services/dbServices';
import { validateClientProfileForm, normalizeClientProfileData, ClientFieldErrors } from '../../lib/profileHelpers';
import { logService } from '../../lib/logService';
import { supabase } from '../../lib/supabase';
import {
  User, MapPin, Phone, Mail, Settings, CheckCircle2, AlertCircle, Loader2,
  Hash, Camera, Trash2, ShieldCheck, ShieldAlert, Star, ClipboardList, CalendarCheck,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';

function formatCep(digits: string) {
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function statusLabel(status: string): string {
  if (status === 'open' || status === 'aberto') return 'Aberto';
  if (status === 'orçando') return 'Orçando';
  if (status === 'finalizado') return 'Concluído';
  if (status === 'arquivado') return 'Arquivado';
  return status;
}

function StarRow({ avg, total }: { avg: number; total: number }) {
  const rounded = Math.round(avg);
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < rounded ? 'text-amber-400 fill-amber-400' : 'text-slate-600 fill-slate-600'}
        />
      ))}
      <span className="ml-1 text-sm font-bold text-white">{avg.toFixed(1)}</span>
      <span className="text-xs text-[#4A6580]">({total} avaliação{total !== 1 ? 'ões' : ''})</span>
    </div>
  );
}

export default function ClientePerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useClientProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

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

  // ── New data queries ──────────────────────────────────────────────────────

  const { data: reviewsData } = useQuery({
    queryKey: ['client_reviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('client_id', user!.id);
      if (error) return null;
      return data as { rating: number }[] | null;
    },
    enabled: !!user?.id,
  });

  const { data: clientStats } = useQuery({
    queryKey: ['client_stats', user?.id],
    queryFn: async () => {
      const [leadsRes, apptRes] = await Promise.all([
        supabase.from('leads').select('status').eq('client_id', user!.id),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('client_id', user!.id),
      ]);
      const leads = leadsRes.data ?? [];
      return {
        total:        leads.length,
        orcando:      leads.filter(l => l.status === 'orçando').length,
        finalizado:   leads.filter(l => l.status === 'finalizado').length,
        appointments: apptRes.count ?? 0,
      };
    },
    enabled: !!user?.id,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['client_recent_leads', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, title, status, created_at')
        .eq('client_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return (data ?? []) as { id: string; title: string; status: string; created_at: string }[];
    },
    enabled: !!user?.id,
  });

  // ── Computed values ───────────────────────────────────────────────────────

  const avgRating = reviewsData?.length
    ? reviewsData.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewsData.length
    : null;

  const isVerified = !!(formData.phone || profile?.phone);

  // ── Mutations ─────────────────────────────────────────────────────────────

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

  const avatarBusy = uploadMutation.isPending || removeMutation.isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens são permitidas.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB.'); return; }
    uploadMutation.mutate(file);
  };

  const saveMutation = useMutation({
    mutationFn: () => clientProfileService.saveProfile(user!.id, normalizeClientProfileData({ ...formData, cep })),
    onSuccess: () => {
      invalidateClientProfile();
      queryClient.invalidateQueries({ queryKey: ['client_stats', user?.id] });
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

      {/* ── Profile card ─────────────────────────────────────────────────── */}
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
            <div className={cn(
              "w-20 h-20 bg-slate-700 rounded-full border-4 border-[#1C3454] overflow-hidden flex items-center justify-center text-[#94A3B8]",
              avatarBusy && "opacity-50"
            )}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} />
              )}
            </div>
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

          {/* Verified badge — top right of banner */}
          <div className="absolute top-4 right-4">
            {isVerified ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">Cliente Verificado</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => phoneInputRef.current?.focus()}
                className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1.5 hover:bg-yellow-500/20 transition-colors"
              >
                <ShieldAlert size={14} className="text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">Adicione seu telefone para verificar</span>
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
              ref={phoneInputRef}
              name="phone"
              type="tel"
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

      {/* ── Stats grid 2×2 ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: 'Total de Pedidos',
            value: clientStats?.total ?? '—',
            icon: <ClipboardList size={18} className="text-blue-400" />,
            border: 'border-blue-500/20',
            text: 'text-blue-400',
          },
          {
            label: 'Em Andamento',
            value: clientStats?.orcando ?? '—',
            icon: <ClipboardList size={18} className="text-cyan-400" />,
            border: 'border-cyan-500/20',
            text: 'text-cyan-400',
          },
          {
            label: 'Agendamentos',
            value: clientStats?.appointments ?? '—',
            icon: <CalendarCheck size={18} className="text-emerald-400" />,
            border: 'border-emerald-500/20',
            text: 'text-emerald-400',
          },
          {
            label: 'Concluídos',
            value: clientStats?.finalizado ?? '—',
            icon: <CheckCircle2 size={18} className="text-slate-400" />,
            border: 'border-slate-500/20',
            text: 'text-slate-300',
          },
        ].map(stat => (
          <div key={stat.label} className={cn('bg-[#132540] border rounded-2xl p-4 flex items-center gap-3', stat.border)}>
            <div className="shrink-0">{stat.icon}</div>
            <div>
              <p className={cn('text-2xl font-black', stat.text)}>{stat.value}</p>
              <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Rating ───────────────────────────────────────────────────────── */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Star size={18} className="text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-1">Avaliação média</p>
          {avgRating !== null ? (
            <StarRow avg={avgRating} total={reviewsData!.length} />
          ) : (
            <p className="text-sm text-[#4A6580] italic">Sem avaliações ainda</p>
          )}
        </div>
      </div>

      {/* ── Recent leads ─────────────────────────────────────────────────── */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList size={16} className="text-emerald-400" /> Últimos Pedidos
          </p>
          <Link
            to="/cliente/pedidos"
            className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>

        {!recentLeads || recentLeads.length === 0 ? (
          <p className="text-sm text-[#4A6580] italic">Nenhum pedido ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentLeads.map(lead => (
              <div key={lead.id} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <span className="truncate flex-1">{lead.title}</span>
                <span className="shrink-0 text-[#4A6580]">·</span>
                <span className="shrink-0 text-xs font-bold text-emerald-400/80">{statusLabel(lead.status)}</span>
                <span className="shrink-0 text-[#4A6580]">·</span>
                <span className="shrink-0 text-xs text-[#4A6580]">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
