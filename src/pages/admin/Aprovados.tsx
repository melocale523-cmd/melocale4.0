import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';

export default function AdminAprovados() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['adminUsers', 'approved'],
    queryFn: () => adminService.getUsers({ status: 'approved' })
  });

  const filteredUsers = usuarios?.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Usuários Aprovados</h1>
        <p className="text-slate-400 mt-1">Lista de todos os usuários com cadastro ativo na plataforma.</p>
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
                 <th className="p-4 pr-6">Data de Aprovação</th>
               </tr>
             </thead>
             <tbody>
               {filteredUsers.map(u => (
                 <tr key={u.id} className="border-b border-white/5 hover:bg-slate-800/20 transition-colors group">
                   <td className="p-4 pl-6 text-white font-medium">{u.name || 'Sem nome'}</td>
                   <td className="p-4 text-slate-400">{u.email || 'N/A'}</td>
                   <td className="p-4 text-slate-400 capitalize">{u.role}</td>
                   <td className="p-4 pr-6 text-slate-400">{new Date(u.updated_at || u.created_at).toLocaleDateString('pt-BR')}</td>
                 </tr>
               ))}
               {filteredUsers.length === 0 && (
                 <tr>
                   <td colSpan={4} className="p-8 text-center text-slate-500">Nenhum usuário aprovado.</td>
                 </tr>
               )}
             </tbody>
           </table>
         )}
      </div>
    </div>
  );
}
