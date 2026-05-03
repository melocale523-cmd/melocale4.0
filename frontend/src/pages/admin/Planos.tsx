import { useState } from 'react';
import { Plus, Edit2, XCircle, Trash2, Check, X } from 'lucide-react';

export default function AdminPlanos() {
  const [showModal, setShowModal] = useState(false);
  const planos = [
    {
      id: 1,
      nome: 'Básico',
      preco: '49.90',
      moedas: 10,
      leads: 10,
      ativo: true,
      features: ['Suporte por email', 'Perfil básico']
    },
    {
      id: 2,
      nome: 'Profissional',
      preco: '99.90',
      moedas: 25,
      leads: 25,
      ativo: true,
      features: ['Suporte prioritário', 'Perfil destacado', 'Estatísticas avançadas']
    },
    {
      id: 3,
      nome: 'Premium',
      preco: '199.90',
      moedas: 60,
      leads: 60,
      ativo: true,
      features: ['Suporte 24/7', 'Perfil premium', 'Estatísticas completas', 'Badge exclusivo']
    }
  ];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gerenciamento de Planos</h1>
          <p className="text-slate-400 mt-1">Configure os planos disponíveis para os profissionais</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> Novo Plano
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
           <div className="bg-[#14161B] border border-slate-700 rounded-xl p-6 w-full max-w-lg relative z-50">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Criar Novo Plano</h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                 <input type="text" placeholder="Nome do plano" className="w-full bg-[#0A0B0D] border border-slate-700 p-3 rounded-lg text-white" />
                 <input type="number" placeholder="Preço (R$)" className="w-full bg-[#0A0B0D] border border-slate-700 p-3 rounded-lg text-white" />
                 <input type="number" placeholder="Quantidade de Moedas" className="w-full bg-[#0A0B0D] border border-slate-700 p-3 rounded-lg text-white" />
                 <input type="number" placeholder="Quantidade de Leads" className="w-full bg-[#0A0B0D] border border-slate-700 p-3 rounded-lg text-white" />
                 <textarea placeholder="Funcionalidades (uma por linha)" className="w-full bg-[#0A0B0D] border border-slate-700 p-3 rounded-lg text-white h-24" />
                 <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">Salvar Plano</button>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {planos.map(plano => (
           <div key={plano.id} className="bg-[#14161B] border border-slate-800/80 rounded-xl p-6 flex flex-col">
             <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{plano.nome}</h3>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded">Ativo</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">R$ {plano.preco}</div>
                  <div className="text-slate-500 text-sm">/mês</div>
                </div>
             </div>

             <div className="space-y-3 mb-8 flex-1">
                <div className="flex items-center gap-3 text-yellow-500">
                  <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center font-bold text-xs shrink-0">C</div>
                  <span className="text-slate-300 font-medium">{plano.moedas} moedas/mês</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Check size={18} className="text-blue-500 shrink-0" />
                  <span>{plano.leads} leads por mês</span>
                </div>
                {plano.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-slate-300">
                    <Check size={18} className="text-blue-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
             </div>

             <div className="flex items-center gap-2">
               <button className="flex-1 flex items-center justify-center gap-2 bg-[#0A0B0D] hover:bg-slate-800 border border-slate-800 text-white py-2 rounded-lg transition-colors font-medium text-sm">
                 <Edit2 size={16} /> Editar
               </button>
               <button className="flex-1 flex items-center justify-center gap-2 bg-[#0A0B0D] hover:bg-slate-800 border border-slate-800 text-red-400 py-2 rounded-lg transition-colors font-medium text-sm">
                 <XCircle size={16} /> Desativar
               </button>
               <button className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20">
                 <Trash2 size={20} />
               </button>
             </div>
           </div>
         ))}
      </div>
    </div>
  );
}
