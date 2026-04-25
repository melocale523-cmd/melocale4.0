import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { 
  Users, Briefcase, BarChart3, Settings, ShieldAlert,
  LogOut, ArrowLeft, Menu, Bell, Activity, AlertOctagon,
  Clock, CheckCircle, UserCircle, FileText, Package,
  DollarSign, Landmark, ShieldCheck, UsersRound, Zap, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

const ADMIN_NAVIGATION = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { name: 'Observabilidade', href: '/admin/observabilidade', icon: Activity },
  { name: 'Disputas', href: '/admin/disputas', icon: AlertOctagon },
  { name: 'Usuários', href: '/admin/usuarios', icon: Users },
  { name: 'Pendentes', href: '/admin/pendentes', icon: Clock },
  { name: 'Aprovados', href: '/admin/aprovados', icon: CheckCircle },
  { name: 'Clientes', href: '/admin/clientes', icon: UserCircle },
  { name: 'Planos', href: '/admin/planos', icon: FileText },
  { name: 'Pacotes', href: '/admin/pacotes', icon: Package },
  { name: 'Transações', href: '/admin/transacoes', icon: DollarSign },
  { name: 'Financeiro Auditoria', href: '/admin/financeiro-auditoria', icon: Landmark },
  { name: 'Auditoria Logs', href: '/admin/auditoria-logs', icon: ShieldCheck },
  { name: 'Equipe', href: '/admin/equipe', icon: UsersRound },
  { name: 'Simulador', href: '/admin/simulador', icon: Zap },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Mock notifications for admin
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Nova Disputa Criada', message: 'O cliente "Maria Silva" abriu uma nova disputa.', time: 'há 5 min', read: false },
    { id: 2, title: 'Alerta de Transação', message: 'Transação suspeita no valor de R$ 5000.', time: 'há 1 hora', read: false },
    { id: 3, title: 'Cadastro Pendente', message: 'Temos 3 novos profissionais aguardando aprovação.', time: 'há 3 horas', read: true },
  ]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-[#14161B] border-r border-slate-800/50 z-50">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-lg font-bold text-white">MeloCalé <span className="text-red-500 text-xs uppercase align-top">Admin</span></span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {ADMIN_NAVIGATION.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                )}
              >
                <item.icon size={18} className={cn(isActive ? "text-red-400" : "text-slate-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
           <button
             onClick={handleLogout}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
           >
             <LogOut size={18} />
             <span>Sair do perfil</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 lg:h-20 bg-[#0A0B0D]/80 backdrop-blur-md border-b border-slate-800/50 sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setMobileMenuOpen(true)}
               className="lg:hidden p-2 text-slate-400 hover:text-slate-200"
             >
               <Menu size={24} />
             </button>
             
             {/* Back Button present in every layout */}
             <button 
               onClick={() => navigate(-1)} 
               className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
             >
               <ArrowLeft size={16} /> Voltar
             </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-full hover:bg-slate-800/50">
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0A0B0D]"></span>
                )}
              </button>

              {/* Notifications Popover */}
              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-[#14161B] border border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <h3 className="font-bold text-white">Notificações</h3>
                    <div className="flex items-center gap-2">
                       <button onClick={markAllRead} className="text-xs text-blue-400 hover:underline">Marcar lidas</button>
                       <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white p-1 rounded-full"><X size={16}/></button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={`p-4 border-b border-white/5 hover:bg-slate-800/30 transition-colors ${n.read ? 'opacity-70' : 'bg-red-500/5'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm font-bold ${n.read ? 'text-slate-300' : 'text-red-400'}`}>{n.title}</h4>
                          <span className="text-[10px] text-slate-500">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-400">{n.message}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-8 text-center text-slate-500 text-sm">Nenhuma notificação no momento.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-8 w-8 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold text-sm">
               {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
           <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
           <aside className="fixed inset-y-0 left-0 w-64 bg-[#14161B] border-r border-slate-800/50 flex flex-col">
              <div className="p-6">
                <span className="text-lg font-bold text-white">MeloCalé <span className="text-red-500 text-xs">ADMIN</span></span>
              </div>
              <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                 {ADMIN_NAVIGATION.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                        location.pathname.startsWith(item.href) ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <item.icon size={18} /> {item.name}
                    </Link>
                 ))}
                 <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 mt-8">
                   <LogOut size={18} /> Sair do perfil
                 </button>
              </nav>
           </aside>
        </div>
      )}
    </div>
  );
}
