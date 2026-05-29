import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, MessageSquare, UserCircle, LogOut, ArrowLeft, Menu, X, Calendar, Settings, Search, Gift } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useClientProfile } from '../hooks/useClientProfile';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import ClientPushModal from '../components/ClientPushModal';
import PushFloatingBanner from '../components/PushFloatingBanner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useClientProfile();
  const queryClient = useQueryClient();

  const { data: unreadCount } = useQuery({
    queryKey: ['client_unread_count', user?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', user.id);
      if (!data?.length) return 0;
      const convIds = data.map(c => c.id);
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('sender_type', 'professional')
        .is('read_at', null);
      return count ?? 0;
    },
  });

  useEffect(() => {
    const ch = supabase.channel('client_unread_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['client_unread_count'] });
      })
      .subscribe();
    return () => { ch.unsubscribe(); supabase.removeChannel(ch); };
  }, [queryClient]);

  useEffect(() => {
    if (user && user.role !== 'client' && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/cliente/dashboard', icon: Home },
    { name: 'Meus Pedidos', path: '/cliente/pedidos', icon: ClipboardList },
    { name: 'Buscar Profissionais', path: '/cliente/busca', icon: Search },
    { name: 'Agenda', path: '/cliente/agenda', icon: Calendar },
    { name: 'Mensagens', path: '/cliente/mensagens', icon: MessageSquare },
    { name: 'Meu Perfil', path: '/cliente/perfil', icon: UserCircle },
    { name: 'Indicações', path: '/cliente/indicacao', icon: Gift },
    { name: 'Configurações', path: '/cliente/configuracoes', icon: Settings },
  ];

  const handleLogout = async () => {
    logout();
    await supabase.auth.signOut();
    navigate('/');
  };

  const AvatarCircle = ({ size }: { size: 'sm' | 'md' }) => {
    const cls = size === 'sm'
      ? 'w-8 h-8 rounded-full shrink-0'
      : 'w-10 h-10 rounded-full shrink-0';
    const fallbackCls = size === 'sm'
      ? 'w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0'
      : 'w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0';

    if (profile?.avatar_url) {
      return <img src={profile.avatar_url} alt="avatar" className={`${cls} object-cover`} />;
    }
    return (
      <div className={fallbackCls}>
        {user?.email?.charAt(0).toUpperCase() || 'C'}
      </div>
    );
  };

  return (
    <div className="flex h-screen dark:bg-[#0E1C32] text-slate-900 dark:text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/20 dark:border-[#1C3050] bg-white/[0.15] backdrop-blur-xl dark:bg-[#132540] dark:backdrop-blur-none flex flex-col hidden md:flex">
        <div className="p-6">
          <span className="text-xl font-bold tracking-tight uppercase text-emerald-400">
            Melocale <span className="text-white text-xs ml-1">Cliente</span>
          </span>
        </div>

        <nav className="flex-1 px-4 mt-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium text-sm",
                  isActive
                    ? "bg-[#10b98115] text-emerald-400 border-l-2 border-[#10B981] rounded-none"
                    : "text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-white hover:bg-white/20 dark:hover:bg-[#1C3454]",
                  item.name === 'Indicações' && !isActive && "indicacoes-glow"
                )}
              >
                <item.icon size={18} />
                {item.name}
                {item.name === 'Mensagens' && (unreadCount ?? 0) > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <PushFloatingBanner />
        <div className="p-4 border-t border-white/20 dark:border-slate-800/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 dark:text-[#94A3B8] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sair do perfil</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="w-64 bg-white/[0.15] backdrop-blur-xl dark:bg-[#132540] dark:backdrop-blur-none border-r border-white/20 dark:border-[#1C3050] relative flex flex-col pt-4">
            <div className="p-4 flex justify-between items-center border-b border-white/20 dark:border-[#1C3050]">
              <span className="text-lg font-bold tracking-tight uppercase text-emerald-400">
                Melocale <span className="text-white text-xs ml-1">Cliente</span>
              </span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/70 dark:text-[#94A3B8] p-1">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto pb-4">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                      isActive
                        ? "bg-[#10b98115] text-emerald-400 border-l-2 border-[#10B981] rounded-none"
                        : "text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-white",
                      item.name === 'Indicações' && !isActive && "indicacoes-glow"
                    )}
                  >
                    <item.icon size={18} />
                    {item.name}
                    {item.name === 'Mensagens' && (unreadCount ?? 0) > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/20 dark:border-[#1C3050]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 dark:text-[#94A3B8] hover:text-emerald-400 transition-all"
              >
                <LogOut size={18} />
                <span>Sair do perfil</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-white/20 dark:border-[#1C3050] bg-white/10 backdrop-blur-xl dark:bg-[#132540] dark:backdrop-blur-none flex items-center justify-between px-4 sm:px-6 z-10 w-full shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white/70 dark:text-[#94A3B8] p-1">
              <Menu size={22} />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="hidden sm:flex items-center gap-2 text-sm font-medium text-white/70 dark:text-[#94A3B8] hover:text-white dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          </div>

          <div className="flex-1" />

          {/* Avatar + dropdown */}
          <ThemeToggle />
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-sm font-medium text-white/80 dark:text-slate-300 hidden sm:block">{user?.email}</span>
              <AvatarCircle size="sm" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#132540] border border-slate-200 dark:border-[#243F6A] rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 dark:border-[#1C3050]">
                  <AvatarCircle size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {profile?.full_name || user?.email || '—'}
                    </p>
                    {profile?.city && (
                      <p className="text-xs text-[#4A6580] truncate">{profile.city}</p>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/cliente/perfil'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                  >
                    <UserCircle size={16} className="text-slate-400 dark:text-[#94A3B8] shrink-0" />
                    Meu Perfil
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/cliente/pedidos'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                  >
                    <ClipboardList size={16} className="text-slate-400 dark:text-[#94A3B8] shrink-0" />
                    Meus Pedidos
                  </button>
                  <div className="border-t border-slate-200 dark:border-[#1C3050] my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                  >
                    <LogOut size={16} className="shrink-0" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>

      <ClientPushModal onDismiss={() => {}} />
    </div>
  );
}
