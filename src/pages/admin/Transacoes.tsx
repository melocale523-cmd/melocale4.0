import { useState } from 'react';
import { RefreshCw, Search, ChevronDown, X } from 'lucide-react';

export default function AdminTransacoes() {
  const [selectedTx, setSelectedTx] = useState<any>(null);
  
  const transacoes = [
      { id: 1, data: '22/04 15:30', profissional: 'samuel santos', tipo: 'Gasto', valor: '-50', desc: 'Compra de lead: b010fb54-e343...', user: 'Samuel Silva', metodo: 'Créditos', timestamp: '2026-04-22 15:30:00 UTC' }
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* ... (KPIs remain same) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Comprado', value: '591', color: 'text-blue-400' },
          { label: 'Gasto', value: '1100', color: 'text-red-400' },
          { label: 'Bônus', value: '0', color: 'text-emerald-400' },
          { label: 'Reembolso', value: '0', color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#14161B] border border-slate-800/80 rounded-xl p-6">
             <h3 className="text-slate-400 text-sm font-medium mb-2">{stat.label}</h3>
             <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      {/* ... */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
           <input type="text" placeholder="Buscar profissional..." className="w-full bg-[#14161B] border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"/>
        </div>
      </div>

      <div className="bg-[#14161B] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#181A20]">
          <h2 className="text-lg font-bold text-white">Transações Recentes</h2>
        </div>
        
        <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-sm font-medium text-slate-400">
                <th className="p-4">Data</th>
                <th className="p-4">Profissional</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Valor</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transacoes.map(t => (
                <tr key={t.id} onClick={() => setSelectedTx(t)} className="border-b border-white/5 hover:bg-slate-800/30 transition-colors cursor-pointer">
                    <td className="p-4 text-slate-300">{t.data}</td>
                    <td className="p-4 text-white font-medium">{t.profissional}</td>
                    <td className="p-4"><span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-xs font-bold uppercase">{t.tipo}</span></td>
                    <td className="p-4 text-red-400 font-bold">{t.valor}</td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
           <div className="bg-[#14161B] border border-slate-700 rounded-xl p-6 w-full max-w-md relative z-50">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Detalhes da Transação</h2>
                <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-4 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Usuário:</span><span className="text-white">{selectedTx.user}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Método:</span><span className="text-white">{selectedTx.metodo}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Data Real:</span><span className="text-white">{selectedTx.timestamp}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">ID:</span><span className="text-white font-mono break-all">{selectedTx.id}</span></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
