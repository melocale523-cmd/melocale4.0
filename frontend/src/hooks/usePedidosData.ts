import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { leadService, proposalService } from '../services/dbServices';
import { toast } from 'sonner';

export interface PedidoItem {
  id: string;
  title: string;
  category: string;
  description: string;
  location: string;
  budget_min: number;
  budget_max: number;
  status: string;
  created_at: string;
  interested_count?: number;
  purchases_count?: number;
  images?: string[];
}

export interface Proposal {
  id: string;
  professional_id: string;
  chat_id: string | null;
  price: number;
  duration: string;
  description: string;
  status: string;
  created_at: string;
  user_id: string;
  client_id: string;
  profiles: { id: string; full_name: string | null; avatar_url: string | null } | null;
  avg_rating: number | null;
  reviews_count: number;
}

interface UpdateRequestPayload {
  id: string;
  updates: {
    title: string;
    description: string;
    category: string;
    location: string;
    budget_min: number;
    budget_max: number;
    images?: string[];
    metadata?: Record<string, string>;
  };
}

interface UsePedidosDataParams {
  userId: string | undefined;
  selectedPedidoId: string | undefined;
  isProposalsModalOpen: boolean;
}

export function usePedidosData({ userId, selectedPedidoId, isProposalsModalOpen }: UsePedidosDataParams) {
  const queryClient = useQueryClient();

  const { data: pedidosRaw, isLoading } = useQuery({
    queryKey: ['pedidos', userId],
    queryFn: leadService.getMyRequests,
    enabled: !!userId,
  });

  const { data: proposalsRaw, isLoading: proposalsLoading } = useQuery({
    queryKey: ['proposals', userId, selectedPedidoId],
    queryFn: () => proposalService.getProposalsForLead(selectedPedidoId!),
    enabled: !!selectedPedidoId && isProposalsModalOpen,
  });

  const { data: linkedAppointment } = useQuery({
    queryKey: ['lead_appointment', userId, selectedPedidoId],
    queryFn: async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', selectedPedidoId!);
      if (!convs?.length) return null;
      const { data } = await supabase
        .from('appointments')
        .select('scheduled_at')
        .in('conversation_id', convs.map((c: { id: string }) => c.id))
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!selectedPedidoId && isProposalsModalOpen,
  });

  const createRequestMutation = useMutation({
    mutationFn: leadService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['clientSummary'] });
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      if (error.message.includes('Sessão expirada')) {
        supabase.auth.signOut();
        toast.error('Sua sessão expirou. Faça login novamente.');
      } else {
        toast.error(`Erro ao criar pedido: ${error.message}`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: UpdateRequestPayload) =>
      leadService.updateRequest(id, updates as Parameters<typeof leadService.updateRequest>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar pedido: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.deleteRequest(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['pedidos', userId], (old: unknown) =>
        Array.isArray(old) ? old.filter((p: { id: string }) => p.id !== id) : old);
      queryClient.invalidateQueries({ queryKey: ['pedidos', userId] });
      toast.success('Pedido excluído.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => leadService.archiveRequest(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['pedidos', userId], (old: unknown) =>
        Array.isArray(old) ? old.filter((p: { id: string }) => p.id !== id) : old);
      queryClient.invalidateQueries({ queryKey: ['pedidos', userId] });
      toast.success('Pedido arquivado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ purchaseId }: { purchaseId: string }) =>
      proposalService.respondProposal('', purchaseId, 'Aceita'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', userId, selectedPedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Interesse enviado! O profissional já pode ver seus dados de contato.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refuseMutation = useMutation({
    mutationFn: ({ purchaseId }: { purchaseId: string }) =>
      proposalService.respondProposal('', purchaseId, 'Recusada'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', userId, selectedPedidoId] });
      toast.success('Proposta recusada.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    pedidos: (pedidosRaw as PedidoItem[]) ?? [],
    isLoading,
    proposals: (proposalsRaw as Proposal[]) ?? [],
    proposalsLoading,
    linkedAppointment: linkedAppointment as { scheduled_at: string } | null | undefined,
    createRequestMutation,
    updateMutation,
    deleteMutation,
    archiveMutation,
    acceptMutation,
    refuseMutation,
  };
}
