import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../lib/api';

interface LeadStatusRow { status: string }

interface PurchaseStatsRow {
  id: string;
  price_coins?: number | null;
  price?: number | null;
  status: string;
  created_at: string;
}

interface PurchaseViewRow {
  id: string;
  lead_id: string;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  max_purchases?: number | null;
  purchases_count?: number | null;
  location?: string | null;
  images?: string[] | null;
  chat_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  event_date?: string | null;
  lead_status?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_city?: string | null;
  profiles?: { phone?: string | null; email?: string | null; address?: string | null } | null;
  [key: string]: unknown;
}

interface ClientLeadRow {
  interested_count?: number | null;
  purchases_count?: number | null;
  [key: string]: unknown;
}

interface PurchaseLeadResult {
  success: boolean;
  lead_purchase_id: string;
}

export const leadService = {
  async getAvailableLeads() {
    const { data, error } = await supabase
      .from('v_available_leads')
      .select('id,title,description,category,location,city,budget_min,budget_max,price_coins,images,event_date,expires_at,created_at,max_purchases,purchases_count');

    if (error) {
      if (import.meta.env.DEV) console.error('[getAvailableLeads] view error:', error.message);
      return [];
    }
    return data || [];
  },

  async purchaseLead(leadId: string, idempotencyKey: string): Promise<PurchaseLeadResult> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(leadId)) throw new Error(`Invalid lead UUID: ${leadId}`);
    if (!UUID_RE.test(idempotencyKey)) throw new Error(`Invalid idempotencyKey UUID: ${idempotencyKey}`);
    const { data, error } = await supabase.rpc('purchase_lead', {
      p_lead_id: leadId,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
    if (!data) throw new Error('purchase_lead returned no data');

    void apiFetch('/api/notifications/send-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'lead_purchased', resource_id: leadId }),
    });

    return data as PurchaseLeadResult;
  },

  async getMyPurchases() {
    try {
      const { data, error } = await supabase
        .from('v_my_purchases')
        .select('id,lead_id,status,created_at,expires_at,max_purchases,purchases_count,location,images,title,description,category,city,state,budget_min,budget_max,event_date,lead_status,client_id,client_name,client_email,client_phone,client_city')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map((row: PurchaseViewRow) => ({
        ...row,
        leads: {
          id: row.lead_id, title: row.title, description: row.description,
          category: row.category, city: row.city, state: row.state,
          budget_min: row.budget_min, budget_max: row.budget_max,
          event_date: row.event_date, status: row.lead_status,
          location: row.location ?? null,
          profiles: row.profiles ?? null,
          clients: {
            id: row.client_id, full_name: row.client_name,
            email: row.client_email, phone: row.client_phone, city: row.client_city,
          },
        },
      }));
    } catch {
      return [];
    }
  },

  async getMyRequests() {
    try {
      const { data, error } = await supabase
        .from('v_client_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data ?? []).map((row: ClientLeadRow) => ({
        ...row,
        interested_count: row.interested_count ?? row.purchases_count ?? 0,
        purchases_count: row.purchases_count ?? 0,
      }));
    } catch {
      return [];
    }
  },

  async createRequest(request: { title: string, description: string, category: string, location: string, budget_min: number, budget_max: number, images?: string[], metadata?: Record<string, string> }) {
    // price_coins é calculado no backend com base em budget_max e metadata.urgency.
    // Nunca enviamos price_coins do frontend — o servidor ignora qualquer valor enviado.
    const response = await apiFetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:       request.title,
        category:    request.category,
        description: request.description,
        location:    request.location,
        budget_min:  request.budget_min,
        budget_max:  request.budget_max,
        images:      request.images ?? [],
        metadata:    request.metadata ?? {},
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Erro ao criar pedido');
    }
    return response.json();
  },

  async updateRequest(id: string, updates: { title?: string; description?: string; images?: string[]; metadata?: Record<string, string> }) {
    const response = await apiFetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Erro ao atualizar pedido');
    }
  },

  async archiveRequest(id: string) {
    const { error } = await supabase
      .from('leads')
      .update({ status: 'arquivado' })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteRequest(id: string) {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getClientSummary() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { waiting: 0, in_progress: 0, orcando: 0, finalizado: 0 };

      const { data: requests, error } = await supabase
        .from('leads')
        .select('status')
        .eq('client_id', user.id);

      if (error) return { waiting: 0, in_progress: 0, orcando: 0, finalizado: 0 };

      const userRequests = requests || [];

      return {
        waiting: userRequests.filter((r: LeadStatusRow) => r.status === 'open' || r.status === 'aberto').length,
        in_progress: userRequests.filter((r: LeadStatusRow) => r.status === 'orçando').length,
        orcando: userRequests.filter((r: LeadStatusRow) => r.status === 'orçando').length,
        finalizado: userRequests.filter((r: LeadStatusRow) => r.status === 'finalizado').length,
      };
    } catch {
      return { waiting: 0, in_progress: 0, orcando: 0, finalizado: 0 };
    }
  },

  async getProfessionalStats(range: '7d' | '30d' | '90d' | '1y' = '30d') {
    const professionalId = useAuthStore.getState().user?.professionalId;
    const userId = useAuthStore.getState().user?.id;
    if (!professionalId || !userId) throw new Error("Professional ID not found");

    const now = new Date();
    let startDate = new Date();
    if (range === '7d') startDate.setDate(now.getDate() - 7);
    else if (range === '30d') startDate.setDate(now.getDate() - 30);
    else if (range === '90d') startDate.setDate(now.getDate() - 90);
    else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);

    let purchasesData: PurchaseStatsRow[] = [];
    try {
      const { data, error } = await supabase
        .from('lead_purchases')
        .select('id, price_coins, price, status, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
      if (!error && data) purchasesData = data;
    } catch {}

    const proposalsData = purchasesData.filter((p) =>
      p.status === 'Proposta Enviada' || p.status === 'Aceita' || p.status === 'Recusada'
    );
    const acceptedProposals = proposalsData.filter((p) => p.status === 'Aceita');
    const totalRevenue = acceptedProposals.reduce((acc: number, p) => acc + (p.price || 0), 0);

    const dateMap = new Map();
    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dateMap.set(key, { name: key, total: 0, aceitas: 0, recusadas: 0, revenue: 0 });
      }
      purchasesData.forEach((p) => {
        const key = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.total += 1;
          if (p.status === 'Aceita') { entry.aceitas += 1; entry.revenue += (p.price || 0); }
          else if (p.status === 'Recusada') { entry.recusadas += 1; }
        }
      });
    } else {
      const months = range === '90d' ? 3 : 12;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const key = d.toLocaleDateString('pt-BR', { month: 'short' });
        dateMap.set(key, { name: key, total: 0, aceitas: 0, recusadas: 0, revenue: 0 });
      }
      purchasesData.forEach((p) => {
        const key = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short' });
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.total += 1;
          if (p.status === 'Aceita') { entry.aceitas += 1; entry.revenue += (p.price || 0); }
        }
      });
    }

    return {
      totalSpentCoins: purchasesData.reduce((acc: number, p) => acc + (p.price_coins || 0), 0),
      contactsPurchased: purchasesData.length,
      visualizacoes: purchasesData.length,
      totalProposals: proposalsData.length,
      acceptedProposalsCount: acceptedProposals.length,
      totalRevenue,
      seriesData: Array.from(dateMap.values()),
    };
  }
};

export const proposalService = {
  async sendProposal(purchaseId: string, proposal: { price: number, duration: string, description: string }) {
    const { data: purchase, error } = await supabase
      .from('lead_purchases')
      .update({
        price: proposal.price,
        duration: proposal.duration,
        description: proposal.description,
        status: 'Proposta Enviada',
      })
      .eq('id', purchaseId)
      .select('client_id')
      .single();

    if (error) throw error;

    if (purchase?.client_id) {
      void apiFetch('/api/notifications/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'proposal_sent', resource_id: purchaseId }),
      });
    }

    return true;
  },

  async getProposalsForLead(leadId: string) {
    const { data, error } = await supabase
      .from('lead_purchases')
      .select('id, professional_id, chat_id, price, duration, description, status, created_at, user_id, client_id')
      .eq('lead_id', leadId)
      .not('status', 'eq', 'Aberto')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const professionalIds = (data || []).map(p => p.professional_id).filter(Boolean);

    const [profRes, reviewsRes] = await Promise.all([
      professionalIds.length
        ? supabase.from('professionals').select('id, user_id').in('id', professionalIds)
        : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
      professionalIds.length
        ? supabase.from('reviews').select('professional_id, rating').in('professional_id', professionalIds)
        : Promise.resolve({ data: [] as { professional_id: string; rating: number }[] }),
    ]);

    const profMap = Object.fromEntries((profRes.data || []).map(p => [p.id, p.user_id]));
    const userIds = Object.values(profMap).filter(Boolean);

    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
      : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    // Aggregate avg rating per professional_id from reviews
    const ratingMap: Record<string, { avg: number; total: number }> = {};
    for (const r of reviewsRes.data || []) {
      if (!ratingMap[r.professional_id]) ratingMap[r.professional_id] = { avg: 0, total: 0 };
      ratingMap[r.professional_id].total += 1;
      ratingMap[r.professional_id].avg += r.rating;
    }
    for (const id of Object.keys(ratingMap)) {
      ratingMap[id].avg = ratingMap[id].avg / ratingMap[id].total;
    }

    return (data || []).map(p => ({
      ...p,
      profiles: profileMap[profMap[p.professional_id]] || null,
      avg_rating: ratingMap[p.professional_id]?.avg ?? null,
      reviews_count: ratingMap[p.professional_id]?.total ?? 0,
    }));
  },

  async getProposalByPurchase(purchaseId: string) {
    const { data, error } = await supabase
      .from('lead_purchases')
      .select('id, price, duration, description, status')
      .eq('id', purchaseId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async respondProposal(_proposalId: string, purchaseId: string, status: 'Aceita' | 'Recusada') {
    const action = status === 'Aceita' ? 'accept' : 'reject';

    const { data, error } = await supabase.rpc('respond_proposal', {
      p_purchase_id: purchaseId,
      p_action: action,
    });

    if (error) throw error;

    if (!data?.success) {
      const code = data?.error as string | undefined;
      const messages: Record<string, string> = {
        purchase_not_found: 'Proposta não encontrada.',
        invalid_status: 'Esta proposta não pode ser respondida no estado atual.',
        conversation_creation_failed: 'Erro ao criar conversa. Tente novamente.',
      };
      throw new Error(messages[code ?? ''] ?? 'Erro ao responder proposta.');
    }

    if (action === 'accept') {
      void apiFetch('/api/notifications/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'proposal_accepted', resource_id: purchaseId }),
      });
    }

    return true;
  },

  async ensureChatForPurchase(purchaseId: string): Promise<string | null> {
    const { data: lp } = await supabase
      .from('lead_purchases')
      .select('chat_id, lead_id, client_id, professional_id')
      .eq('id', purchaseId)
      .single();

    if (!lp) return null;
    if (lp.chat_id) return lp.chat_id;

    // rawProfId is professionals.id — the correct FK for conversations.professional_id
    const { professional_id: rawProfId, client_id: clientId, lead_id: leadId } = lp;

    const { data: conv } = await supabase
      .from('conversations')
      .upsert(
        { professional_id: rawProfId, client_id: clientId, lead_id: leadId ?? null },
        { onConflict: 'professional_id,lead_id', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    const finalId = conv?.id ?? null;
    if (finalId) {
      await supabase.from('lead_purchases')
        .update({ chat_id: finalId }).eq('id', purchaseId);
      return finalId;
    }

    return null;
  }
};
