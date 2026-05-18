import { useState } from 'react';
import { Plus, Edit2, XCircle, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { toast } from 'sonner';

export default function AdminPacotes() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: pacotes, isLoading } = useQuery({
    queryKey: ['adminPacotes'],
    queryFn: () => adminService.getCoinPackages()
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, currentActive }: { id: string; currentActive: boolean }) =>
      adminService.updateCoinPackage(id, { is_active: !currentActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPacotes'] });
      toast.success('Pacote atualizado com sucesso');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Erro ao atualizar pacote'),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gerenciamento de Pacotes de Moedas</h1>
          <p className="text-[#94A3B8] mt-1">Configure os pacotes avulsos disponíveis para os profissionais comprarem lideranças</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus size={18} /> Novo Pacote
        </button>
      </div>

      {isLoading ? (
         <div className="flex justify-center p-12 bg-[#1C3454] rounded-2xl border border-slate-800"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {pacotes?.map(pacote => (
             <div key={pacote.id} className="bg-[#1C3454] border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group">
               {pacote.is_popular && (
                 <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                   Popular
                 </div>
               )}
               <div className="flex justify-between items-start mb-6 z-10 relative">
                  <div>
                    <h3 className="text-xl font-bold text-white">{pacote.name}</h3>
                    <span className={`inline-block mt-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${pacote.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {pacote.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-400">R$ {(pacote.price ?? 0).toFixed(2).replace('.', ',')}</div>
                  </div>
               </div>

               <div className="space-y-4 mb-8 flex-1 z-10 relative">
                  <div className="bg-[#0E1C32] border border-[#1C3050] p-4 rounded-xl flex items-center justify-between">
                     <span className="text-[#94A3B8] text-sm">Moedas</span>
                     <div className="flex items-center gap-2 text-yellow-500 font-bold text-lg">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                       {pacote.coins}
                     </div>
                  </div>
                  {pacote.bonus_coins > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex justify-between items-center text-sm text-emerald-400">
                      <span>Bônus</span>
                      <span className="font-bold">+{pacote.bonus_coins}</span>
                    </div>
                  )}
                </div>

               <div className="flex items-center gap-3 mt-auto pt-6 border-t border-[#1C3050] z-10 relative">
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors text-sm font-medium">
                    <Edit2 size={16} /> Editar
                  </button>
                  <button
                    onClick={() => toggleStatusMutation.mutate({ id: pacote.id, currentActive: pacote.is_active })}
                    disabled={toggleStatusMutation.isPending}
                    className={`flex items-center justify-center gap-1 py-2.5 px-3 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${pacote.is_active ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}
                    title={pacote.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {toggleStatusMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : pacote.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
               </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
