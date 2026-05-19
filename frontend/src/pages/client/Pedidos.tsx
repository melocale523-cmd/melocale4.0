import { useState, useMemo } from 'react';
import { Plus, Search, Inbox, FileText } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import RequestWizard, { type WizardData } from '../../components/RequestWizard';
import { cn } from '../../lib/utils';
import { usePedidosData, type PedidoItem } from '../../hooks/usePedidosData';
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

export default function Pedidos() {
  const { user } = useAuthStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoItem | null>(null);
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [editingPedido, setEditingPedido] = useState<PedidoItem | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PedidoItem | null>(null);
  const [profileModal, setProfileModal] = useState<ProfileModalState | null>(null);

  const {
    pedidos,
    isLoading,
    proposals,
    proposalsLoading,
    linkedAppointment,
    createRequestMutation,
    updateMutation,
    deleteMutation,
    acceptMutation,
    refuseMutation,
  } = usePedidosData({
    userId: user?.id,
    selectedPedidoId: selectedPedido?.id,
    isProposalsModalOpen,
  });

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
        { onSuccess: closeModal },
      );
    }
  };

  const isMutating = createRequestMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Meus Pedidos</h1>
          <p className="text-[#94A3B8] font-medium">Gerencie e acompanhe suas solicitações de serviço em tempo real.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Novo Pedido
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar um pedido específico..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#1C3454] border border-[#1C3050] rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab === 'Todos' ? 'todos' : tab)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all',
                (statusFilter === 'todos' && tab === 'Todos') || statusFilter === tab
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-[#1C3454] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1C3454] border border-[#1C3050] rounded-[2.5rem] overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner size={48} label="Sincronizando seus pedidos..." />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredPedidos.map(pedido => (
              <PedidoCard
                key={pedido.id}
                pedido={pedido}
                contextMenuId={contextMenuId}
                onOpenProposals={openProposals}
                onOpenEdit={openEditModal}
                onDelete={handleDelete}
                onSetContextMenuId={setContextMenuId}
              />
            ))}
            {filteredPedidos.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-4 grayscale opacity-40">
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
            deleteMutation.mutate(id);
            setDeleteConfirm(null);
          }}
        />
      )}
    </div>
  );
}
