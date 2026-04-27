import { useState } from 'react';
import { Search, Filter, MoreVertical, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { toast } from 'sonner';

export default function AdminUsuarios() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminService.getUsers()
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
        <h1 className="text-2xl font-bold text-slate-100">Gestão de Usuários</h1>
        <p className="text-slate-400 mt-1">Visão geral de todos os usuários cadastrados na plataforma</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
           <input 
             type="text" 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             placeholder="Buscar por nome ou email..." 
             className="w-full bg-[#14161B] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors" 
           />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-[#14161B] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all">
           <Filter size={20} /> Filtrar
        </button>
      </div>

      <div className="bg-[#14161B] border border-slate-800 rounded-2xl overflow-hidden">
         {isLoading ? (
           <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
         ) : (
           <table className="w-full text-left">
             <thead>
               <tr className="border-b border-white/5 text-sm text-slate-400 font-medium">
                 <th className="p-4 pl-6">Nome</th>
                 <th className="p-4">Email</th>
                 <th className="p-4">Tipo</th>
                 <th className="p-4">Data de Cadastro</th>
                 <th className="p-4">Status</th>
                 <th className="p-4 pr-6 text-right">Ações</th>
               </tr>
             </thead>
             <tbody>
               {filteredUsers.map(u => (
                 <tr key={u.id} className="border-b border-white/5 hover:bg-slate-800/20 transition-colors group">
                   <td className="p-4 pl-6 text-white font-medium">{u.name || 'Sem nome'}</td>
                   <td className="p-4 text-slate-400">{u.email || 'N/A'}</td>
                   <td className="p-4 text-slate-400 capitalize">{u.role}</td>
                   <td className="p-4 text-slate-400">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                   <td className="p-4">
                     <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                       u.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                       u.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                       'bg-red-500/10 text-red-500 border border-red-500/20'
                     }`}>
                       {u.status === 'approved' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                     </span>
                   </td>
                   <td className="p-4 pr-6 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end gap-2 text-slate-400">
                        {u.status !== 'approved' && (
                          <button onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'approved' })} className="hover:text-emerald-500 p-1" title="Aprovar">
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {u.status !== 'rejected' && (
                          <button onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'rejected' })} className="hover:text-red-500 p-1" title="Rejeitar">
                            <XCircle size={18} />
                          </button>
                        )}
                        <button className="hover:text-white p-1 ml-2"><MoreVertical size={18}/></button>
                      </div>
                   </td>
                 </tr>
               ))}
               {filteredUsers.length === 0 && (
                 <tr>
                   <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum usuário encontrado.</td>
                 </tr>
               )}
             </tbody>
           </table>
         )}
      </div>
    </div>
  );
}
