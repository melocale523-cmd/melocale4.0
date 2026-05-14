import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ArrowLeft, Calendar, MessageSquare, BarChart3, CreditCard, Settings, Menu, X, Wallet, LayoutDashboard, Target, ShoppingBag, UserCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { walletService } from '../services/dbServices';
import { useProfile } from '../hooks/useProfile';
import NotificationBell from '../components/NotificationBell';
import ProfessionalPushModal from '../components/ProfessionalPushModal';
import PushFloatingBanner from '../components/PushFloatingBanner';

export default function ProfessionalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useProfile();

  const { data: balance, isLoading } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: walletService.getBalance,
    refetchOnMount: true,
  });

  const balanceDisplay = typeof balance === 'number' ? Math.floor(balance) : 0;

  useEffect(() => {
    if (user && user.role !== 'professional' && user.role !== 'admin') navigate('/', { replace: true });
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
    { name: 'Dashboard', path: '/profissional/dashboard', icon: LayoutDashboard },
    { name: 'Clientes Disponíveis', path: '/profissional/leads', icon: Target },
    { name: 'Meus Clientes', path: '/profissional/meus-leads', icon: ShoppingBag },
    { name: 'Agenda', path: '/profissional/agenda', icon: Calendar },
    { name: 'Mensagens', path: '/profissional/mensagens', icon: MessageSquare },
    { name: 'Estatísticas', path: '/profissional/estatisticas', icon: BarChart3 },
    { name: 'Carteira', path: '/profissional/carteira', icon: Wallet },
    { name: 'Assinatura', path: '/profissional/assinatura', icon: CreditCard },
    { name: 'Perfil', path: '/profissional/perfil', icon: UserCircle },
    { name: 'Configurações', path: '/profissional/configuracoes', icon: Settings },
  ];

  const queryClient = useQueryClient();

  const { data: unreadCount } = useQuery({
    queryKey: ['unread_count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { data: prof } = await supabase
        .from('professionals').select('id').eq('user_id', user.id).maybeSingle();
      if (!prof) return 0;
      const { data } = await supabase
        .from('conversations')
        .select('unread_for_prof')
        .eq('professional_id', prof.id)
        .gt('unread_for_prof', 0);
      return (data || []).reduce((acc, c) => acc + (c.unread_for_prof || 0), 0);
    },
  });

  useEffect(() => {
    const ch = supabase.channel('prof_unread_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread_count'] });
      })
      .subscribe();
    return () => { ch.unsubscribe(); supabase.removeChannel(ch); };
  }, [queryClient]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#0E1C32] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1C3050] bg-[#132540] flex flex-col hidden md:flex">
        <div className="p-6">
           <span className="text-xl font-bold tracking-tight uppercase text-emerald-400">
            Melocale <span className="text-white text-xs ml-1 bg-white/10 px-2 py-0.5 rounded ml-2">PRO</span>
          </span>
        </div>
        
        <nav className="flex-1 px-4 mt-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link 
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                  isActive 
                    ? "bg-[#10b98115] text-emerald-400 border-l-2 border-[#10B981] rounded-none" 
                    : "text-[#94A3B8] hover:text-white hover:bg-[#1C3454]"
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
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
           <button
             onClick={handleLogout}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#94A3B8] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
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
          <aside className="w-64 bg-[#132540] border-r border-[#1C3050] relative flex flex-col pt-4">
             <div className="p-4 flex justify-between items-center border-b border-[#1C3050]">
                <span className="text-lg font-bold tracking-tight uppercase text-emerald-400">
                  Melocale <span className="text-white text-xs ml-1 bg-white/10 px-1 py-0.5 rounded ml-1">PRO</span>
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-[#94A3B8] p-1">
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
                        : "text-[#94A3B8] hover:text-white"
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
                )
              })}
             </nav>
             <div className="p-4 border-t border-[#1C3050]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#94A3B8] hover:text-emerald-400 transition-all"
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
        <header className="h-16 border-b border-[#1C3050] bg-[#132540] backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-10 w-full shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
             <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-[#94A3B8] p-1">
               <Menu size={22} />
             </button>
             <button 
               onClick={() => navigate(-1)} 
               className="hidden sm:flex items-center gap-2 text-sm font-medium text-[#94A3B8] hover:text-slate-200 transition-colors"
             >
               <ArrowLeft size={16} /> Voltar
             </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-6">
            {/* Wallet balance quick view */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
               <Wallet size={16} className="text-yellow-400" />
               <span className="text-lg font-mono font-bold text-yellow-400">
                 {isLoading ? '...' : (typeof balance === 'object' && balance !== null && 'balance_coins' in balance ? Math.floor(balance.balance_coins) : Math.floor(typeof balance === 'number' ? balance : 0))} moedas
               </span>
            </div>
            <NotificationBell />
            <div className="relative border-l border-[#243F6A] pl-6" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-medium text-slate-300 hidden sm:block">{user?.email}</span>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-bold shrink-0">
                    {user?.email?.charAt(0).toUpperCase() || 'P'}
                  </div>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#132540] border border-[#243F6A] rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  {/* Profile header */}
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1C3050]">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-black font-bold shrink-0">
                        {user?.email?.charAt(0).toUpperCase() || 'P'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{profile?.full_name || user?.email || '—'}</p>
                      {profile?.city && (
                        <p className="text-xs text-[#4A6580] truncate">{profile.city}</p>
                      )}
                    </div>
                  </div>
                  {/* Phone row */}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <UserCircle size={16} className="text-slate-600 shrink-0" />
                    <span className="text-xs text-[#4A6580]">{profile?.phone || 'Telefone não informado'}</span>
                  </div>
                  <div className="border-t border-[#1C3050] my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/profissional/perfil'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                  >
                    <UserCircle size={16} className="text-[#94A3B8] shrink-0" />
                    Ver Meu Perfil
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/profissional/carteira'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                  >
                    <Wallet size={16} className="text-yellow-400 shrink-0" />
                    Minha Carteira
                    <span className="ml-auto text-xs font-mono text-yellow-400">{isLoading ? '…' : balanceDisplay} moedas</span>
                  </button>
                  <div className="border-t border-[#1C3050] my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); supabase.auth.signOut(); navigate('/'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                  >
                    <LogOut size={16} className="shrink-0" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
           <Outlet />
        </div>
      </main>

      <ProfessionalPushModal onDismiss={() => setShowBanner(true)} />
      {showBanner && <PushFloatingBanner />}
    </div>
  );
}
