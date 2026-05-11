import { useState } from 'react';
import { Plus, Edit2, XCircle, Trash2, Check, X } from 'lucide-react';

const PLANOS = [
  {
    id: 'plan_basic',
    nome: 'Starter',
    preco: '37,00',
    moedasBoasVindas: 30,
    descontoMoedas: '25%',
    features: ['Suporte por email', 'Perfil básico', 'Cancele quando quiser'],
  },
  {
    id: 'plan_pro',
    nome: 'PRO',
    preco: '67,00',
    moedasBoasVindas: 80,
    descontoMoedas: '40%',
    features: ['Suporte prioritário', 'Perfil destacado', 'Estatísticas avançadas'],
  },
  {
    id: 'plan_business',
    nome: 'Elite',
    preco: '127,00',
    moedasBoasVindas: 200,
    descontoMoedas: '55%',
    features: ['Suporte 24/7', 'Perfil premium', 'Estatísticas completas', 'Badge exclusivo'],
  },
];

const PACOTES = [
  { id: 'pack_starter', nome: 'Básico', preco: '24,90', moedas: 60 },
  { id: 'pack_pro', nome: 'Popular', preco: '59,90', moedas: 200 },
  { id: 'pack_premium', nome: 'Máximo', preco: '119,90', moedas: 560 },
];

export default function AdminPlanos() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gerenciamento de Planos</h1>
          <p className="text-[#94A3B8] mt-1">Configure os planos disponíveis para os profissionais</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> Novo Plano
        </button>
      </div>

      {/* Modal criar plano */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-[#1C3454] border border-slate-700 rounded-xl p-6 w-full max-w-lg relative z-50">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Criar Novo Plano</h2>
              <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Nome do plano" className="w-full bg-[#0E1C32] border border-slate-700 p-3 rounded-lg text-white" />
              <input type="number" placeholder="Preço (R$)" className="w-full bg-[#0E1C32] border border-slate-700 p-3 rounded-lg text-white" />
              <input type="number" placeholder="Moedas de boas-vindas" className="w-full bg-[#0E1C32] border border-slate-700 p-3 rounded-lg text-white" />
              <input type="text" placeholder="Desconto moedas (ex: 25%)" className="w-full bg-[#0E1C32] border border-slate-700 p-3 rounded-lg text-white" />
              <textarea placeholder="Funcionalidades (uma por linha)" className="w-full bg-[#0E1C32] border border-slate-700 p-3 rounded-lg text-white h-24" />
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">Salvar Plano</button>
            </div>
          </div>
        </div>
      )}

      {/* Planos de assinatura */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Planos de Assinatura</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANOS.map(plano => (
            <div key={plano.id} className="bg-[#1C3454] border border-slate-800/80 rounded-xl p-6 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{plano.nome}</h3>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded">Ativo</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">R$ {plano.preco}</div>
                  <div className="text-[#4A6580] text-sm">/mês</div>
                </div>
              </div>

              <div className="space-y-3 mb-8 flex-1">
                <div className="flex items-center gap-3 text-yellow-500">
                  <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center font-bold text-xs shrink-0">C</div>
                  <span className="text-slate-300 font-medium">{plano.moedasBoasVindas} moedas boas-vindas</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Check size={18} className="text-blue-500 shrink-0" />
                  <span>{plano.descontoMoedas} desconto em moedas</span>
                </div>
                {plano.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-slate-300">
                    <Check size={18} className="text-blue-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 bg-[#0E1C32] hover:bg-slate-800 border border-slate-800 text-white py-2 rounded-lg transition-colors font-medium text-sm">
                  <Edit2 size={16} /> Editar
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 bg-[#0E1C32] hover:bg-slate-800 border border-slate-800 text-red-400 py-2 rounded-lg transition-colors font-medium text-sm">
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

      {/* Pacotes de moedas avulsos */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Pacotes de Moedas Avulsos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PACOTES.map(pkg => (
            <div key={pkg.id} className="bg-[#1C3454] border border-slate-800/80 rounded-xl p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white">{pkg.nome}</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">R$ {pkg.preco}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-yellow-500 mb-8 flex-1">
                <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center font-bold text-xs shrink-0">C</div>
                <span className="text-slate-300 font-medium">{pkg.moedas} moedas</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 bg-[#0E1C32] hover:bg-slate-800 border border-slate-800 text-white py-2 rounded-lg transition-colors font-medium text-sm">
                  <Edit2 size={16} /> Editar
                </button>
                <button className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
