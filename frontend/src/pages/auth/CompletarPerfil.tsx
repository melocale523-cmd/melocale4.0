import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { AddressForm, type AddressValue, emptyAddress } from '../../components/AddressForm';

export default function CompletarPerfil() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const [role, setRole] = useState<'client' | 'professional'>('client');
  const [formData, setFormData] = useState({ phone: '', category: '', customCategory: '', bio: '' });
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    const savedRole = sessionStorage.getItem('melocale_new_user_role') as 'client' | 'professional' | null;
    if (savedRole) {
      setRole(savedRole);
      sessionStorage.removeItem('melocale_new_user_role');
    } else {
      setRole(user.role === 'professional' ? 'professional' : 'client');
    }
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    supabase
      .from('profiles')
      .select('phone, address_city')
      .eq('id', user!.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.phone && data?.address_city) {
          const dashboard = user!.role === 'professional' ? '/profissional/dashboard' : '/cliente/dashboard';
          navigate(dashboard, { replace: true });
        } else {
          setProfileChecked(true);
        }
      });
  }, [isLoading, isAuthenticated, user, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.phone.trim()) {
      setError('WhatsApp é obrigatório.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const derivedCity = [address.city, address.state].filter(Boolean).join(' - ');
      const finalCategory = formData.category === 'Outro' ? formData.customCategory : formData.category;

      const payload = {
        phone: formData.phone.trim(),
        city: derivedCity || null,
        cep: address.cep || null,
        address_zipcode: address.cep || null,
        address_street: address.street || null,
        address_number: address.number || null,
        address_block: address.block || null,
        address_complement: address.complement || null,
        address_neighborhood: address.neighborhood || null,
        address_city: address.city || null,
        address_state: address.state || null,
      };

      if (import.meta.env.DEV) console.log('[CompletarPerfil] update payload for', user.id, payload);

      // Use update (not upsert) — the profile row is guaranteed to exist because
      // AuthInitializer always creates it before navigating here.
      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (updateError) {
        if (import.meta.env.DEV) console.error('[CompletarPerfil] update error:', updateError);
        throw new Error(updateError.message);
      }

      if (role === 'professional' && finalCategory) {
        if (import.meta.env.DEV) console.log('[CompletarPerfil] calling save_full_profile RPC');
        const { error: rpcError } = await supabase.rpc('save_full_profile', {
          p_user_id: user.id,
          p_full_name: '',
          p_phone: formData.phone.trim(),
          p_bio: formData.bio || '',
          p_category: finalCategory,
          p_service_radius: 50,
        });
        if (rpcError) {
          if (import.meta.env.DEV) console.error('[CompletarPerfil] save_full_profile error:', rpcError);
          throw new Error(rpcError.message);
        }
      }

      toast.success('Perfil concluído! Bem-vindo(a) ao MeloCalé 🎉');
      const dashboard = role === 'professional' ? '/profissional/dashboard' : '/cliente/dashboard';
      navigate(dashboard, { replace: true });
    } catch (err) {
      if (import.meta.env.DEV) console.error('[CompletarPerfil] handleSubmit error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !profileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E1C32]">
        <Loader2 size={40} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E1C32] flex items-start justify-center pt-16 px-4 pb-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-4xl mb-4">{role === 'professional' ? '🔧' : '🏠'}</div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Quase lá!</h1>
          <p className="text-[#7A9EBF] font-medium">Complete seu perfil para continuar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">
              WhatsApp para Contato *
            </label>
            <input
              required
              type="tel"
              placeholder="(11) 99999-9999"
              maxLength={20}
              className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
              value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">
              Endereço
            </label>
            <AddressForm value={address} onChange={setAddress} variant="signup" />
          </div>

          {role === 'professional' && (
            <div>
              <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">
                Especialidade / Categoria *
              </label>
              <select
                required
                className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium appearance-none cursor-pointer"
                value={formData.category}
                onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
              >
                <option value="" disabled>Selecione sua especialidade</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat} className="bg-[#0E1C32] text-white">{cat}</option>
                ))}
              </select>
              {formData.category === 'Outro' && (
                <input
                  type="text"
                  required
                  placeholder="Descreva sua profissão..."
                  maxLength={100}
                  className="w-full h-16 bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium mt-3"
                  value={formData.customCategory}
                  onChange={e => setFormData(p => ({ ...p, customCategory: e.target.value }))}
                />
              )}
            </div>
          )}

          {role === 'professional' && (
            <div>
              <label className="block text-[10px] font-black text-[#7A9EBF] uppercase tracking-[0.2em] mb-3 ml-1">
                Sobre você <span className="normal-case font-normal text-[#4A6580]">(opcional)</span>
              </label>
              <textarea
                placeholder="Descreva sua experiência e serviços..."
                rows={3}
                maxLength={500}
                className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all font-medium resize-none text-sm leading-relaxed"
                value={formData.bio}
                onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-16 bg-emerald-500 hover:bg-emerald-400 text-black rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/20 disabled:opacity-50 uppercase tracking-widest mt-4"
          >
            {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : 'Concluir Cadastro'}
          </button>
        </form>
      </div>
    </div>
  );
}
