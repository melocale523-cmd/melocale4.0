import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { User, MapPin, Phone, Mail, Settings } from 'lucide-react';

export default function ClientPerfil() {
  const { user, updateProfile } = useAuthStore();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    cep: user?.cep || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      updateProfile(formData);
      setIsSaving(false);
    }, 600);
  };

  const handleCepFocus = () => {
    if (!formData.cep) {
      setFormData(prev => ({ ...prev, cep: '01001-000', address: 'Praça da Sé, São Paulo - SP' }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Meu Perfil</h1>
        <p className="text-slate-400">Gerencie suas informações pessoais e preferências.</p>
      </div>

      <div className="bg-[#14161B] border border-white/5 rounded-3xl p-8">
         <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="flex items-center gap-6 pb-6 border-b border-white/5">
              <div className="w-24 h-24 bg-[#0A0B0D] rounded-full border border-white/10 flex items-center justify-center text-3xl font-bold text-emerald-500">
                {formData.name.charAt(0).toUpperCase() || 'C'}
              </div>
              <div>
                <button type="button" className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-xl text-sm font-bold mb-2">
                  Trocar Foto
                </button>
                <p className="text-xs text-slate-500">JPG, GIF ou PNG. Máximo de 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <User size={14} /> Nome Completo
                </label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Mail size={14} /> Email
                </label>
                <input 
                  type="email" 
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-[#0A0B0D]/50 border border-white/5 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Phone size={14} /> Telefone {formData.phone === '' && <span className="text-amber-500">*Obrigatório</span>}
                </label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className={`w-full bg-[#0A0B0D] border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 transition-all ${
                    formData.phone === '' ? 'border-amber-500/50 focus:border-amber-500 focus:ring-amber-500' : 'border-white/10 focus:border-emerald-500 focus:ring-emerald-500'
                  }`}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <MapPin size={14} /> CEP
                </label>
                <input 
                  type="text" 
                  value={formData.cep}
                  onChange={e => setFormData({...formData, cep: e.target.value})}
                  onFocus={handleCepFocus}
                  className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Endereço</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Rua, Número, Bairro"
              />
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-end">
              <button 
                type="submit"
                disabled={isSaving}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-70 flex items-center gap-2"
              >
                {isSaving ? <Settings className="animate-spin" size={18} /> : null}
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
         </form>
      </div>
    </div>
  );
}
