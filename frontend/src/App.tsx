import { lazy, Suspense } from 'react';
import { RouterProvider, createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { Loader2 } from 'lucide-react';
import AuthLayout from './layouts/AuthLayout';
import ClientLayout from './layouts/ClientLayout';
import ProfessionalLayout from './layouts/ProfessionalLayout';
import AdminLayout from './layouts/AdminLayout';
import AuthInitializer from './components/auth/AuthInitializer';
import RouteProgressBar from './components/RouteProgressBar';
import RealtimeNotificationHandler from './components/RealtimeNotificationHandler';
import AiChatWidget from './components/AiChat/AiChatWidget';
import { Toaster } from 'sonner';

// Lazy-loaded pages — client
const LandingPage = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'));
const ClientPedidos = lazy(() => import('./pages/client/Pedidos'));
const ClientMensagens = lazy(() => import('./pages/client/Mensagens'));
const ClientPerfil = lazy(() => import('./pages/client/Perfil'));

// Lazy-loaded pages — professional
const ProfessionalDashboard = lazy(() => import('./pages/professional/Dashboard'));
const ProfessionalLeads = lazy(() => import('./pages/professional/Leads'));
const ProfessionalCompras = lazy(() => import('./pages/professional/Compras'));
const ProfessionalWallet = lazy(() => import('./pages/professional/Wallet'));
const ProfessionalPerfil = lazy(() => import('./pages/professional/Perfil'));
const ProfessionalAgenda = lazy(() => import('./pages/professional/Agenda'));
const ProfessionalEstatisticas = lazy(() => import('./pages/professional/Estatisticas'));
const ProfessionalAssinatura = lazy(() => import('./pages/professional/Assinatura'));
const ProfessionalMensagens = lazy(() => import('./pages/professional/Mensagens'));

// Lazy-loaded pages — admin
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminObservabilidade = lazy(() => import('./pages/admin/Observabilidade'));
const AdminDisputas = lazy(() => import('./pages/admin/Disputas'));
const AdminPlanos = lazy(() => import('./pages/admin/Planos'));
const AdminTransacoes = lazy(() => import('./pages/admin/Transacoes'));
const AdminPendentes = lazy(() => import('./pages/admin/Pendentes'));
const AdminAprovados = lazy(() => import('./pages/admin/Aprovados'));
const AdminClientes = lazy(() => import('./pages/admin/Clientes'));
const AdminUsuarios = lazy(() => import('./pages/admin/Usuarios'));
const AdminPacotes = lazy(() => import('./pages/admin/Pacotes'));

// Lazy-loaded pages — checkout
const CheckoutSuccess = lazy(() => import('./pages/checkout/CheckoutSuccess'));
const CheckoutCancel = lazy(() => import('./pages/checkout/CheckoutCancel'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5000,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0A0B0D] flex flex-col items-center justify-center text-emerald-500">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="text-slate-400 font-medium">Carregando...</p>
    </div>
  );
}

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

  let effectiveMode: 'client' | 'professional' | 'admin' = 'client';

  if (user.role === 'admin') {
    effectiveMode = 'admin';
  } else if (user.role === 'professional') {
    effectiveMode = (currentMode as 'client' | 'professional') || 'professional';
  } else {
    effectiveMode = 'client';
  }

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
      effectiveMode = (currentMode as 'client' | 'professional') || 'professional';
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

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>
      },
      {
        path: '/checkout/success',
        element: <Suspense fallback={<PageLoader />}><CheckoutSuccess /></Suspense>
      },
      {
        path: '/checkout/cancel',
        element: <Suspense fallback={<PageLoader />}><CheckoutCancel /></Suspense>
      },
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            element: (
              <AuthRedirect>
                <Suspense fallback={<PageLoader />}><Login /></Suspense>
              </AuthRedirect>
            )
          },
        ]
      },
      {
        path: '/cliente',
        element: <ProtectedRoute role="client"><ClientLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <Suspense fallback={<PageLoader />}><ClientDashboard /></Suspense> },
          { path: 'pedidos', element: <Suspense fallback={<PageLoader />}><ClientPedidos /></Suspense> },
          { path: 'mensagens', element: <Suspense fallback={<PageLoader />}><ClientMensagens /></Suspense> },
          { path: 'perfil', element: <Suspense fallback={<PageLoader />}><ClientPerfil /></Suspense> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '/profissional',
        element: <ProtectedRoute role="professional"><ProfessionalLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <Suspense fallback={<PageLoader />}><ProfessionalDashboard /></Suspense> },
          { path: 'leads', element: <Suspense fallback={<PageLoader />}><ProfessionalLeads /></Suspense> },
          { path: 'meus-leads', element: <Suspense fallback={<PageLoader />}><ProfessionalCompras /></Suspense> },
          { path: 'agenda', element: <Suspense fallback={<PageLoader />}><ProfessionalAgenda /></Suspense> },
          { path: 'mensagens', element: <Suspense fallback={<PageLoader />}><ProfessionalMensagens /></Suspense> },
          { path: 'estatisticas', element: <Suspense fallback={<PageLoader />}><ProfessionalEstatisticas /></Suspense> },
          { path: 'carteira', element: <Suspense fallback={<PageLoader />}><ProfessionalWallet /></Suspense> },
          { path: 'assinatura', element: <Suspense fallback={<PageLoader />}><ProfessionalAssinatura /></Suspense> },
          { path: 'perfil', element: <Suspense fallback={<PageLoader />}><ProfessionalPerfil /></Suspense> },
          { path: 'configuracoes', element: <div className="p-8 text-slate-400">Configurações (Em breve)</div> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '/admin',
        element: <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense> },
          { path: 'observabilidade', element: <Suspense fallback={<PageLoader />}><AdminObservabilidade /></Suspense> },
          { path: 'disputas', element: <Suspense fallback={<PageLoader />}><AdminDisputas /></Suspense> },
          { path: 'usuarios', element: <Suspense fallback={<PageLoader />}><AdminUsuarios /></Suspense> },
          { path: 'pendentes', element: <Suspense fallback={<PageLoader />}><AdminPendentes /></Suspense> },
          { path: 'aprovados', element: <Suspense fallback={<PageLoader />}><AdminAprovados /></Suspense> },
          { path: 'clientes', element: <Suspense fallback={<PageLoader />}><AdminClientes /></Suspense> },
          { path: 'planos', element: <Suspense fallback={<PageLoader />}><AdminPlanos /></Suspense> },
          { path: 'pacotes', element: <Suspense fallback={<PageLoader />}><AdminPacotes /></Suspense> },
          { path: 'transacoes', element: <Suspense fallback={<PageLoader />}><AdminTransacoes /></Suspense> },
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <RealtimeNotificationHandler />
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
        <AiChatWidget />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
