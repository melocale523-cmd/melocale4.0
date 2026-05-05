import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut, ArrowLeft, Calendar, MessageSquare, BarChart3, CreditCard, Settings,
  Menu, X, Wallet, LayoutDashboard, Target, ShoppingBag, UserCircle, ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { walletService } from '../services/dbServices';

export default function ProfessionalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useProfile();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: walletService.getBalance,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const balanceCoins = typeof balance === 'number' ? Math.floor(balance) : 0;

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const displayName =
    profile?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Profissional';

  const avatarInitial = (profile?.full_name || user?.email || 'P').charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-[#0A0B0D] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#14161B] flex-col hidden md:flex">
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
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sair do perfil</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="w-64 bg-[#14161B] border-r border-white/5 relative flex flex-col pt-4">
            <div className="p-4 flex justify-between items-center border-b border-white/5">
              <span className="text-lg font-bold tracking-tight uppercase text-emerald-400">
                Melocale <span className="text-white text-xs ml-1 bg-white/10 px-1 py-0.5 rounded ml-1">PRO</span>
              </span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 p-1">
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
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm',
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <item.icon size={18} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-emerald-400 transition-all"
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
        <header className="h-16 border-b border-white/5 bg-[#14161B]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-10 w-full shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-slate-400 p-1">
              <Menu size={22} />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            {/* Wallet balance quick view */}
            <Link
              to="/profissional/carteira"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors"
            >
              <Wallet size={16} className="text-yellow-400" />
              <span className="text-base font-mono font-bold text-yellow-400">
                {balanceLoading ? '...' : `${balanceCoins} moedas`}
              </span>
            </Link>

            {/* Avatar dropdown */}
            <div className="relative border-l border-white/10 pl-4" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="text-sm font-medium text-slate-300 hidden sm:block">
                  {displayName}
                </span>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-bold text-sm">
                    {avatarInitial}
                  </div>
                )}
                <ChevronDown
                  size={14}
                  className={cn(
                    'text-slate-400 transition-transform',
                    dropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-[#14161B] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-bold text-white truncate">
                      {profile?.full_name || displayName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>

                  <Link
                    to="/profissional/perfil"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <UserCircle size={16} className="text-slate-400" />
                    Ver Meu Perfil
                  </Link>

                  <Link
                    to="/profissional/carteira"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Wallet size={16} className="text-yellow-400" />
                    <span>
                      Minha Carteira{' '}
                      <span className="text-yellow-400 font-bold">
                        ({balanceLoading ? '...' : `${balanceCoins} moedas`})
                      </span>
                    </span>
                  </Link>

                  <div className="border-t border-white/5">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
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
    </div>
  );
}
