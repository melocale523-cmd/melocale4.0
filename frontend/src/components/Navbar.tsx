import { useState, useEffect } from 'react';
import { Home, Menu, X, User, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import AuthModal from './auth/AuthModal';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({
    open: false,
    mode: 'login',
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Buscar Profissionais', href: '/login?mode=signup&role=client' },
    { name: 'Categorias', href: '#categorias' },
    { name: 'Como Funciona', href: '#como-funciona' },
    { name: 'Ser um Profissional', href: '/login?mode=signup&role=professional' },
  ];

  const openAuth = (mode: 'login' | 'signup') => {
    navigate('/login' + (mode === 'signup' ? '?mode=signup' : ''));
    setMobileMenuOpen(false);
  };

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
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4 border-b',
          isScrolled ? 'bg-[#0A0B0D]/80 backdrop-blur-md border-white/5 shadow-lg' : 'bg-transparent border-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" title="Ir para a página inicial">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black group-hover:scale-110 transition-transform">
              <Home size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white uppercase">
              MeloCalé
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium transition-all text-slate-400 hover:text-emerald-400 hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {!isAuthenticated ? (
              <>
                <Link 
                  to="/login?mode=signup"
                  className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black rounded-xl text-sm font-black transition-all shadow-lg shadow-yellow-500/10 uppercase tracking-wider"
                >
                  Cadastrar
                </Link>
                <Link 
                  to="/login?mode=login"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-sm font-black transition-all shadow-lg shadow-emerald-500/10 uppercase tracking-wider"
                >
                  Entrar
                </Link>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <Link 
                  to="/login?role=admin"
                  className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300 rounded-xl transition-all border border-white/5"
                  title="Acesso Restrito"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  to={getDashboardUrl()}
                  className="px-6 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-bold hover:bg-emerald-500 hover:text-black transition-all shadow-lg"
                  title="Acessar meu painel"
                >
                  Minha Área
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-[#14161B] shadow-2xl p-6 md:hidden flex flex-col gap-4 border-t border-white/5"
            >
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-lg font-medium text-white py-2 border-b border-white/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="flex flex-col gap-3 mt-4">
                {!isAuthenticated ? (
                  <div className="flex flex-col gap-3">
                    <Link 
                      to="/login?mode=signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full bg-yellow-400 text-black py-4 rounded-xl font-black flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-yellow-500/10 transition-all active:scale-95"
                    >
                      Cadastrar
                    </Link>
                    <div className="flex gap-2">
                      <Link 
                        to="/login?mode=login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 bg-emerald-500 text-black py-4 rounded-xl font-black flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-emerald-500/10 transition-all active:scale-95 transition-all"
                      >
                        <User size={20} />
                        Entrar
                      </Link>
                      <Link 
                        to="/login?role=admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-14 bg-white/5 border border-white/5 text-slate-500 py-4 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link
                      to={getDashboardUrl()}
                      className="w-full bg-emerald-500 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                      onClick={() => setMobileMenuOpen(false)}
                      title="Ir para o painel de controle"
                    >
                      Ver Dashboard
                    </Link>
                    <button 
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full bg-white/5 text-slate-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                      title="Sair da conta"
                    >
                      <LogOut size={18} />
                      Sair
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {!isAuthenticated && (
        <AuthModal 
          isOpen={authModal.open} 
          onClose={() => setAuthModal({ ...authModal, open: false })} 
          mode={authModal.mode} 
        />
      )}
    </>
  );
}
