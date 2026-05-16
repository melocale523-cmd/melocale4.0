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
  images?: unknown;
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
      .select('*');

    if (error) {
      const fallback = await supabase.from('leads').select('*');
      return (fallback.data || []).filter((l: LeadStatusRow) => l.status === 'open');
    }
    return data || [];
  },

  async purchaseLead(leadId: string): Promise<PurchaseLeadResult> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(leadId)) throw new Error(`Invalid lead UUID: ${leadId}`);

    const idempotencyKey = crypto.randomUUID();
    const { data, error } = await supabase.rpc('purchase_lead', {
      p_lead_id: leadId,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
    if (!data) throw new Error('purchase_lead returned no data');

    // A: lead com ≥1 compra ativa → status = 'orçando'
    try {
      const { error: statusErr } = await supabase
        .from('leads').update({ status: 'orçando' }).eq('id', leadId);
      if (statusErr) console.error('[notif] status update error', statusErr.message);
    } catch (err) {
      console.error('[notif] status update exception', err);
    }

    // E: notifica o cliente que há novo interesse no pedido
    try {
      const { data: lead, error: leadErr } = await supabase
        .from('leads').select('client_id').eq('id', leadId).single();
      if (leadErr || !lead?.client_id) {
        if (leadErr) console.error('[notif] lead fetch error', leadErr.message);
      } else {
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: lead.client_id,
          title: 'Novo interesse no seu pedido!',
          body: 'Um profissional tem interesse no seu pedido. Acesse para ver.',
          data: { lead_id: leadId, type: 'new_interest' },
          is_read: false,
        });
        if (notifErr) console.error('[notif] insert error', notifErr.message);
        void apiFetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: lead.client_id, title: 'Novo interesse no seu pedido!', body: 'Um profissional tem interesse no seu pedido. Acesse para ver.', data: { lead_id: leadId, type: 'new_interest' } }),
        });
      }
    } catch (err) {
      console.error('[notif] notification exception', err);
    }

    return data as PurchaseLeadResult;
  },

  async getMyPurchases() {
    try {
      const { data, error } = await supabase
        .from('v_my_purchases')
        .select('*')
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
      }));
    } catch {
      return [];
    }
  },

  async createRequest(request: { title: string, description: string, category: string, location: string, budget_min: number, budget_max: number, images?: string[], metadata?: Record<string, string> }) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Sessão expirada. Faça login novamente.");

    const payload = {
      ...request,
      client_id: user.id,
      status: 'open',
      price_coins: 10,
      max_purchases: 5,
      purchases_count: 0,
      metadata: request.metadata ?? {},
      visualizacoes: 0,
    };

    const { data, error } = await supabase
      .from('leads')
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async updateRequest(id: string, updates: { title: string; description: string; category: string; location: string; budget_min: number; budget_max: number; images?: string[]; metadata?: Record<string, string> }) {
    const { error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteRequest(id: string) {
    const { error } = await supabase
      .from('leads')
      .update({ status: 'arquivado' })
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
      const _title = 'Nova proposta recebida! 🎉';
      const _body = `Um profissional enviou um orçamento de R$ ${proposal.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Acesse Meus Pedidos para ver.`;
      const _data = { type: 'proposal_received', purchaseId };
      await supabase.from('notifications').insert({
        user_id: purchase.client_id,
        title: _title,
        body: _body,
        data: _data,
      });
      void apiFetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: purchase.client_id, title: _title, body: _body, data: _data }),
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

    const { data: professionals } = professionalIds.length
      ? await supabase.from('professionals').select('id, user_id').in('id', professionalIds)
      : { data: [] };

    const profMap = Object.fromEntries((professionals || []).map(p => [p.id, p.user_id]));
    const userIds = Object.values(profMap).filter(Boolean);

    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
      : { data: [] };

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    return (data || []).map(p => ({
      ...p,
      profiles: profileMap[profMap[p.professional_id]] || null,
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

  async respondProposal(proposalId: string, purchaseId: string, status: 'Aceita' | 'Recusada') {
    const { error } = await supabase
      .from('lead_purchases')
      .update({ status })
      .eq('id', purchaseId);

    if (error) throw error;

    if (status === 'Aceita') {
      const { data: purchase } = await supabase
        .from('lead_purchases')
        .select('professional_id, client_id, lead_id, chat_id')
        .eq('id', purchaseId)
        .single();

      if (purchase) {
        const { data: prof } = await supabase
          .from('professionals')
          .select('user_id')
          .eq('id', purchase.professional_id)
          .single();
        const profAuthId = prof?.user_id ?? purchase.professional_id;
        // professionals.id (FK for conversations) vs auth UUID (for notifications)
        const profTableId = purchase.professional_id;

        let chatId: string | null = purchase.chat_id ?? null;

        if (!chatId) {
          const leadId = purchase.lead_id ?? null;

          const selQ = supabase.from('conversations').select('id').eq('professional_id', profTableId);
          const { data: existing } = await (leadId
            ? selQ.eq('lead_id', leadId)
            : selQ.is('lead_id', null)
          ).maybeSingle();

          if (existing?.id) {
            chatId = existing.id;
          } else {
            const { data: conv, error: insertErr } = await supabase
              .from('conversations')
              .insert({ professional_id: profTableId, client_id: purchase.client_id, lead_id: leadId })
              .select('id').single();
            if (insertErr) {
              const retryQ = supabase.from('conversations').select('id').eq('professional_id', profTableId);
              const { data: retry } = await (leadId
                ? retryQ.eq('lead_id', leadId)
                : retryQ.is('lead_id', null)
              ).maybeSingle();
              chatId = retry?.id ?? null;
            } else {
              chatId = conv?.id ?? null;
            }
          }

          if (chatId) {
            await supabase
              .from('lead_purchases')
              .update({ chat_id: chatId })
              .eq('id', purchaseId);
          }
        }

        const _paTitle = 'Interesse confirmado! 🎉';
        const _paBody = 'Um cliente aceitou sua proposta. Abra o chat para iniciar o serviço.';
        const _paData = { type: 'proposal_accepted', purchaseId, chatId };
        await supabase.from('notifications').insert({
          user_id: profAuthId,
          title: _paTitle,
          body: _paBody,
          data: _paData,
        });
        void apiFetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: profAuthId, title: _paTitle, body: _paBody, data: _paData }),
        });
      }
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

    const selQ = supabase.from('conversations').select('id').eq('professional_id', rawProfId);
    const { data: existing } = await (leadId
      ? selQ.eq('lead_id', leadId)
      : selQ.is('lead_id', null)
    ).maybeSingle();

    if (existing?.id) {
      await supabase.from('lead_purchases')
        .update({ chat_id: existing.id }).eq('id', purchaseId);
      return existing.id;
    }

    const { data: conv, error: insertErr } = await supabase
      .from('conversations')
      .insert({ professional_id: rawProfId, client_id: clientId, lead_id: leadId ?? null })
      .select('id').single();

    let finalId = conv?.id ?? null;
    if (insertErr) {
      const retryQ = supabase.from('conversations').select('id').eq('professional_id', rawProfId);
      const { data: retry } = await (leadId
        ? retryQ.eq('lead_id', leadId)
        : retryQ.is('lead_id', null)
      ).maybeSingle();
      finalId = retry?.id ?? null;
    }

    if (finalId) {
      await supabase.from('lead_purchases')
        .update({ chat_id: finalId }).eq('id', purchaseId);
      return finalId;
    }

    return null;
  }
};
