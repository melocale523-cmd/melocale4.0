import { useState } from 'react';
import { Search, Filter, MoreVertical, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { toast } from 'sonner';

export default function AdminPendentes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['adminUsers', 'pending'],
    queryFn: () => adminService.getUsers({ status: 'pending' })
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => adminService.updateUserStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (error: any) => toast.error(error.message)
  });

  const filteredUsers = usuarios?.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Profissionais Pendentes</h1>
        <p className="text-[#94A3B8] mt-1">Aprove ou rejeite cadastros de novos profissionais.</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={20} />
           <input 
             type="text" 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             placeholder="Buscar por nome ou email..." 
             className="w-full bg-[#1C3454] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors" 
           />
        </div>
      </div>

      <div className="bg-[#1C3454] border border-slate-800 rounded-2xl overflow-hidden">
         {isLoading ? (
           <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
         ) : (
           <table className="w-full text-left">
             <thead>
               <tr className="border-b border-[#1C3050] text-sm text-[#94A3B8] font-medium">
                 <th className="p-4 pl-6">Nome</th>
                 <th className="p-4">Email</th>
                 <th className="p-4">Data de Cadastro</th>
                 <th className="p-4 pr-6 text-right">Ações</th>
               </tr>
             </thead>
             <tbody>
               {filteredUsers.map(u => (
                 <tr key={u.id} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors group">
                   <td className="p-4 pl-6 text-white font-medium">{u.name || 'Sem nome'}</td>
                   <td className="p-4 text-[#94A3B8]">{u.email || 'N/A'}</td>
                   <td className="p-4 text-[#94A3B8]">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                   <td className="p-4 pr-6 text-right">
                      <div className="flex justify-end gap-2 text-[#94A3B8] opacity-50 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'approved' })} className="hover:text-emerald-500 p-1" title="Aprovar">
                          <CheckCircle size={18} />
                        </button>
                        <button onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'rejected' })} className="hover:text-red-500 p-1" title="Rejeitar">
                          <XCircle size={18} />
                        </button>
                      </div>
                   </td>
                 </tr>
               ))}
               {filteredUsers.length === 0 && (
                 <tr>
                   <td colSpan={4} className="p-8 text-center text-[#4A6580]">Nenhum profissional pendente.</td>
                 </tr>
               )}
             </tbody>
           </table>
         )}
      </div>
    </div>
  );
}
