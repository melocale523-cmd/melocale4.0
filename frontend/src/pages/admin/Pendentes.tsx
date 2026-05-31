import { useState } from 'react';
import { Search, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { toast } from 'sonner';

interface PendingUser {
  id: string;
  name?: string | null;
  email?: string | null;
  created_at?: string | null;
}

export default function AdminPendentes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PendingUser | null>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['adminUsers', 'pending'],
    queryFn: () => adminService.getUsers({ status: 'inactive' })
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminService.updateUserStatus(id, 'active'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Profissional aprovado com sucesso.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminService.rejectProfessional(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setRejectTarget(null);
      toast.success('Profissional rejeitado. A conta foi revertida para cliente.');
    },
    onError: (error: Error) => {
      setRejectTarget(null);
      toast.error(error.message);
    },
  });

  const filteredUsers = (usuarios ?? []).filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) as PendingUser[];

  return (
    <div className="space-y-11 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Profissionais Pendentes</h1>
        <p className="text-[#94A3B8] mt-6">Aprove ou rejeite cadastros de novos profissionais.</p>
      </div>

      <div className="flex gap-9">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou email..."
            maxLength={255}
            className="w-full bg-[#1C3454] border border-slate-800 rounded-xl pl-12 pr-4 py-8 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
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
                <th className="p-9 pl-6">Nome</th>
                <th className="p-9">Email</th>
                <th className="p-9">Data de Cadastro</th>
                <th className="p-9 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors group">
                  <td className="p-9 pl-6 text-white font-medium">{u.name || 'Sem nome'}</td>
                  <td className="p-9 text-[#94A3B8]">{u.email || 'N/A'}</td>
                  <td className="p-9 text-[#94A3B8]">{new Date(u.created_at || '').toLocaleDateString('pt-BR')}</td>
                  <td className="p-9 pr-6 text-right">
                    <div className="flex justify-end gap-7 text-[#94A3B8] opacity-50 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => approveMutation.mutate(u.id)}
                        disabled={approveMutation.isPending}
                        className="hover:text-emerald-500 p-6 disabled:opacity-50"
                        title="Aprovar"
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button
                        onClick={() => setRejectTarget(u)}
                        disabled={rejectMutation.isPending}
                        className="hover:text-red-500 p-6 disabled:opacity-50"
                        title="Rejeitar"
                      >
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

      {/* Modal de confirmação de rejeição */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-9">
          <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-11 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-8 mb-9">
              <div className="p-7 bg-red-500/10 rounded-xl">
                <AlertTriangle className="text-red-400" size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Confirmar Rejeição</h2>
            </div>
            <p className="text-[#94A3B8] mb-7">
              Deseja rejeitar o cadastro de{' '}
              <span className="text-white font-medium">{rejectTarget.name || rejectTarget.email}</span>?
            </p>
            <p className="text-sm text-[#4A6580] mb-11">
              O registro de profissional será removido e a conta será revertida para cliente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-8">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={rejectMutation.isPending}
                className="flex-1 px-9 py-2.5 rounded-xl border border-slate-700 text-[#94A3B8] hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => rejectMutation.mutate(rejectTarget.id)}
                disabled={rejectMutation.isPending}
                className="flex-1 px-9 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-7"
              >
                {rejectMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
