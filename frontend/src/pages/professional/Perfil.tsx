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
import { useIsMobile } from '../../hooks/useIsMobile';

export default function ProfessionalPerfil() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
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

  // ─── Address section ─────────────────────────────────────────────────────────
  const [addrValue, setAddrValue] = useState<AddressValue>(emptyAddress);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalCategory = formData.category === 'Outro'
        ? formData.customCategory
        : formData.category;
      await profileService.saveProfile(user!.id, {
        name: formData.name,
        phone: formData.phone,
        bio: formData.bio,
        category: finalCategory,
        serviceRadius: formData.radius,
      });
      await professionalAddressService.saveAddress(user!.id, {
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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    },
    onError: (err: Error) => toast.error(err.message),
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
    if (!addrValue.city.trim())
      return 'Preencha a cidade no endereço para receber pedidos da sua região.';
    if (!addrValue.state.trim())
      return 'Preencha o estado no endereço.';
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
    <div className="w-full" style={{ fontFamily:"'DM Sans',sans-serif", display:'flex', flexDirection:'column', gap:'1.5rem' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.25rem' }}>Perfil Profissional</p>
          <h1 style={{ fontSize:'1.25rem', fontWeight:900, color:'white', marginBottom:'0.25rem' }}>Meu Perfil</h1>
          <p style={{ fontSize:'0.75rem', color:'#4A6580' }}>Configure como os clientes verão seus serviços.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <div style={{ background:'rgba(16,185,129,.1)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)', padding:'4px 12px', borderRadius:'1.25rem', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
            <CheckCircle size={13} /> Perfil ativo
          </div>
        </div>
      </div>

      {/* Grid: Avatar + Dados */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', gap:'1rem' }}>

        {/* Card Avatar */}
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', textAlign:'center' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={avatarBusy} />
          <div style={{ position:'relative', marginTop:'0.5rem' }}>
            <div style={{ width:'5.25rem', height:'5.25rem', borderRadius:'50%', background:'linear-gradient(145deg,#0a1928,#132236)', border:'2px solid rgba(16,185,129,.3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
              ) : (
                <User size={34} style={{ color:'#4A6580' }} />
              )}
              {avatarBusy && (
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Loader2 size={14} className="animate-spin" style={{ color:'white' }} />
                </div>
              )}
            </div>
            <div style={{ position:'absolute', bottom:2, right:2, width:'1.25rem', height:'1.25rem', borderRadius:'50%', background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #132236', cursor:'pointer' }} onClick={() => fileInputRef.current?.click()}>
              <Camera size={11} style={{ color:'white' }} />
            </div>
          </div>
          <div>
            <p style={{ fontSize:'0.9375rem', fontWeight:700, color:'white' }}>{profile?.full_name || 'Profissional'}</p>
            <p style={{ fontSize:'0.75rem', color:'#4A6580' }}>{formData.category || 'Sem categoria'}</p>
          </div>
          <div style={{ display:'flex', gap:'0.375rem', width:'100%' }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarBusy} style={{ flex:1, height:'2rem', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#94a3b8', fontSize:'0.75rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <Camera size={13} />{profile?.avatar_url ? 'Alterar' : 'Adicionar'}
            </button>
            {profile?.avatar_url && !avatarBusy && (
              <button type="button" onClick={() => removeMutation.mutate()} style={{ height:'2rem', padding:'0 0.625rem', background:'rgba(248,113,113,.08)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'0.5rem', color:'#f87171', fontSize:'0.75rem', cursor:'pointer', display:'flex', alignItems:'center' }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {/* Completude */}
          <div style={{ width:'100%', borderTop:'1px solid #1C3050', paddingTop:'0.75rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.375rem' }}>
              <span style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580' }}>Completude</span>
              <span style={{ fontSize:'0.6875rem', fontWeight:700, color:'#34d399' }}>
                {[profile?.full_name, profile?.phone, profile?.category, profile?.bio, profile?.address_city].filter(Boolean).length * 20}%
              </span>
            </div>
            <div style={{ height:'0.3125rem', background:'#0d1929', borderRadius:'0.3125rem', overflow:'hidden', marginBottom:'0.375rem' }}>
              <div style={{ width:`${[profile?.full_name, profile?.phone, profile?.category, profile?.bio, profile?.address_city].filter(Boolean).length * 20}%`, height:'100%', background:'linear-gradient(90deg,#10b981,#059669)', borderRadius:'0.3125rem' }} />
            </div>
            <p style={{ fontSize:'0.625rem', color:'#4A6580' }}>
              {!profile?.bio ? 'Adicione bio para melhorar' : !profile?.address_city ? 'Adicione endereço' : 'Perfil completo!'}
            </p>
          </div>

          {/* Badges */}
          <div style={{ width:'100%', borderTop:'1px solid #1C3050', paddingTop:'0.75rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Badge</span>
              <span style={{ background:'rgba(96,165,250,.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,.2)', padding:'2px 8px', borderRadius:'1.25rem', fontSize:'0.625rem', fontWeight:700 }}>✅ Verificado</span>
            </div>
          </div>
        </div>

        {/* Dados + Bio */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>

          {/* Dados Pessoais */}
          <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#60a5fa,#378ADD)' }} />
            <div style={{ position:'absolute', top:'-1.25rem', right:'-1.25rem', width:'5rem', height:'5rem', background:'radial-gradient(circle,rgba(96,165,250,.06),transparent 70%)', pointerEvents:'none' }} />
            <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'0.875rem' }}>
              <User size={15} style={{ color:'#60a5fa' }} />Dados Pessoais
            </p>

            {successMsg && (
              <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', color:'#34d399', padding:'8px 12px', borderRadius:'0.625rem', display:'flex', alignItems:'center', gap:8, fontSize:'0.75rem', marginBottom:'0.75rem' }}>
                <CheckCircle2 size={13} /> Alterações salvas com sucesso!
              </div>
            )}
            {validationError && (
              <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.2)', color:'#fbbf24', padding:'8px 12px', borderRadius:'0.625rem', display:'flex', alignItems:'center', gap:8, fontSize:'0.75rem', marginBottom:'0.75rem' }}>
                <AlertCircle size={13} /> {validationError}
              </div>
            )}
            {saveMutation.isError && (
              <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', color:'#f87171', padding:'8px 12px', borderRadius:'0.625rem', display:'flex', alignItems:'center', gap:8, fontSize:'0.75rem', marginBottom:'0.75rem' }}>
                <AlertCircle size={13} /> {(saveMutation.error as Error).message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.625rem', marginBottom:'0.625rem' }}>
                <div>
                  <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.375rem' }}>Nome completo</p>
                  <div style={{ position:'relative' }}>
                    <User size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#4A6580' }} />
                    <input name="name" maxLength={100} value={formData.name} onChange={handleChange} required placeholder="Seu nome" style={{ width:'100%', height:'2.25rem', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#e2e8f0', fontSize:'0.8125rem', paddingLeft:'2rem', paddingRight:'0.75rem', outline:'none' }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.375rem' }}>E-mail</p>
                  <div style={{ position:'relative' }}>
                    <Mail size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#4A6580' }} />
                    <input name="email" value={formData.email} disabled style={{ width:'100%', height:'2.25rem', background:'rgba(13,25,41,.5)', border:'1px solid rgba(28,48,80,.5)', borderRadius:'0.5rem', color:'#4A6580', fontSize:'0.8125rem', paddingLeft:'2rem', paddingRight:'0.75rem', outline:'none', cursor:'not-allowed' }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.375rem' }}>Telefone / WhatsApp</p>
                  <div style={{ position:'relative' }}>
                    <Phone size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#4A6580' }} />
                    <input name="phone" maxLength={20} value={formData.phone} onChange={handleChange} required placeholder="(11) 90000-0000" style={{ width:'100%', height:'2.25rem', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#e2e8f0', fontSize:'0.8125rem', paddingLeft:'2rem', paddingRight:'0.75rem', outline:'none' }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.375rem' }}>Categoria principal</p>
                  <div style={{ position:'relative' }}>
                    <Briefcase size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#4A6580', zIndex:1 }} />
                    <select name="category" value={formData.category} onChange={handleChange} style={{ width:'100%', height:'2.25rem', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#e2e8f0', fontSize:'0.8125rem', paddingLeft:'2rem', paddingRight:'0.75rem', outline:'none', appearance:'none' }}>
                      <option value="" disabled>Selecione sua categoria</option>
                      {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  {formData.category === 'Outro' && (
                    <input type="text" placeholder="Descreva sua profissão..." maxLength={100} value={formData.customCategory} onChange={e => setFormData(prev => ({ ...prev, customCategory: e.target.value }))} style={{ width:'100%', height:'2.25rem', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#e2e8f0', fontSize:'0.8125rem', padding:'0 0.75rem', outline:'none', marginTop:'0.375rem' }} />
                  )}
                </div>
              </div>

              <div style={{ marginBottom:'0.75rem' }}>
                <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.375rem' }}>Raio de atendimento (km)</p>
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                  <input type="range" name="radius" min="5" max="50" step="5" value={formData.radius} onChange={handleChange} style={{ flex:1 }} />
                  <div style={{ background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)', padding:'3px 12px', borderRadius:'1.25rem', fontSize:'0.8125rem', fontWeight:700, whiteSpace:'nowrap' }}>{formData.radius} km</div>
                </div>
              </div>

              <div style={{ borderTop:'1px solid #1C3050', paddingTop:'0.875rem', marginBottom:'0.875rem' }}>
                <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'0.875rem' }}>
                  <MapPin size={15} style={{ color:'#fbbf24' }} />Endereço · Localização para agendamentos
                </p>
                <AddressForm value={addrValue} onChange={setAddrValue} />
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button type="submit" disabled={saveMutation.isPending} style={{ height:'2.375rem', padding:'0 1.25rem', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:'0.625rem', color:'white', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 12px rgba(16,185,129,.2)', opacity: saveMutation.isPending ? .6 : 1 }}>
                  {saveMutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>

          {/* Bio */}
          <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#a78bfa,#7c3aed)' }} />
            <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'0.75rem' }}>
              <Briefcase size={15} style={{ color:'#a78bfa' }} />Resumo Profissional
            </p>
            <textarea name="bio" maxLength={500} value={formData.bio} onChange={handleChange} rows={3} placeholder="Descreva suas habilidades, tempo de experiência e diferenciais..." style={{ width:'100%', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#e2e8f0', fontSize:'0.8125rem', padding:'0.625rem 0.75rem', outline:'none', resize:'none', lineHeight:1.6 }} />
          </div>
        </div>
      </div>

      {/* Pagamentos */}
      <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#34d399,#10b981)' }} />
        <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'0.875rem' }}>
          <CreditCard size={15} style={{ color:'#34d399' }} />Recebimentos e Pagamentos
        </p>
        <div style={{ background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.625rem', padding:'0.75rem 0.875rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', marginBottom:'0.625rem' }}>
          {connectLoading ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'#4A6580', fontSize:'0.75rem' }}>
              <Loader2 size={13} className="animate-spin" /> Verificando status...
            </div>
          ) : connectStatusValue === 'active' ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <CheckCircle size={15} style={{ color:'#34d399', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:'0.8125rem', fontWeight:600, color:'#e2e8f0' }}>Status: <span style={{ color:'#34d399' }}>Ativo</span></p>
                <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Conta Stripe conectada e pronta para receber pagamentos.</p>
              </div>
            </div>
          ) : connectStatusValue === 'pending' ? (
            <>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#f59e0b', boxShadow:'0 0 6px #f59e0b' }} />
                  <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'#f59e0b' }}>Pendente</p>
                </div>
                <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Complete o cadastro no Stripe para começar a receber.</p>
              </div>
              <button onClick={handleConnectStripe} disabled={connectBusy} style={{ height:'2.125rem', padding:'0 0.875rem', background:'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', borderRadius:'0.5rem', color:'black', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0, opacity: connectBusy ? .6 : 1 }}>
                {connectBusy && <Loader2 size={12} className="animate-spin" />} Continuar cadastro
              </button>
            </>
          ) : (
            <>
              <div>
                <p style={{ fontSize:'0.8125rem', fontWeight:600, color:'#e2e8f0' }}>Status: <span style={{ color:'#4A6580' }}>Não conectado</span></p>
                <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Para receber pagamentos, conclua o cadastro no Stripe.</p>
              </div>
              <button onClick={handleConnectStripe} disabled={connectBusy} style={{ height:'2.125rem', padding:'0 0.875rem', background:'linear-gradient(135deg,#60a5fa,#378ADD)', border:'none', borderRadius:'0.5rem', color:'white', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0, opacity: connectBusy ? .6 : 1 }}>
                {connectBusy && <Loader2 size={12} className="animate-spin" />} Conectar com Stripe
              </button>
            </>
          )}
        </div>
        <p style={{ fontSize:'0.6875rem', color:'#4A6580', lineHeight:1.5 }}>Complete o cadastro no Stripe para começar a receber pagamentos diretamente na sua conta bancária.</p>
      </div>{/* fim Pagamentos */}

      {/* Avaliações */}
      {reviewsData && (
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
            <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8 }}>
              <Star size={15} style={{ color:'#fbbf24' }} />Avaliações dos Clientes
            </p>
            {reviewsData.total > 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={13} style={{ color: s <= Math.round(reviewsData.average) ? '#fbbf24' : '#1C3050', fill: s <= Math.round(reviewsData.average) ? '#fbbf24' : '#1C3050' }} />
                  ))}
                </div>
                <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#fbbf24' }}>{reviewsData.average.toFixed(1)}</span>
              </div>
            )}
          </div>
          {reviewsData.reviews.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem', gap:'0.5rem', textAlign:'center' }}>
              <div style={{ width:'2.75rem', height:'2.75rem', borderRadius:'50%', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Star size={20} style={{ color:'#fbbf24' }} />
              </div>
              <p style={{ fontSize:'0.8125rem', fontWeight:500, color:'white' }}>Nenhuma avaliação ainda</p>
              <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>As avaliações dos clientes aparecerão aqui.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {reviewsData.reviews.map(review => (
                <div key={review.id} style={{ background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.625rem', padding:'0.75rem 0.875rem' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.375rem' }}>
                    <span style={{ fontSize:'0.8125rem', fontWeight:600, color:'#e2e8f0' }}>{review.client_name ?? 'Cliente'}</span>
                    <span style={{ fontSize:'0.6875rem', color:'#4A6580' }}>{format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:2, marginBottom:'0.375rem' }}>
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={11} style={{ color: s <= review.rating ? '#fbbf24' : '#1C3050', fill: s <= review.rating ? '#fbbf24' : '#1C3050' }} />
                    ))}
                  </div>
                  {review.comment && <p style={{ fontSize:'0.75rem', color:'#94a3b8', lineHeight:1.5 }}>{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
