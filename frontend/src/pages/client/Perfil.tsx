import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useClientProfile } from '../../hooks/useClientProfile';
import { clientProfileService } from '../../services/dbServices';
import { User, MapPin, Phone, Mail, Settings, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ClientePerfil() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useClientProfile();

  const [formData, setFormData] = useState({ name: '', phone: '', city: '' });
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFormData({
      name: profile.full_name,
      phone: profile.phone,
      city: profile.city,
    });
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => clientProfileService.saveProfile(user!.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientProfile', user?.id] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    },
  });

  const { isError: mutationIsError, reset: mutationReset } = saveMutation;
  useEffect(() => {
    if (!mutationIsError) return;
    const t = setTimeout(mutationReset, 5000);
    return () => clearTimeout(t);
  }, [mutationIsError, mutationReset]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

      <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center text-sm">
            <CheckCircle2 size={16} className="mr-2 shrink-0" /> Perfil salvo com sucesso!
          </div>
        )}
        {saveMutation.isError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center text-sm">
            <AlertCircle size={16} className="mr-2 shrink-0" />
            {(saveMutation.error as Error).message}
          </div>
        )}

        <div>
          <label className="text-slate-400 text-sm flex items-center gap-2 mb-1">
            <User size={14} /> Nome completo
          </label>
          <input
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
            minLength={3}
            placeholder="Seu nome"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm flex items-center gap-2 mb-1">
            <Phone size={14} /> Telefone
          </label>
          <input
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="(11) 99999-9999"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm flex items-center gap-2 mb-1">
            <Mail size={14} /> E-mail
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full bg-slate-700/30 border border-slate-600/30 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm flex items-center gap-2 mb-1">
            <MapPin size={14} /> Cidade
          </label>
          <input
            name="city"
            type="text"
            value={formData.city}
            onChange={handleChange}
            placeholder="Sua cidade"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
