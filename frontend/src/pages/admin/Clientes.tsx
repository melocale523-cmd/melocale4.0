import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';

export default function AdminClientes() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['adminUsers', 'client'],
    queryFn: () => adminService.getUsers({ role: 'client' })
  });

  const filteredUsers = usuarios?.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Clientes</h1>
        <p className="text-[#94A3B8] mt-1">Lista de todos os usuários com o perfil de cliente.</p>
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
                 <th className="p-4">Status</th>
                 <th className="p-4 pr-6">Data de Cadastro</th>
               </tr>
             </thead>
             <tbody>
               {filteredUsers.map(u => (
                 <tr key={u.id} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors group">
                   <td className="p-4 pl-6 text-white font-medium">{u.name || 'Sem nome'}</td>
                   <td className="p-4 text-[#94A3B8]">{u.email || 'N/A'}</td>
                   <td className="p-4">
                     <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                       u.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                       'bg-red-500/10 text-red-500 border border-red-500/20'
                     }`}>
                       {u.status === 'active' ? 'Ativo' : 'Inativo'}
                     </span>
                   </td>
                   <td className="p-4 pr-6 text-[#94A3B8]">{new Date(u.created_at || '').toLocaleDateString('pt-BR')}</td>
                 </tr>
               ))}
               {filteredUsers.length === 0 && (
                 <tr>
                   <td colSpan={4} className="p-8 text-center text-[#4A6580]">Nenhum cliente encontrado.</td>
                 </tr>
               )}
             </tbody>
           </table>
         )}
      </div>
    </div>
  );
}
