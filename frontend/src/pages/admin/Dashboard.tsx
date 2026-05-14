import { Users, Briefcase, TrendingUp, AlertTriangle, Clock, CheckCircle, Loader2, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

export default function AdminDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: adminService.getDashboardSummary
  });

  const { data: recentUsers } = useQuery({
    queryKey: ['adminRecentUsers'],
    queryFn: () => adminService.getUsers({ role: 'professional' })
  });

  const { data: activeUsers } = useQuery({
    queryKey: ['adminActiveUsers'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/active-users');
      const json = await res.json();
      return (json.count as number) ?? 0;
    },
  });

  const { data: topCategories } = useQuery({
    queryKey: ['adminTopCategories'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('category')
        .not('category', 'is', null);
      if (!data) return [];
      const counts: Record<string, number> = {};
      (data as { category: string | null }[]).forEach((r) => { if (r.category) counts[r.category] = (counts[r.category] ?? 0) + 1; });
      return Object.entries(counts)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;
  }

  const recentPros = recentUsers?.slice(0, 3) || [];
  const maxCategory = topCategories?.[0]?.total || 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Painel Administrativo</h1>
        <p className="text-[#94A3B8] mt-1">Visão geral do ecossistema MeloCalé.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Users size={20} /></div>
           </div>
           <h3 className="text-[#94A3B8] text-sm font-medium">Total de Usuários</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.totalUsers || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Briefcase size={20} /></div>
           </div>
           <h3 className="text-[#94A3B8] text-sm font-medium">Pedidos Ativos</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.activeLeads || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><TrendingUp size={20} /></div>
           </div>
           <h3 className="text-[#94A3B8] text-sm font-medium">Receita Estimada (Mês)</h3>
           <p className="text-3xl font-bold text-white mt-1">R$ {(summary?.estimatedRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-[#1C3454] border border-red-500/20 rounded-xl p-6 relative overflow-hidden">
           <div className="absolute opacity-5 -right-4 -bottom-4 text-red-500"><AlertTriangle size={100} /></div>
           <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-500"><AlertTriangle size={20} /></div>
           </div>
           <h3 className="text-red-400 text-sm font-medium relative z-10">Denúncias Pendentes</h3>
           <p className="text-3xl font-bold text-white mt-1 relative z-10">{summary?.pendingDisputes || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400"><Activity size={20} /></div>
           </div>
           <h3 className="text-[#94A3B8] text-sm font-medium">Usuários Ativos (24h)</h3>
           <p className="text-3xl font-bold text-white mt-1">{activeUsers ?? '—'}</p>
        </div>

        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400"><CheckCircle size={20} /></div>
           </div>
           <h3 className="text-[#94A3B8] text-sm font-medium">Verificações Pendentes</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.pendingVerifications || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Clock size={20} /></div>
           </div>
           <h3 className="text-[#94A3B8] text-sm font-medium">Tempo Médio Resposta</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.avgResponseTime || '12m'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimos Profissionais — dados reais */}
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Últimos Profissionais</h2>
          <div className="space-y-4">
            {recentPros.length > 0 ? recentPros.map((pro: { id: string; full_name?: string | null; email?: string | null; category?: string | null; created_at?: string | null }) => (
              <div key={pro.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    {(pro.full_name || pro.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{pro.full_name || pro.email || '—'}</p>
                    <p className="text-xs text-[#4A6580]">
                      {pro.category || 'Profissional'} · {pro.created_at ? new Date(pro.created_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
                <button className="text-xs font-medium text-blue-400 hover:text-blue-300">Ver Perfil</button>
              </div>
            )) : (
              <p className="text-[#4A6580] text-sm text-center py-6">Nenhum profissional cadastrado.</p>
            )}
          </div>
        </div>

        {/* Categorias em Alta — dados reais */}
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Categorias em Alta</h2>
          <div className="space-y-4">
            {topCategories && topCategories.length > 0 ? topCategories.map((cat, idx) => {
              const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500'];
              return (
                <div key={cat.category} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{cat.category}</span>
                    <span className="text-[#94A3B8]">{cat.total} pedido{cat.total !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className={`${colors[idx] || 'bg-slate-500'} h-2 rounded-full`} style={{ width: `${Math.round((cat.total / maxCategory) * 100)}%` }} />
                  </div>
                </div>
              );
            }) : (
              <p className="text-[#4A6580] text-sm text-center py-6">Sem dados de categorias.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
