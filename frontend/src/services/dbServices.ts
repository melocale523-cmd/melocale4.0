import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { logService } from '../lib/logService';

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

interface ProfileRow {
  id: string;
  status?: string | null;
  role?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

interface WalletTxRow {
  id: string;
  kind: string;
  amount: number;
  reference?: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface VConversationRow {
  id: string;
  client_id?: string | null;
  professional_id?: string | null;
  professional_user_id?: string | null;
  lead_id?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  unread_for_prof?: number | null;
  unread_for_client?: number | null;
  last_message?: string | null;
  prof_full_name?: string | null;
  prof_avatar_url?: string | null;
  client_full_name?: string | null;
  client_avatar_url?: string | null;
}

// === Wallet Functions ===
export const walletService = {
  async getBalance() {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return 0;

      const { data, error } = await supabase
        .from('v_wallet_balance')
        .select('balance_coins')
        .eq('user_id', userId)
        .single();
      
      if (error || !data) return 0;
      
      return data.balance_coins || 0;
    } catch {
      return 0;
    }
  }
};

interface PurchaseLeadResult {
  success: boolean;
  lead_purchase_id: string;
}

// === Leads and Purchases ===
export const leadService = {
  async getAvailableLeads() {
    const { data, error } = await supabase
      .from('v_available_leads')
      .select('*');
      
    if (error) {
      // Fallback
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
    void supabase.from('leads').update({ status: 'orçando' }).eq('id', leadId);

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
      return (data ?? []).map((row: any) => ({
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
      status: 'open'
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
      if (!user) return { waiting: 0, in_progress: 0 };

      const { data: requests, error } = await supabase
        .from('leads')
        .select('status')
        .eq('client_id', user.id);

      if (error) return { waiting: 0, in_progress: 0 };

      const userRequests = requests || [];

      return {
        waiting: userRequests.filter((r: LeadStatusRow) => r.status === 'open' || r.status === 'Orçando').length,
        in_progress: userRequests.filter((r: LeadStatusRow) => r.status === 'in_progress' || r.status === 'Em Andamento').length
      };
    } catch {
      return { waiting: 0, in_progress: 0 };
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

    // Busca compras do profissional no período — filtradas no banco
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

    // Propostas = lead_purchases com status relevante
    const proposalsData = purchasesData.filter((p) =>
      p.status === 'Proposta Enviada' || p.status === 'Aceita' || p.status === 'Recusada'
    );
    const acceptedProposals = proposalsData.filter((p) => p.status === 'Aceita');
    const totalRevenue = acceptedProposals.reduce((acc: number, p) => acc + (p.price || 0), 0);

    // Monta série temporal
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

function formatWalletDescription(kind: string, reference?: string | null): string {
  if (reference?.startsWith('lead_purchase:') || kind === 'debit_lead') return 'Compra de Lead';
  if (kind === 'bonus') return 'Bônus de boas-vindas';
  if (kind === 'subscription') return 'Assinatura';
  if (kind === 'purchase' || kind === 'credit_purchase') return 'Compra de moedas';
  return kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' ');
}

// === Transactions ===
export const transactionService = {
  async getWalletTransactions() {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map DB columns (kind, reference) to what Wallet.tsx expects (type, description)
    return (data ?? []).map((tx: WalletTxRow) => ({
      ...tx,
      type: tx.kind === 'credit_purchase' || tx.kind === 'deposit' || tx.kind === 'bonus' || tx.kind === 'subscription' ? 'deposit' : 'purchase',
      description: formatWalletDescription(tx.kind, tx.reference),
    }));
  }
};

// === Proposals ===
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
      await supabase.from('notifications').insert({
        user_id: purchase.client_id,
        title: 'Nova proposta recebida! 🎉',
        body: `Um profissional enviou um orçamento de R$ ${proposal.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Acesse Meus Pedidos para ver.`,
        data: { type: 'proposal_received', purchaseId },
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

        await supabase.from('notifications').insert({
          user_id: profAuthId,
          title: 'Interesse confirmado! 🎉',
          body: 'Um cliente aceitou sua proposta. Abra o chat para iniciar o serviço.',
          data: { type: 'proposal_accepted', purchaseId, chatId },
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

interface MessageRow {
  conversation_id: string;
  sender_type: string;
  created_at: string;
}

async function calcAvgResponseTime(): Promise<string> {
  const { data } = await supabase
    .from('messages')
    .select('conversation_id, sender_type, created_at')
    .order('created_at', { ascending: true })
    .limit(500);

  if (!data || data.length === 0) return '—';

  const byConv: Record<string, MessageRow[]> = {};
  (data as MessageRow[]).forEach(m => {
    if (!byConv[m.conversation_id]) byConv[m.conversation_id] = [];
    byConv[m.conversation_id].push(m);
  });

  const times: number[] = [];
  Object.values(byConv).forEach(msgs => {
    const clientMsg = msgs.find(m => m.sender_type === 'client');
    if (!clientMsg) return;
    const profMsg = msgs.find(m => m.sender_type === 'professional' && m.created_at > clientMsg.created_at);
    if (!profMsg) return;
    const diff = (new Date(profMsg.created_at).getTime() - new Date(clientMsg.created_at).getTime()) / 60000;
    if (diff > 0 && diff < 1440) times.push(diff);
  });

  if (times.length === 0) return '—';
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  if (avg < 60) return `${Math.round(avg)}m`;
  return `${Math.floor(avg / 60)}h ${Math.round(avg % 60)}m`;
}

// === Admin ===
export const adminService = {
  async getDashboardSummary() {
    let usersCount = 0, pendingCount = 0, activeLeadsCount = 0, pendingDisputesCount = 0, totalRevenue = 0;
    let avgResponseTime = '—';
    try {
      const [profsRes, leadsRes, disputesRes, purchasesRes, avgTime] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('leads').select('*'),
        supabase.from('disputes').select('*'),
        supabase
          .from('lead_purchases')
          .select('price')
          .not('price', 'is', null)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        calcAvgResponseTime(),
      ]);

      if (profsRes.data) {
        usersCount = profsRes.data.length;
        pendingCount = (profsRes.data as ProfileRow[]).filter((p) => p.status === 'pending').length;
      }
      if (leadsRes.data) {
        activeLeadsCount = (leadsRes.data as LeadStatusRow[]).filter((l) => l.status === 'open').length;
      }
      if (disputesRes.data) {
        pendingDisputesCount = (disputesRes.data as LeadStatusRow[]).filter((d) => d.status === 'pending').length;
      }
      if (purchasesRes.data) {
        totalRevenue = (purchasesRes.data as { price: number | null }[]).reduce((acc, p) => acc + Number(p.price ?? 0), 0);
      }
      avgResponseTime = avgTime;
    } catch {}

    return {
      totalUsers: usersCount || 0,
      activeLeads: activeLeadsCount || 0,
      estimatedRevenue: totalRevenue,
      pendingVerifications: pendingCount || 0,
      avgResponseTime,
      pendingDisputes: pendingDisputesCount || 0
    };
  },

  async getUsers(params?: { role?: string, status?: string }) {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) return [];
      
      return (data as ProfileRow[] || [])
        .filter((user) => (!params?.role || user.role === params.role) && (!params?.status || user.status === params.status))
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } catch {
      return [];
    }
  },

  async updateUserStatus(userId: string, status: string) {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
    if (error) throw error;
    return true;
  },

  async getCoinPackages() {
    try {
      const { data, error } = await supabase.from('coin_packages').select('*');
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
  
  async updateCoinPackage(id: string, updates: Record<string, unknown>) {
    const { error } = await supabase.from('coin_packages').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  },

  async getObservabilityMetrics() {
    const [convRes, msgRes, purchaseRes, notifRes] = await Promise.all([
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('lead_purchases').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
    ]);
    return {
      conversations: convRes.count ?? 0,
      messages: msgRes.count ?? 0,
      purchases: purchaseRes.count ?? 0,
      notifications: notifRes.count ?? 0,
    };
  }
};

// === Chats ===
export const chatService = {
  async getChats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('v_conversations')
      .select('*')
      .or(`client_id.eq.${user.id},professional_user_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    const mapped = (data ?? []).map((conv: VConversationRow) => ({
      id: conv.id,
      client_id: conv.client_id,
      professional_id: conv.professional_id,
      professional_user_id: conv.professional_user_id,
      lead_id: conv.lead_id,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
      unread_for_prof: conv.unread_for_prof,
      last_message: conv.last_message ?? null,
      unread_client: conv.unread_for_client ?? 0,
      prof_user_id: conv.professional_user_id ?? null,
      prof_profile: conv.prof_full_name || conv.prof_avatar_url
        ? { full_name: conv.prof_full_name ?? null, avatar_url: conv.prof_avatar_url ?? null }
        : null,
      client_profile: {
        full_name: conv.client_full_name ?? null,
        avatar_url: conv.client_avatar_url ?? null,
      },
      leadTitle: null as string | null,
    }));

    // Enrich with lead titles in a single batch query
    const leadIds = [...new Set(mapped.map(c => c.lead_id).filter((id): id is string => !!id))];
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, title')
        .in('id', leadIds);
      if (leads) {
        const leadMap = Object.fromEntries(
          (leads as { id: string; title: string | null }[]).map(l => [l.id, l.title])
        );
        mapped.forEach(c => { c.leadTitle = c.lead_id ? (leadMap[c.lead_id] ?? null) : null; });
      }
    }

    return mapped;
  },

  async uploadChatFile(conversationId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `chats/${conversationId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path);
    return publicUrl;
  },

  async getMessages(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async sendMessage(conversationId: string, text: string, type: string = 'text', fileName?: string, recipientId?: string) {
    const { data: { user } } = await supabase.auth.getUser();

    let senderType = 'user';
    if (user) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('client_id, professional_user_id')
        .eq('id', conversationId)
        .single();
      if (conv?.client_id === user.id) {
        senderType = 'client';
      } else if (conv?.professional_user_id === user.id) {
        senderType = 'professional';
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        body: text,
        sender_type: senderType,
        attachments: type !== 'text' ? [{ type, fileName, url: text }] : [],
      })
      .select('*')
      .single();
    if (error) throw error;

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (recipientId && user && recipientId !== user.id) {
      try {
        const notifBody = type === 'text'
          ? (text.length > 50 ? text.substring(0, 47) + '...' : text)
          : type === 'image' ? '📷 Foto'
          : type === 'audio' ? '🎤 Áudio'
          : `📎 ${fileName || 'Arquivo'}`;
        await supabase.from('notifications').insert({
          user_id: recipientId,
          title: 'Nova Mensagem',
          body: notifBody,
          data: { conversationId, type: 'message' },
        });
      } catch {}
    }
    return data;
  },

  async deleteChat(conversationId: string) {
    const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
    if (error) throw error;
    return true;
  }
};

// === Profile (professional) ===
export const profileService = {
  async saveProfile(userId: string, data: {
    name: string;
    phone: string;
    bio: string;
    category: string;
    serviceRadius: string;
  }) {
    const payload = {
      p_user_id: userId,
      p_full_name: data.name,
      p_phone: data.phone,
      p_bio: data.bio || null,
      p_category: data.category || null,
      p_service_radius: data.serviceRadius ? Number(data.serviceRadius) : null,
    };
    logService.info('profileService', 'saving profile via save_full_profile RPC', payload);
    const { error } = await supabase.rpc('save_full_profile', payload);
    if (error) {
      logService.error('profileService', 'save_full_profile RPC failed', error);
      throw new Error('Erro ao salvar dados. Tente novamente.');
    }
    logService.info('profileService', 'profile saved successfully');
    return true;
  },
};

// === Profile (client) ===
export const clientProfileService = {
  async saveProfile(userId: string, data: { name: string; phone: string; city: string; cep?: string }) {
    const payload: Record<string, unknown> = { id: userId, full_name: data.name, phone: data.phone, city: data.city };
    if (data.cep !== undefined) payload.cep = data.cep;
    logService.info('clientProfileService', 'saving profile', payload);
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      logService.error('clientProfileService', 'profiles upsert failed', error);
      throw new Error('Erro ao salvar perfil. Tente novamente.');
    }
    return true;
  },
};

// === Avatar ===
export const avatarService = {
  async upload(userId: string, file: File): Promise<string> {
    const path = `${userId}/profile.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      logService.error('avatarService', 'upload failed', uploadError);
      throw new Error('Erro ao enviar a foto. Tente novamente.');
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const displayUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: displayUrl })
      .eq('id', userId);

    if (updateError) {
      logService.error('avatarService', 'avatar_url update failed', updateError);
      throw new Error('Foto enviada, mas não foi possível salvar. Tente novamente.');
    }

    return displayUrl;
  },

  async remove(userId: string): Promise<void> {
    const path = `${userId}/profile.jpg`;

    const { error: storageError } = await supabase.storage.from('avatars').remove([path]);
    if (storageError) logService.warn('avatarService', 'storage remove failed — continuing', storageError);

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (error) {
      logService.error('avatarService', 'avatar_url clear failed', error);
      throw new Error('Não foi possível remover a foto. Tente novamente.');
    }
  },
};

// === Appointments ===
export interface AppointmentClient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

export interface AppointmentProfessionalProfile {
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
}

export interface AppointmentProfessional {
  id: string;
  user_id: string;
  category: string | null;
  profile: AppointmentProfessionalProfile | null;
}

export interface Appointment {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  cancelled_reason: string | null;
  conversation_id: string | null;
  client_id: string;
  professional_id: string;
  created_at: string;
  updated_at: string;
  client?: AppointmentClient | null;
  professional?: AppointmentProfessional | null;
}

export const appointmentService = {
  async getProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('id,title,description,scheduled_at,duration_minutes,location,status,cancelled_reason,conversation_id,client_id,professional_id,created_at,updated_at')
      .eq('professional_id', professionalId)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];

    const clientIds = [...new Set(data.map(a => a.client_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url,phone')
      .in('id', clientIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    return data.map(a => ({ ...a, client: profileMap[a.client_id] ?? null })) as Appointment[];
  },

  async getClientAppointments(clientUserId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('id,title,description,scheduled_at,duration_minutes,location,status,cancelled_reason,conversation_id,professional_id,client_id,created_at,updated_at')
      .eq('client_id', clientUserId)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];

    const profIds = [...new Set(data.map(a => a.professional_id))];
    const { data: professionals } = await supabase
      .from('professionals')
      .select('id,user_id,category')
      .in('id', profIds);
    const profMap = Object.fromEntries((professionals ?? []).map(p => [p.id, p]));

    const userIds = (professionals ?? []).map(p => p.user_id).filter(Boolean);
    const { data: profProfiles } = userIds.length
      ? await supabase.from('profiles').select('id,full_name,avatar_url,city').in('id', userIds)
      : { data: [] };
    const profProfileMap = Object.fromEntries((profProfiles ?? []).map(p => [p.id, p]));

    return data.map(a => {
      const prof = profMap[a.professional_id];
      return {
        ...a,
        professional: prof
          ? { ...prof, profile: profProfileMap[prof.user_id] ?? null }
          : null,
      };
    }) as Appointment[];
  },

  async createAppointment(payload: {
    professional_id: string;
    client_id: string;
    conversation_id?: string;
    scheduled_at: string;
    title: string;
    location?: string;
    description?: string;
    duration_minutes?: number;
  }): Promise<Appointment> {
    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({ ...payload, status: 'scheduled' })
      .select()
      .single();
    if (error) throw error;

    const dt = new Date(payload.scheduled_at);
    void supabase.from('notifications').insert({
      user_id: payload.client_id,
      title: 'Novo agendamento',
      body: `Visita agendada para ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      data: { appointment_id: appt.id, type: 'appointment' },
    });

    return appt as Appointment;
  },

  async updateAppointmentStatus(
    appointmentId: string,
    status: 'confirmed' | 'cancelled' | 'completed',
    opts?: { cancelledReason?: string; notifyUserId?: string }
  ): Promise<Appointment> {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (opts?.cancelledReason !== undefined) updates.cancelled_reason = opts.cancelledReason;

    const { data: appt, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw error;

    // B: appointment completed → lead finalizado (via conversation.lead_id)
    if (status === 'completed' && (appt as any).conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('lead_id')
        .eq('id', (appt as any).conversation_id)
        .maybeSingle();
      if (conv?.lead_id) {
        void supabase.from('leads').update({ status: 'finalizado' }).eq('id', conv.lead_id);
      }
    }

    if (opts?.notifyUserId) {
      const labels: Record<string, string> = {
        confirmed: 'Agendamento confirmado ✅',
        cancelled: 'Agendamento cancelado',
        completed: 'Atendimento concluído ✅',
      };
      void supabase.from('notifications').insert({
        user_id: opts.notifyUserId,
        title: labels[status] ?? 'Agendamento atualizado',
        body: opts.cancelledReason ? `Motivo: ${opts.cancelledReason}` : 'Status do agendamento foi atualizado',
        data: { appointment_id: appointmentId, type: 'appointment' },
      });
    }

    return appt as Appointment;
  },
};

// === Subscriptions ===
export const subscriptionService = {
  async getCurrentSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return null;
    return data;
  }
};
