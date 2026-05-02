import { useAuthStore } from '../../store/authStore';
import { useState, useEffect } from 'react';
import { User, MapPin, Phone, Mail, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ClientePerfil() {
    const { user, updateProfile } = useAuthStore();
    const [formData, setFormData] = useState({
          name: user?.name || '',
          phone: user?.phone || '',
          address: user?.address || '',
          cep: user?.cep || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
        if (user) {
                setFormData({
                          name: user.name || '',
                          phone: user.phone || '',
                          address: user.address || '',
                          cep: user.cep || '',
                });
        }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) throw new Error('Nao autenticado');
                const { error } = await supabase
                  .from('clients')
                  .upsert({
                              id: authUser.id,
                              full_name: formData.name,
                              phone: formData.phone,
                              city: formData.address,
                              email: authUser.email,
                  }, { onConflict: 'id' });
                if (error) throw error;

                // Sync phone to profiles so AuthInitializer reads it on next load
                await supabase
                  .from('profiles')
                  .update({ phone: formData.phone, full_name: formData.name })
                  .eq('id', authUser.id);

                updateProfile(formData);
                setSuccessMsg('Perfil salvo com sucesso!');
                setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
                setErrorMsg('Erro ao salvar: ' + err.message);
        } finally {
                setIsSaving(false);
        }
  };

  const handleCepFocus = () => {
        if (!formData.cep) {
                setFormData(prev => ({ ...prev, cep: '01001-000', address: 'Praca da Se, Sao Paulo - SP' }));
        }
  }

  return (
        <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center gap-3 mb-6">
                      <Settings size={24} />
                      <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
              </div>
              <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
                      <div>
                                <label className="text-slate-400 text-sm flex items-center gap-2 mb-1"><User size={14} /> Nome completo</label>
                                <input
                                              type="text"
                                              value={formData.name}
                                              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white"
                                              placeholder="Seu nome"
                                            />
                      </div>
                      <div>
                                <label className="text-slate-400 text-sm flex items-center gap-2 mb-1"><Phone size={14} /> Telefone</label>
                                <input
                                              type="tel"
                                              value={formData.phone}
                                              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white"
                                              placeholder="(11) 99999-9999"
                                            />
                      </div>
                      <div>
                                <label className="text-slate-400 text-sm flex items-center gap-2 mb-1"><Mail size={14} /> Email</label>
                                <input
                                              type="email"
                                              value={user?.email || ''}
                                              disabled
                                              className="w-full bg-slate-700/30 border border-slate-600/30 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed"
                                            />
                      </div>
                      <div>
                                <label className="text-slate-400 text-sm flex items-center gap-2 mb-1"><MapPin size={14} /> Cidade / Endereco</label>
                                <input
                                              type="text"
                                              value={formData.address}
                                              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white"
                                              placeholder="Sua cidade"
                                            />
                      </div>
                {successMsg && <p className="text-emerald-400 text-sm">{successMsg}</p>}
                {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                      <button
                                  type="submit"
                                  disabled={isSaving}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                        {isSaving ? 'Salvando...' : 'Salvar Alteracoes'}
                      </button>
              </form>
        </div>
      );
}
