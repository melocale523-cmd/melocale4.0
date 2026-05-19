import { lazy, Suspense, useEffect } from 'react';
import { RouterProvider, createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { Loader2 } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { toast } from 'sonner';
import AuthLayout from './layouts/AuthLayout';
import ClientLayout from './layouts/ClientLayout';
import ProfessionalLayout from './layouts/ProfessionalLayout';
import AdminLayout from './layouts/AdminLayout';
import AuthInitializer from './components/auth/AuthInitializer';
import { OnboardingGuard } from './components/auth/OnboardingGuard';
import ErrorBoundary from './components/ErrorBoundary';
import RouteProgressBar from './components/RouteProgressBar';
import RealtimeNotificationHandler from './components/RealtimeNotificationHandler';
import AiChatWidget from './components/AiChat/AiChatWidget';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import AdminEmBreve from './components/AdminEmBreve';
import { Toaster } from 'sonner';

// Lazy-loaded pages — client
const LandingPage = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'));
const ClientPedidos = lazy(() => import('./pages/client/Pedidos'));
const ClientMensagens = lazy(() => import('./pages/client/Mensagens'));
const ClientPerfil = lazy(() => import('./pages/client/Perfil'));
const ClientAgenda = lazy(() => import('./pages/client/Agenda'));
const ClientConfiguracoes = lazy(() => import('./pages/client/Configuracoes'));

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
const ProfessionalConfiguracoes = lazy(() => import('./pages/professional/Configuracoes'));
const ProfessionalOnboarding = lazy(() => import('./pages/professional/Onboarding'));
const PerfilPublico = lazy(() => import('./pages/professional/PerfilPublico'));

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
const AdminCategorias = lazy(() => import('./pages/admin/Categorias'));
const AdminSuporte = lazy(() => import('./pages/admin/Suporte'));
const AdminTestes = lazy(() => import('./pages/admin/Testes'));
const AdminRelatorios = lazy(() => import('./pages/admin/Relatorios'));

// Lazy-loaded pages — checkout
const CheckoutSuccess = lazy(() => import('./pages/checkout/CheckoutSuccess'));
const CheckoutCancel = lazy(() => import('./pages/checkout/CheckoutCancel'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Termos = lazy(() => import('./pages/Termos'));
const Privacidade = lazy(() => import('./pages/Privacidade'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 30,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0E1C32] flex flex-col items-center justify-center text-emerald-500">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="text-[#94A3B8] font-medium">Carregando...</p>
    </div>
  );
}

function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    const msg = localStorage.getItem("redirect_msg");
    if (msg) {
      localStorage.removeItem("redirect_msg");
      toast.info(msg);
    }
  }, [location.pathname]);

  return (
    <>
      <RouteProgressBar />
      <AiChatWidget />
      <PWAInstallPrompt />
      <Outlet />
    </>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode, role: 'client' | 'professional' | 'admin' }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0E1C32] flex flex-col items-center justify-center text-emerald-500">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-[#94A3B8] font-medium">Verificando acesso...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRole: 'client' | 'professional' | 'admin' =
    user.role === 'admin' ? 'admin'
    : user.role === 'professional' ? 'professional'
    : 'client';

  if (role !== userRole) {
    const dashboard =
      userRole === 'admin' ? '/admin/dashboard'
      : userRole === 'professional' ? '/profissional/dashboard'
      : '/cliente/dashboard';
    const msgs: Record<string, string> = {
      client: 'Sua conta é de cliente. Redirecionando para sua área...',
      professional: 'Sua conta é profissional. Redirecionando para sua área...',
      admin: 'Acesso restrito. Redirecionando...',
    };
    localStorage.setItem("redirect_msg", msgs[userRole]);
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0E1C32] flex flex-col items-center justify-center text-emerald-500">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-[#94A3B8] font-medium">Verificando acesso...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-emerald-500 bg-[#0E1C32]">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="text-[#94A3B8] font-medium">Carregando sessão...</p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const dashboard =
      user.role === 'admin' ? '/admin/dashboard'
      : user.role === 'professional' ? '/profissional/dashboard'
      : '/cliente/dashboard';
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
        element: <AuthRedirect><ErrorBoundary><Suspense fallback={<PageLoader />}><LandingPage /></Suspense></ErrorBoundary></AuthRedirect>
      },
      {
        path: '/checkout/success',
        element: <AuthGuard><ErrorBoundary><Suspense fallback={<PageLoader />}><CheckoutSuccess /></Suspense></ErrorBoundary></AuthGuard>
      },
      {
        path: '/checkout/cancel',
        element: <AuthGuard><ErrorBoundary><Suspense fallback={<PageLoader />}><CheckoutCancel /></Suspense></ErrorBoundary></AuthGuard>
      },
      {
        path: '/termos',
        element: <ErrorBoundary><Suspense fallback={<PageLoader />}><Termos /></Suspense></ErrorBoundary>
      },
      {
        path: '/privacidade',
        element: <ErrorBoundary><Suspense fallback={<PageLoader />}><Privacidade /></Suspense></ErrorBoundary>
      },
      {
        path: '/profissional/:id/perfil',
        element: <ErrorBoundary><Suspense fallback={<PageLoader />}><PerfilPublico /></Suspense></ErrorBoundary>
      },
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            element: (
              <AuthRedirect>
                <ErrorBoundary><Suspense fallback={<PageLoader />}><Login /></Suspense></ErrorBoundary>
              </AuthRedirect>
            )
          },
        ]
      },
      {
        path: '/cliente',
        element: <ProtectedRoute role="client"><ClientLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ClientDashboard /></Suspense></ErrorBoundary> },
          { path: 'pedidos', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ClientPedidos /></Suspense></ErrorBoundary> },
          { path: 'mensagens', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ClientMensagens /></Suspense></ErrorBoundary> },
          { path: 'perfil', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ClientPerfil /></Suspense></ErrorBoundary> },
          { path: 'agenda', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ClientAgenda /></Suspense></ErrorBoundary> },
          { path: 'configuracoes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ClientConfiguracoes /></Suspense></ErrorBoundary> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '/profissional/onboarding',
        element: (
          <ProtectedRoute role="professional">
            <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalOnboarding /></Suspense></ErrorBoundary>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profissional',
        element: <ProtectedRoute role="professional"><OnboardingGuard><ProfessionalLayout /></OnboardingGuard></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalDashboard /></Suspense></ErrorBoundary> },
          { path: 'leads', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalLeads /></Suspense></ErrorBoundary> },
          { path: 'meus-leads', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalCompras /></Suspense></ErrorBoundary> },
          { path: 'clientes-disponiveis', element: <Navigate to="/profissional/leads" replace /> },
          { path: 'meus-clientes', element: <Navigate to="/profissional/meus-leads" replace /> },
          { path: 'agenda', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalAgenda /></Suspense></ErrorBoundary> },
          { path: 'mensagens', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalMensagens /></Suspense></ErrorBoundary> },
          { path: 'estatisticas', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalEstatisticas /></Suspense></ErrorBoundary> },
          { path: 'carteira', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalWallet /></Suspense></ErrorBoundary> },
          { path: 'assinatura', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalAssinatura /></Suspense></ErrorBoundary> },
          { path: 'perfil', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalPerfil /></Suspense></ErrorBoundary> },
          { path: 'configuracoes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><ProfessionalConfiguracoes /></Suspense></ErrorBoundary> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '/admin',
        element: <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>,
        children: [
          { path: 'dashboard', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense></ErrorBoundary> },
          { path: 'observabilidade', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminObservabilidade /></Suspense></ErrorBoundary> },
          { path: 'disputas', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminDisputas /></Suspense></ErrorBoundary> },
          { path: 'usuarios', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminUsuarios /></Suspense></ErrorBoundary> },
          { path: 'pendentes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminPendentes /></Suspense></ErrorBoundary> },
          { path: 'aprovados', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminAprovados /></Suspense></ErrorBoundary> },
          { path: 'clientes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminClientes /></Suspense></ErrorBoundary> },
          { path: 'planos', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminPlanos /></Suspense></ErrorBoundary> },
          { path: 'pacotes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminPacotes /></Suspense></ErrorBoundary> },
          { path: 'categorias', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminCategorias /></Suspense></ErrorBoundary> },
          { path: 'transacoes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminTransacoes /></Suspense></ErrorBoundary> },
          { path: 'financeiro-auditoria', element: <AdminEmBreve /> },
          { path: 'auditoria-logs', element: <AdminEmBreve /> },
          { path: 'equipe', element: <AdminEmBreve /> },
          { path: 'simulador', element: <AdminEmBreve /> },
          { path: 'suporte', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminSuporte /></Suspense></ErrorBoundary> },
          { path: 'testes', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminTestes /></Suspense></ErrorBoundary> },
          { path: 'relatorios', element: <ErrorBoundary><Suspense fallback={<PageLoader />}><AdminRelatorios /></Suspense></ErrorBoundary> },
          { path: 'configuracoes', element: <AdminEmBreve /> },
          { path: '', element: <Navigate to="dashboard" replace /> }
        ]
      },
      {
        path: '*',
        element: <ErrorBoundary><Suspense fallback={<PageLoader />}><NotFound /></Suspense></ErrorBoundary>
      }
    ]
  }
]);

export default function App() {
  useTheme(); // apply persisted/system theme on initialization

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <RealtimeNotificationHandler />
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
