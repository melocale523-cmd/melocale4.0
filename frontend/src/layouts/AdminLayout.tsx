import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';
import {
  Users, Briefcase, BarChart3, Settings, ShieldAlert,
  LogOut, ArrowLeft, Menu, Activity, AlertOctagon,
  Clock, CheckCircle, UserCircle, FileText, Package,
  DollarSign, Landmark, ShieldCheck, UsersRound, Zap, LifeBuoy, TestTube2, Tag, Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

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
  { name: 'Categorias', href: '/admin/categorias', icon: Tag },
  { name: 'Transações', href: '/admin/transacoes', icon: DollarSign },
  { name: 'Financeiro Auditoria', href: '/admin/financeiro-auditoria', icon: Landmark },
  { name: 'Auditoria Logs', href: '/admin/auditoria-logs', icon: ShieldCheck },
  { name: 'Equipe', href: '/admin/equipe', icon: UsersRound },
  { name: 'Simulador', href: '/admin/simulador', icon: Zap },
  { name: 'Suporte', href: '/admin/suporte', icon: LifeBuoy },
  { name: 'Testes E2E', href: '/admin/testes', icon: TestTube2 },
  { name: 'Relatórios', href: '/admin/relatorios', icon: Download },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  const { data: openTicketCount = 0 } = useQuery({
    queryKey: ['support_tickets_open_count'],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { count } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');
      return count ?? 0;
    },
  });

  const handleLogout = async () => {
    logout();
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen dark:bg-[#0E1C32] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-48 fixed inset-y-0 bg-white/[0.15] backdrop-blur-xl dark:bg-[#132540] dark:backdrop-blur-none border-r border-white/20 dark:border-[#1C3050] z-50">
        <div className="p-1 md:p-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-lg font-bold text-white">MeloCalé <span className="text-red-500 text-xs uppercase align-top">Admin</span></span>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0 mt-2 overflow-y-auto">
          {ADMIN_NAVIGATION.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const isSupporte = item.href === '/admin/suporte';
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#2563eb15] text-[#2563EB] border-l-2 border-[#2563EB] rounded-none"
                    : "text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-[#1C3454] border border-transparent"
                )}
              >
                <item.icon size={18} className={cn(isActive ? "text-red-400" : "text-[#4A6580]")} />
                <span className="flex-1">{item.name}</span>
                {isSupporte && openTicketCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {openTicketCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-1 border-t border-white/20 dark:border-[#1C3050]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 dark:text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sair do perfil</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-48 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-12 lg:h-14 bg-white/10 backdrop-blur-xl dark:bg-[#0E1C32]/80 dark:backdrop-blur-md border-b border-white/20 dark:border-[#1C3050] sticky top-0 z-40 px-3 sm:px-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1 text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-slate-200"
            >
              <Menu size={24} />
            </button>

            <button
              onClick={() => navigate(-1)}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell />

            <div className="h-8 w-8 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold text-sm">
              {user?.email?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-1 sm:p-2 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-48 bg-white/[0.15] backdrop-blur-xl dark:bg-[#132540] dark:backdrop-blur-none border-r border-white/20 dark:border-[#1C3050] flex flex-col">
            <div className="p-1 md:p-1.5">
              <span className="text-lg font-bold text-white">MeloCalé <span className="text-red-500 text-xs">ADMIN</span></span>
            </div>
            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
              {ADMIN_NAVIGATION.map((item) => {
                const isSupporte = item.href === '/admin/suporte';
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
                      location.pathname.startsWith(item.href) ? "bg-[#2563eb15] text-[#2563EB] border-l-2 border-[#2563EB] rounded-none" : "text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-slate-200"
                    )}
                  >
                    <item.icon size={18} />
                    <span className="flex-1">{item.name}</span>
                    {isSupporte && openTicketCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {openTicketCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button onClick={handleLogout} className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 dark:text-[#94A3B8] hover:text-red-400 mt-2">
                <LogOut size={18} /> Sair do perfil
              </button>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
