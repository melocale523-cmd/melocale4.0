import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, MessageSquare, UserCircle, LogOut, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export default function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  
  const navItems = [
    { name: 'Dashboard', path: '/cliente/dashboard', icon: Home },
    { name: 'Meus Pedidos', path: '/cliente/pedidos', icon: ClipboardList },
    { name: 'Mensagens', path: '/cliente/mensagens', icon: MessageSquare },
    { name: 'Meu Perfil', path: '/cliente/perfil', icon: UserCircle },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#0A0B0D] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#14161B] flex flex-col hidden md:flex">
        <div className="p-6">
           <span className="text-xl font-bold tracking-tight uppercase text-emerald-400">
            Melocale <span className="text-white text-xs ml-1">Cliente</span>
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
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            )
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-white/5 bg-[#14161B]/80 backdrop-blur-md flex items-center justify-between px-6 z-10 w-full shrink-0">
          <div className="flex items-center gap-4">
             <div className="md:hidden font-bold text-emerald-400 mr-2">MCL</div>
             <button 
               onClick={() => navigate(-1)} 
               className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
             >
               <ArrowLeft size={16} /> Voltar
             </button>
          </div>
          
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-300">{user?.email?.split('@')[0]}</span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30">
               {user?.email?.charAt(0).toUpperCase() || 'C'}
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
