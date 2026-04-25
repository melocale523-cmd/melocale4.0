import { RouterProvider, createBrowserRouter, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import AuthLayout from './layouts/AuthLayout';
import ClientLayout from './layouts/ClientLayout';
import ProfessionalLayout from './layouts/ProfessionalLayout';
import AdminLayout from './layouts/AdminLayout';
import LandingPage from './pages/Landing';
import Login from './pages/auth/Login';
import ClientDashboard from './pages/client/Dashboard';
import ClientPedidos from './pages/client/Pedidos';
import ClientMensagens from './pages/client/Mensagens';
import ClientPerfil from './pages/client/Perfil';
import ProfessionalDashboard from './pages/professional/Dashboard';
import ProfessionalLeads from './pages/professional/Leads';
import ProfessionalCompras from './pages/professional/Compras';
import ProfessionalWallet from './pages/professional/Wallet';
import ProfessionalPerfil from './pages/professional/Perfil';
import AdminDashboard from './pages/admin/Dashboard';
import AdminObservabilidade from './pages/admin/Observabilidade';
import AdminDisputas from './pages/admin/Disputas';
import AdminPlanos from './pages/admin/Planos';
import AdminTransacoes from './pages/admin/Transacoes';
import { useAuthGuard } from './hooks/useAuthGuard';
import RouteProgressBar from './components/RouteProgressBar';

const queryClient = new QueryClient();

import { useUserRole } from './hooks/useUserRole';
import { Loader2 } from 'lucide-react';

function RootLayout() {
  return (
    <>
      <RouteProgressBar />
      <Outlet />
    </>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode, role: 'client' | 'professional' | 'admin' }) {
  const { user, isAuthenticated, isLoading, currentMode, setMode } = useAuthStore();

  useEffect(() => {
    if (user && currentMode === 'professional' && user.role !== 'professional' && user.role !== 'admin') {
      setMode('client');
    }
  }, [user, currentMode, setMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex flex-col items-center justify-center text-emerald-500">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-slate-400 font-medium">Verificando acesso...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 1. Definição da Modalidade Efetiva Lógica
  let effectiveMode: 'client' | 'professional' | 'admin' = 'client';
  
  if (user.role === 'admin') {
    effectiveMode = 'admin';
  } else if (user.role === 'professional') {
    effectiveMode = (currentMode as 'client'|'professional') || 'professional';
  } else {
    effectiveMode = 'client'; // Força client para quem não é admin nem professional
  }

  // 2. Transição final controlada. Impede múltiplos redirecionamentos simultâneos sem React useEffect cascade
  if (role !== effectiveMode) {
    let dashboard = '/cliente/dashboard';
    if (effectiveMode === 'admin') dashboard = '/admin/dashboard';
    else if (effectiveMode === 'professional') dashboard = '/profissional/dashboard';
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, currentMode, setMode } = useAuthStore();

  useEffect(() => {
    if (user && currentMode === 'professional' && user.role !== 'professional' && user.role !== 'admin') {
      setMode('client');
    }
  }, [user, currentMode, setMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-emerald-500 bg-[#0A0B0D]">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-slate-400 font-medium">Carregando sessão...</p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    let effectiveMode: 'client' | 'professional' | 'admin' = 'client';
    
    if (user.role === 'admin') {
      effectiveMode = 'admin';
    } else if (user.role === 'professional') {
      effectiveMode = (currentMode as 'client'|'professional') || 'professional';
    } else {
      effectiveMode = 'client';
    }

    let dashboard = '/cliente/dashboard';
    if (effectiveMode === 'admin') dashboard = '/admin/dashboard';
    else if (effectiveMode === 'professional') dashboard = '/profissional/dashboard';
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
}

import ProfessionalAgenda from './pages/professional/Agenda';
import ProfessionalEstatisticas from './pages/professional/Estatisticas';
import ProfessionalAssinatura from './pages/professional/Assinatura';
import ProfessionalMensagens from './pages/professional/Mensagens';

import AdminPendentes from './pages/admin/Pendentes';
import AdminAprovados from './pages/admin/Aprovados';
import AdminClientes from './pages/admin/Clientes';
import AdminUsuarios from './pages/admin/Usuarios';
import AdminPacotes from './pages/admin/Pacotes';

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />
      },
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <AuthRedirect><Login /></AuthRedirect> },
          // add signup if needed later
        ]
      },
      {
        path: '/cliente',
        element: <ProtectedRoute role="client"><ClientLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <ClientDashboard /> },
          { path: 'pedidos', element: <ClientPedidos /> },
          { path: 'mensagens', element: <ClientMensagens /> },
          { path: 'perfil', element: <ClientPerfil /> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '/profissional',
        element: <ProtectedRoute role="professional"><ProfessionalLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <ProfessionalDashboard /> },
          { path: 'leads', element: <ProfessionalLeads /> },
          { path: 'meus-leads', element: <ProfessionalCompras /> },
          { path: 'agenda', element: <ProfessionalAgenda /> },
          { path: 'mensagens', element: <ProfessionalMensagens /> },
          { path: 'estatisticas', element: <ProfessionalEstatisticas /> },
          { path: 'carteira', element: <ProfessionalWallet /> },
          { path: 'assinatura', element: <ProfessionalAssinatura /> },
          { path: 'perfil', element: <ProfessionalPerfil /> },
          { path: 'configuracoes', element: <div className="p-8 text-slate-400">Configurações (Em breve)</div> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '/admin',
        element: <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <AdminDashboard /> },
          { path: 'observabilidade', element: <AdminObservabilidade /> },
          { path: 'disputas', element: <AdminDisputas /> },
          { path: 'usuarios', element: <AdminUsuarios /> },
          { path: 'pendentes', element: <AdminPendentes /> },
          { path: 'aprovados', element: <AdminAprovados /> },
          { path: 'clientes', element: <AdminClientes /> },
          { path: 'planos', element: <AdminPlanos /> },
          { path: 'pacotes', element: <AdminPacotes /> },
          { path: 'transacoes', element: <AdminTransacoes /> },
          { path: 'financeiro-auditoria', element: <div className="p-8 text-slate-400">Auditoria Financeira (Em breve)</div> },
          { path: 'auditoria-logs', element: <div className="p-8 text-slate-400">Auditoria Logs (Em breve)</div> },
          { path: 'equipe', element: <div className="p-8 text-slate-400">Equipe (Em breve)</div> },
          { path: 'simulador', element: <div className="p-8 text-slate-400">Simulador (Em breve)</div> },
          { path: 'configuracoes', element: <div className="p-8 text-slate-400">Configurações (Em breve)</div> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      }
    ]
  }
]);

import AuthInitializer from './components/auth/AuthInitializer';

import { Toaster } from 'sonner';
import AiChatWidget from './components/AiChat/AiChatWidget';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
        <AiChatWidget />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
