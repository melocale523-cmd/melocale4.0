import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Inbox } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import RequestWizard, { type WizardData } from '../../components/RequestWizard';
import ReviewModal from '../../components/ReviewModal';
import OrderCreatedPushPrompt from '../../components/OrderCreatedPushPrompt';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { usePedidosData, type PedidoItem } from '../../hooks/usePedidosData';
import { useLeadReviewable, type ReviewableInfo } from '../../hooks/useLeadReviewable';
import { PedidoCard } from './pedidos/PedidoCard';
import { ProposalsModal } from './pedidos/ProposalsModal';
import { ProfessionalProfileModal } from './pedidos/ProfessionalProfileModal';
import { DeleteConfirmModal } from './pedidos/DeleteConfirmModal';

const STATUS_TABS = ['Todos', 'Aberto', 'Orçando', 'Finalizado'] as const;

interface ProfileModalState {
  userId: string;
  name: string;
  avatar: string | null;
}

type ReviewModalState = Pick<ReviewableInfo, 'appointmentId' | 'professionalId' | 'professionalName'>;

export default function Pedidos() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoItem | null>(null);
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [editingPedido, setEditingPedido] = useState<PedidoItem | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PedidoItem | null>(null);
  const [profileModal, setProfileModal] = useState<ProfileModalState | null>(null);
  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null);
  const [showOrderCreatedPushPrompt, setShowOrderCreatedPushPrompt] = useState(false);

  const { isSupported: isPushSupported, isSubscribed: isPushSubscribed } = usePushNotifications();

  const {
    pedidos,
    isLoading,
    proposals,
    proposalsLoading,
    linkedAppointment,
    createRequestMutation,
    updateMutation,
    deleteMutation,
    archiveMutation,
    acceptMutation,
    refuseMutation,
  } = usePedidosData({
    userId: user?.id,
    selectedPedidoId: selectedPedido?.id,
    isProposalsModalOpen,
  });

  const finalizedLeadIds = useMemo(
    () => pedidos.filter(p => p.status === 'finalizado').map(p => p.id),
    [pedidos],
  );

  const { data: reviewableMap } = useLeadReviewable(finalizedLeadIds, user?.id);

  const filteredPedidos = useMemo(() => pedidos.filter(p =>
    (statusFilter === 'todos' ||
      (statusFilter === 'Aberto' && (p.status === 'open' || p.status === 'aberto')) ||
      (statusFilter === 'Orçando' && p.status === 'orçando') ||
      (statusFilter === 'Finalizado' && p.status === 'finalizado') ||
      p.status === statusFilter) &&
    (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())),
  ), [pedidos, statusFilter, searchTerm]);

  const wizardInitialData: Partial<WizardData> | undefined = editingPedido ? {
    title: editingPedido.title,
    category: editingPedido.category,
    description: editingPedido.description,
    location: editingPedido.location,
    budget_min: String(editingPedido.budget_min ?? 0),
    budget_max: String(editingPedido.budget_max ?? 5000),
    images: editingPedido.images ?? [],
  } : undefined;

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPedido(null);
  };

  const openEditModal = (pedido: PedidoItem) => {
    setEditingPedido(pedido);
    setIsModalOpen(true);
    setContextMenuId(null);
  };

  const handleDelete = (pedido: PedidoItem) => {
    setContextMenuId(null);
    setDeleteConfirm(pedido);
  };

  const openProposals = (pedido: PedidoItem) => {
    setSelectedPedido(pedido);
    setIsProposalsModalOpen(true);
  };

  // Deep link vindo de notificação push (?purchaseId=) — resolve o pedido
  // (lead) dono dessa proposta e abre o modal de propostas automaticamente,
  // uma única vez. purchaseId é o id de lead_purchases, não de pedidos, por
  // isso precisa de uma consulta pra achar o lead_id correspondente.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const purchaseId = searchParams.get('purchaseId');
    if (!purchaseId || !pedidos.length) return;
    deepLinkHandledRef.current = true;
    void (async () => {
      const { data } = await supabase
        .from('lead_purchases').select('lead_id').eq('id', purchaseId).maybeSingle();
      const leadId = (data as { lead_id?: string } | null)?.lead_id;
      const pedido = leadId ? pedidos.find(p => p.id === leadId) : undefined;
      if (pedido) openProposals(pedido);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, searchParams]);

  const handleWizardSubmit = (wizardData: WizardData) => {
    const metadata: Record<string, string> = {
      urgency: wizardData.urgency,
      work_size: wizardData.work_size,
      availability: wizardData.availability,
      local_condition: wizardData.local_condition,
      purchase_decision: wizardData.purchase_decision,
    };

    if (editingPedido) {
      updateMutation.mutate(
        {
          id: editingPedido.id,
          updates: {
            title: wizardData.title,
            category: wizardData.category,
            description: wizardData.description,
            location: wizardData.location,
            budget_min: parseFloat(wizardData.budget_min) || 0,
            budget_max: parseFloat(wizardData.budget_max) || 0,
            images: wizardData.images,
            metadata,
          },
        },
        { onSuccess: closeModal },
      );
    } else {
      createRequestMutation.mutate(
        {
          title: wizardData.title,
          category: wizardData.category,
          description: wizardData.description,
          location: wizardData.location,
          budget_min: parseFloat(wizardData.budget_min) || 0,
          budget_max: parseFloat(wizardData.budget_max) || 0,
          images: wizardData.images,
          metadata,
        },
        {
          onSuccess: () => {
            closeModal();
            // Pergunta no momento que faz mais sentido: logo após criar o
            // pedido, quando o motivo ("saber quando um profissional
            // responder") é óbvio. Só se a pessoa ainda não decidiu sobre
            // notificação — ClientPushModal/PushFloatingBanner já fazem a
            // mesma checagem antes de aparecer, então não competem entre si.
            if (
              isPushSupported &&
              !isPushSubscribed &&
              typeof Notification !== 'undefined' &&
              Notification.permission === 'default'
            ) {
              setShowOrderCreatedPushPrompt(true);
            }
          },
        },
      );
    }
  };

  const isMutating = createRequestMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">Meus Pedidos</h1>
          <p className="text-[#94A3B8] font-medium">Gerencie e acompanhe suas solicitações de serviço em tempo real.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Novo Pedido
        </button>
      </div>

      <div className="relative group" style={{ marginBottom: 0 }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={20} />
        <input
          type="text"
          placeholder="Buscar um pedido específico..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-[#1C3454] border border-[#1C3050] rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
        />
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab === 'Todos' ? 'todos' : tab)}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.15s',
              border: (statusFilter === 'todos' && tab === 'Todos') || statusFilter === tab
                ? '1.5px solid #10b981'
                : '1.5px solid rgba(255,255,255,0.08)',
              background: (statusFilter === 'todos' && tab === 'Todos') || statusFilter === tab
                ? 'rgba(16,185,129,0.12)'
                : 'rgba(255,255,255,0.03)',
              color: (statusFilter === 'todos' && tab === 'Todos') || statusFilter === tab
                ? '#34d399'
                : '#7a9ebf',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner size={48} label="Sincronizando seus pedidos..." />
          </div>
        ) : (
          <div>
            {filteredPedidos.map(pedido => {
              const reviewable = reviewableMap?.[pedido.id];
              return (
              <PedidoCard
                key={pedido.id}
                pedido={pedido}
                contextMenuId={contextMenuId}
                onOpenProposals={openProposals}
                onOpenEdit={openEditModal}
                onDelete={handleDelete}
                onSetContextMenuId={setContextMenuId}
                onReview={
                  reviewable && !reviewable.hasReview
                    ? () => setReviewModal(reviewable)
                    : undefined
                }
              />
              );
            })}
            {filteredPedidos.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-9 grayscale opacity-40">
                <Inbox size={64} className="text-slate-600" />
                <div>
                  <p className="text-white font-black text-lg">Nenhum pedido encontrado</p>
                  <p className="text-[#4A6580] text-sm font-medium">Você ainda não possui solicitações ativas no momento.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setContextMenuId(null)} />
      )}

      {isProposalsModalOpen && selectedPedido && (
        <ProposalsModal
          pedido={selectedPedido}
          proposals={proposals}
          proposalsLoading={proposalsLoading}
          linkedAppointment={linkedAppointment}
          onClose={() => setIsProposalsModalOpen(false)}
          acceptMutation={acceptMutation}
          refuseMutation={refuseMutation}
          onOpenProfile={setProfileModal}
        />
      )}

      {isModalOpen && (
        <RequestWizard
          onSubmit={handleWizardSubmit}
          onClose={closeModal}
          isPending={isMutating}
          isUploading={false}
          onImageUpload={() => undefined}
          initialData={wizardInitialData}
        />
      )}

      {profileModal && (
        <ProfessionalProfileModal
          userId={profileModal.userId}
          name={profileModal.name}
          avatar={profileModal.avatar}
          onClose={() => setProfileModal(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          pedido={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={id => {
            if ((deleteConfirm.purchases_count ?? 0) > 0) {
              archiveMutation.mutate(id);
            } else {
              deleteMutation.mutate(id);
            }
            setDeleteConfirm(null);
          }}
        />
      )}

      {reviewModal && user && (
        <ReviewModal
          appointmentId={reviewModal.appointmentId}
          professionalId={reviewModal.professionalId}
          clientId={user.id}
          professionalName={reviewModal.professionalName}
          onClose={() => setReviewModal(null)}
        />
      )}

      {showOrderCreatedPushPrompt && (
        <OrderCreatedPushPrompt onDismiss={() => setShowOrderCreatedPushPrompt(false)} />
      )}
    </div>
  );
}
