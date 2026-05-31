import { useState, useEffect } from 'react';
import { Home, Menu, X, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  topOffset?: number
}

export default function Navbar({ topOffset = 0 }: NavbarProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 20);
      setPastHero(y > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Buscar Profissionais', href: '/login?mode=signup&role=client' },
    { name: 'Categorias', href: '#categorias' },
    { name: 'Como Funciona', href: '#como-funciona' },
    { name: 'Ser um Profissional', href: '/login?mode=signup&role=professional' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate('/');
  };

  const getDashboardUrl = () => {
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'professional') return '/profissional/dashboard';
    return '/cliente/dashboard';
  };

  return (
    <>
      <nav
        id="main-nav"
        style={{ top: topOffset ? `${topOffset}px` : '0' }}
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300 px-4 md:px-6 py-3 md:py-4 border-b',
          isScrolled ? 'bg-[#0E1C32]/80 backdrop-blur-md border-[#1C3050] shadow-lg' : 'bg-transparent border-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0" title="Ir para a página inicial">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black group-hover:scale-110 transition-transform">
              <Home size={20} />
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight text-white uppercase">
              MeloCalé
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium transition-all text-[#94A3B8] hover:text-emerald-400 hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Right side — always visible */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* ThemeToggle — desktop only */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            {!isAuthenticated ? (
              <>
                {/* Entrar — always visible, compact on mobile */}
                <Link
                  to="/login?mode=login"
                  className="px-3 py-1.5 md:px-5 md:py-2.5 border border-emerald-500/60 text-emerald-400 rounded-xl text-xs md:text-sm font-black transition-all hover:bg-emerald-500/10 whitespace-nowrap"
                >
                  Entrar
                </Link>
                {/* Cadastrar — sticky CTA aparece após scroll do hero */}
                <Link
                  to="/login?mode=signup"
                  className={cn(
                    'px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap',
                    pastHero
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30'
                      : 'bg-yellow-400 hover:bg-yellow-500 text-black'
                  )}
                >
                  {pastHero ? 'Cadastrar Grátis' : 'Cadastrar'}
                </Link>
                {/* Admin icon — desktop only */}
                <Link
                  to="/login?role=admin"
                  className="hidden md:flex p-2.5 bg-white/5 hover:bg-white/10 text-[#4A6580] hover:text-slate-300 rounded-xl transition-all border border-[#1C3050]"
                  title="Acesso Restrito"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={getDashboardUrl()}
                  className="px-3 py-1.5 md:px-5 md:py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs md:text-sm font-bold hover:bg-emerald-500 hover:text-black transition-all whitespace-nowrap"
                  title="Acessar meu painel"
                >
                  Minha Área
                </Link>
                <button
                  onClick={handleLogout}
                  className="hidden md:flex p-2 text-[#94A3B8] hover:text-red-400 transition-colors cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}

            {/* Hamburger — mobile only, nav links only */}
            <button
              className="md:hidden p-1.5 rounded-lg text-white ml-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown — nav links only */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-[#1C3454] shadow-2xl p-6 md:hidden flex flex-col gap-3 border-t border-[#1C3050]"
            >
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-base font-medium text-white py-2 border-b border-[#1C3050]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="flex items-center justify-between mt-2 pt-2">
                <ThemeToggle />
                {isAuthenticated && (
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 text-[#94A3B8] hover:text-red-400 text-sm font-bold transition-colors"
                  >
                    <LogOut size={16} />
                    Sair da conta
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
