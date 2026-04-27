import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { User, Mail, Phone, MapPin, Briefcase, Camera, Loader2, CheckCircle2, CreditCard } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export default function ProfessionalPerfil() {
  const { user, updateProfile } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    category: 'Pintura', // Default mock
    radius: '15',
    bio: 'Profissional com mais de 5 anos de experiência.',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(false);
    
    // Simulate save duration
    setTimeout(() => {
      updateProfile({ name: formData.name, phone: formData.phone });
      setIsSaving(false);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Perfil Profissional</h1>
        <p className="text-slate-400 mt-1">Configure como os clientes verão seus serviços.</p>
      </div>

      <div className="bg-[#14161B] border border-slate-800/50 rounded-xl overflow-hidden">
        {/* Cover Photo Mock */}
        <div className="h-32 bg-gradient-to-r from-slate-800 to-emerald-900/30 relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 bg-slate-700 rounded-full border-4 border-[#14161B] flex items-center justify-center text-slate-300 relative group cursor-pointer overflow-hidden">
               <User size={32} />
               <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                 <Camera size={20} className="text-white" />
               </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-14 space-y-6">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center text-sm">
              <CheckCircle2 size={16} className="mr-2" /> Alterações salvas com sucesso!
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
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center"
            >
              {isSaving ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Salvando...</>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Stripe Connect Section */}
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
                  body: JSON.stringify({ email: user?.email })
                });
                const { accountId } = await res.json();
                
                const linkRes = await apiFetch('/api/create-account-link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accountId })
                });
                const { url } = await linkRes.json();
                window.location.href = url;
              } catch (e) {
                console.error("Stripe Connect Error:", e);
                alert("Erro ao iniciar conexão com Stripe.");
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
          >
            Conectar com Stripe
          </button>
        </div>
      </div>
    </div>
  );
}
