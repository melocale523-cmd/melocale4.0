import { Users, Briefcase, TrendingUp, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';

export default function AdminDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: adminService.getDashboardSummary
  });

  const { data: recentUsers } = useQuery({
    queryKey: ['adminRecentUsers'],
    queryFn: () => adminService.getUsers({ role: 'professional' })
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;
  }

  const recentPros = recentUsers?.slice(0, 3) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Painel Administrativo</h1>
        <p className="text-slate-400 mt-1">Visão geral do ecossistema MeloCalé.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Users size={20} /></div>
           </div>
           <h3 className="text-slate-400 text-sm font-medium">Total de Usuários</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.totalUsers || 0}</p>
        </div>

        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Briefcase size={20} /></div>
           </div>
           <h3 className="text-slate-400 text-sm font-medium">Pedidos Ativos</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.activeLeads || 0}</p>
        </div>

        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><TrendingUp size={20} /></div>
           </div>
           <h3 className="text-slate-400 text-sm font-medium">Receita Estimada (Mês)</h3>
           <p className="text-3xl font-bold text-white mt-1">R$ {(summary?.estimatedRevenue || 0).toLocaleString()}</p>
        </div>

        <div className="bg-[#14161B] border border-red-500/20 rounded-xl p-6 relative overflow-hidden">
           <div className="absolute opacity-5 -right-4 -bottom-4 text-red-500"><AlertTriangle size={100} /></div>
           <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-500"><AlertTriangle size={20} /></div>
           </div>
           <h3 className="text-red-400 text-sm font-medium relative z-10">Denúncias Pendentes</h3>
           <p className="text-3xl font-bold text-white mt-1 relative z-10">{summary?.pendingDisputes || 0}</p>
        </div>

        {/* New KPIs */}
        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <h3 className="text-slate-400 text-sm font-medium">Usuarios Ativos (24h)</h3>
           <p className="text-3xl font-bold text-white mt-1">N/A</p>
        </div>

        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400"><CheckCircle size={20} /></div>
           </div>
           <h3 className="text-slate-400 text-sm font-medium">Verificações Pendentes</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.pendingVerifications || 0}</p>
        </div>

        <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Clock size={20} /></div>
           </div>
           <h3 className="text-slate-400 text-sm font-medium">Tempo Médio Resposta</h3>
           <p className="text-3xl font-bold text-white mt-1">{summary?.avgResponseTime || '12m'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
         {/* Ultimos Cadastros */}
         <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <h2 className="text-lg font-bold text-white mb-4">Últimos Profissionais</h2>
           <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">João Eletricista</p>
                      <p className="text-xs text-slate-500">Elétrica • Há 2 horas</p>
                    </div>
                  </div>
                  <button className="text-xs font-medium text-blue-400 hover:text-blue-300">Ver Perfil</button>
                </div>
              ))}
           </div>
         </div>

         {/* Pedidos em alta */}
         <div className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6">
           <h2 className="text-lg font-bold text-white mb-4">Categorias em Alta</h2>
           <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Pintura Comercial</span>
                  <span className="text-slate-400">450 pedidos</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Elétrica Residencial</span>
                  <span className="text-slate-400">320 pedidos</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Encanamento</span>
                  <span className="text-slate-400">210 pedidos</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
           </div>
         </div>
      </div>
    </div>
  );
}
