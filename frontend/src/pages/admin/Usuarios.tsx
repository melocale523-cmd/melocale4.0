import { useState, useEffect, useRef } from 'react';
import { Search, Filter, MoreVertical, CheckCircle, XCircle, Loader2, Copy, User, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { toast } from 'sonner';

type RoleFilter = 'all' | 'client' | 'professional';
type AdminUser = Awaited<ReturnType<typeof adminService.getUsers>>[number];

export default function AdminUsuarios() {
  const queryClient = useQueryClient();
  const [inputSearch, setInputSearch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState<RoleFilter>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState<AdminUser | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['adminUsers', filterRole],
    queryFn: () => adminService.getUsers({ role: filterRole, limit: 100 }),
  });

  // close dropdown on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminService.updateUserStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applySearch = () => setFilterSearch(inputSearch);

  // client-side name filter applied after fetch
  const filtered = (usuarios ?? []).filter(u => {
    const name = (u.full_name ?? u.name ?? '').toLowerCase();
    return filterSearch ? name.includes(filterSearch.toLowerCase()) : true;
  });

  const ROLE_LABELS: Record<RoleFilter, string> = {
    all: 'Todos',
    client: 'Cliente',
    professional: 'Profissional',
  };

  return (
    <div className="space-y-11 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Gestão de Usuários</h1>
        <p className="text-[#94A3B8] mt-6">Visão geral de todos os usuários cadastrados na plataforma</p>
      </div>

      <div className="flex gap-9 flex-wrap">
        <div className="flex-1 min-w-[200px] relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input
            type="text"
            value={inputSearch}
            onChange={e => setInputSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applySearch(); }}
            placeholder="Buscar por nome..."
            maxLength={255}
            className="w-full bg-[#1C3454] border border-slate-800 rounded-xl pl-12 pr-4 py-8 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div className="flex gap-7 items-center">
          {(['all', 'client', 'professional'] as RoleFilter[]).map(role => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-9 py-8 rounded-xl text-sm font-medium border transition-all ${
                filterRole === role
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-[#1C3454] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <button
          onClick={applySearch}
          className="flex items-center gap-7 px-11 py-8 bg-[#1C3454] border border-slate-800 hover:border-emerald-500/50 hover:text-emerald-400 text-slate-300 rounded-xl transition-all"
        >
          <Filter size={20} /> Filtrar
        </button>
      </div>

      <div className="bg-[#1C3454] border border-slate-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1C3050] text-sm text-[#94A3B8] font-medium">
                <th className="p-9 pl-6">Nome</th>
                <th className="p-9">Email</th>
                <th className="p-9">Tipo</th>
                <th className="p-9">Data de Cadastro</th>
                <th className="p-9">Status</th>
                <th className="p-9 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors group">
                  <td className="p-9 pl-6 text-white font-medium">{u.full_name ?? u.name ?? 'Sem nome'}</td>
                  <td className="p-9 text-[#94A3B8]">{u.email || 'N/A'}</td>
                  <td className="p-9 text-[#94A3B8]">
                    {u.role === 'professional' ? 'Profissional' : u.role === 'admin' ? 'Admin' : 'Cliente'}
                  </td>
                  <td className="p-9 text-[#94A3B8]">{new Date(u.created_at || '').toLocaleDateString('pt-BR')}</td>
                  <td className="p-9">
                    <span className={`px-2.5 py-6 rounded text-xs font-bold ${
                      u.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {u.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-9 pr-6 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                    <div className="flex justify-end gap-7 text-[#94A3B8]">
                      {u.role === 'professional' && u.status !== 'active' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'active' })}
                          className="hover:text-emerald-500 p-6"
                          title="Ativar"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                      {u.role === 'professional' && u.status === 'active' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'inactive' })}
                          className="hover:text-red-500 p-6"
                          title="Desativar"
                        >
                          <XCircle size={18} />
                        </button>
                      )}

                      {/* ⋮ dropdown menu */}
                      <div className="relative" ref={openMenu === u.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenu(prev => prev === u.id ? null : u.id)}
                          className="hover:text-white p-6 ml-2"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {openMenu === u.id && (
                          <div className="absolute right-0 top-8 z-50 w-44 bg-[#0F2237] border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                setProfileModal(u);
                              }}
                              className="flex items-center gap-7 w-full px-9 py-8 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                            >
                              <User size={15} /> Ver perfil
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                navigator.clipboard.writeText(u.id).then(() => toast.success('ID copiado!'));
                              }}
                              className="flex items-center gap-7 w-full px-9 py-8 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                            >
                              <Copy size={15} /> Copiar ID
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#4A6580]">Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Profile modal */}
      {profileModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-9">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setProfileModal(null)} />
          <div className="relative w-full max-w-md bg-[#0E1C32] border border-[#1C3050] rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-11 py-9 border-b border-[#1C3050]">
              <h3 className="text-white font-black text-lg">Perfil do Usuário</h3>
              <button
                type="button"
                onClick={() => setProfileModal(null)}
                className="p-7 rounded-xl hover:bg-white/5 text-[#7A9EBF] hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>
            {/* Avatar + nome */}
            <div className="flex items-center gap-9 px-11 py-5 border-b border-[#1C3050]">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-2xl font-black">
                {(profileModal.full_name ?? profileModal.name ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-black text-lg">{profileModal.full_name ?? profileModal.name ?? 'Sem nome'}</p>
                <span className={`text-xs font-bold px-7 py-0.5 rounded-full ${
                  profileModal.role === 'professional'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : profileModal.role === 'admin'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {profileModal.role === 'professional' ? 'Profissional' : profileModal.role === 'admin' ? 'Admin' : 'Cliente'}
                </span>
              </div>
            </div>
            {/* Dados */}
            <div className="px-11 py-5 space-y-9">
              {[
                { label: 'E-mail', value: profileModal.email || 'N/A' },
                { label: 'Status', value: profileModal.status === 'active' ? 'Ativo' : 'Inativo' },
                { label: 'Cadastro', value: new Date(profileModal.created_at || '').toLocaleDateString('pt-BR') },
                { label: 'ID', value: profileModal.id },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[#7A9EBF] text-sm font-medium">{label}</span>
                  <span className="text-white text-sm font-bold text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="px-11 py-9 border-t border-[#1C3050] flex gap-8">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(profileModal.id);
                  toast.success('ID copiado!');
                }}
                className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-[#B0C4D8] font-bold rounded-xl transition-all flex items-center justify-center gap-7 text-sm"
              >
                <Copy size={15} /> Copiar ID
              </button>
              <button
                type="button"
                onClick={() => setProfileModal(null)}
                className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-xl transition-all text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
