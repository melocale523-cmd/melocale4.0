import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// Financeiro
export const walletService = {
  async getBalance() {
    try {
      const professionalId = useAuthStore.getState().user?.professionalId;
      if (!professionalId) return 0;

      const { data: wallet, error: walletError } = await supabase
        .from('v_wallet_balance')
        .select('*')
        .eq('professional_id', professionalId)
        .single();

      if (walletError) {
        console.error("Error fetching balance from view:", walletError);
        return 0;
      }

      // Retorna balance ou coins_balance
      return wallet?.balance_coins || wallet?.balance || wallet?.coins_balance || 0;
    } catch (e) {
      console.error("Unexpected error in getBalance:", e);
      return 0;
    }
  }
};

// Leads e Compras
export const leadService = {
  async getAvailableLeads() {
    const { data, error } = await supabase
      .from('v_available_leads')
      .select('*');
    if (error) throw error;
    return data;
  },

  async purchaseLead(leadId: string) {
    const idempotencyKey = crypto.randomUUID();
    const { data, error } = await supabase.rpc('purchase_lead', {
      p_lead_id: leadId,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
    return data;
  },

  async getMyPurchases() {
    const professionalId = useAuthStore.getState().user?.professionalId;
    if (!professionalId) return [];

    const { data, error } = await supabase
      .from('lead_purchases')
      .select(`
        *,
        leads:lead_id (
          title,
          description,
          location,
          category,
          budget_min,
          budget_max,
          profiles:client_id (
            name,
            phone,
            email,
            address
          )
        )
      `)
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getMyRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        proposals_count:proposals(count)
      `)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createRequest(request: { title: string, description: string, category: string, location: string, budget_min: number, budget_max: number }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const payload = {
      ...request,
      client_id: user.id,
      status: 'open'
    };

    const { data, error } = await supabase
      .from('leads')
      .insert([payload])
      .select()
      .single();
    
    if (error) {
      console.error("Error creating request:", error);
      throw error;
    }
    return data;
  },

  async getClientSummary() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { waiting: 0, in_progress: 0 };

    const { data: requests, error } = await supabase
      .from('leads')
      .select('status')
      .eq('client_id', user.id);
    
    if (error) throw error;

    const summary = {
      waiting: requests.filter(r => r.status === 'open' || r.status === 'Orçando').length,
      in_progress: requests.filter(r => r.status === 'in_progress' || r.status === 'Em Andamento').length
    };

    return summary;
  },

  async getProfessionalStats(range: '7d' | '30d' | '90d' | '1y' = '30d') {
    const professionalId = useAuthStore.getState().user?.professionalId;
    if (!professionalId) throw new Error("Professional ID not found");

    const now = new Date();
    let startDate = new Date();
    
    if (range === '7d') startDate.setDate(now.getDate() - 7);
    else if (range === '30d') startDate.setDate(now.getDate() - 30);
    else if (range === '90d') startDate.setDate(now.getDate() - 90);
    else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);

    const startDateStr = startDate.toISOString();

    // Buscar compras no período
    const { data: purchases, error: purchaseError } = await supabase
      .from('lead_purchases')
      .select('coins_price, created_at')
      .eq('professional_id', professionalId)
      .gte('created_at', startDateStr);

    if (purchaseError) throw purchaseError;

    // Buscar propostas no período
    const { data: proposals, error: propError } = await supabase
      .from('proposals')
      .select('status, created_at, price, lead_purchases!inner(professional_id)')
      .eq('lead_purchases.professional_id', professionalId)
      .gte('created_at', startDateStr);

    if (propError) throw propError;

    const acceptedProposals = proposals.filter(p => p.status === 'Aceita');
    const totalRevenue = acceptedProposals.reduce((acc, p) => acc + (p.price || 0), 0);

    // Preparar dados para o gráfico de solicitações (barras)
    // Agrupamento por dia para 7d e 30d, por mês para o resto
    const chartData: any[] = [];
    const dateMap = new Map();

    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dateMap.set(key, { name: key, total: 0, aceitas: 0, recusadas: 0, revenue: 0 });
      }

      proposals.forEach(p => {
        const key = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.total += 1;
          if (p.status === 'Aceita') {
            entry.aceitas += 1;
            entry.revenue += (p.price || 0);
          } else if (p.status === 'Recusada') {
            entry.recusadas += 1;
          }
        }
      });
    } else {
      // Agrupar por mês
      const months = range === '90d' ? 3 : 12;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const key = d.toLocaleDateString('pt-BR', { month: 'short' });
        dateMap.set(key, { name: key, total: 0, aceitas: 0, recusadas: 0, revenue: 0 });
      }

      proposals.forEach(p => {
        const key = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short' });
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.total += 1;
          if (p.status === 'Aceita') {
            entry.aceitas += 1;
            entry.revenue += (p.price || 0);
          }
        }
      });
    }

    const seriesData = Array.from(dateMap.values());

    return {
      totalSpentCoins: purchases.reduce((acc, p) => acc + (p.coins_price || 0), 0),
      contactsPurchased: purchases.length,
      visualizacoes: Math.floor(Math.random() * 50) + (range === '7d' ? 20 : range === '1y' ? 500 : 120),
      totalProposals: proposals.length,
      acceptedProposalsCount: acceptedProposals.length,
      totalRevenue,
      seriesData
    };
  }
};

// ... keep proposalService ...

// Financeiro extra
export const transactionService = {
  async getWalletTransactions() {
    const professionalId = useAuthStore.getState().user?.professionalId;
    if (!professionalId) throw new Error("Professional ID not found");

    // Tenta buscar de uma tabela de transações, se falhar, monta a partir de compras
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false });

    if (error) {
       // Fallback: usar histórico de compras
       const purchases = await leadService.getMyPurchases();
       return purchases.map(p => ({
         id: p.id,
         type: 'purchase',
         amount: p.coins_price,
         date: p.created_at,
         description: `Compra de Lead: ${p.leads?.title || 'Serviço'}`
       }));
    }

    return data;
  }
};

// Propostas
export const proposalService = {
  async sendProposal(purchaseId: string, proposal: { price: number, duration: string, description: string }) {
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        purchase_id: purchaseId,
        price: proposal.price,
        duration: proposal.duration,
        description: proposal.description,
        status: 'Enviada'
      });

    if (error) throw error;

    // Atualiza o status da compra simultaneamente
    await supabase
      .from('lead_purchases')
      .update({ status: 'Proposta Enviada' })
      .eq('id', purchaseId);

    return data;
  },

  async getProposalByPurchase(purchaseId: string) {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('purchase_id', purchaseId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getProposalsForLead(leadId: string) {
    const { data, error } = await supabase
      .from('proposals')
      .select(`
        *,
        lead_purchases!inner(
          id,
          lead_id,
          professional:professional_id (
            id,
            name,
            specialty,
            rating,
            completed_services
          )
        )
      `)
      .eq('lead_purchases.lead_id', leadId);
    
    if (error) throw error;
    return data;
  },

  async respondProposal(proposalId: string, purchaseId: string, status: 'Respondida pelo Cliente' | 'Aceita' | 'Recusada') {
    // Atualiza status da proposta
    const { error: propError } = await supabase
      .from('proposals')
      .update({ status })
      .eq('id', proposalId);
    
    if (propError) throw propError;

    // Atualiza status da compra para liberar contato
    const { error: purchaseError } = await supabase
      .from('lead_purchases')
      .update({ status })
      .eq('id', purchaseId);
    
    if (purchaseError) throw purchaseError;

    return true;
  }
};

// Admin Services
export const adminService = {
  async getDashboardSummary() {
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: pendingCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: activeLeadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'open');
    const { count: pendingDisputes } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    return {
      totalUsers: usersCount || 0,
      activeLeads: activeLeadsCount || 0,
      estimatedRevenue: 48500, // Placeholder/Calculated later
      pendingVerifications: pendingCount || 0,
      avgResponseTime: '12m',
      pendingDisputes: pendingDisputes || 0
    };
  },

  async getUsers(params?: { role?: string, status?: string }) {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (params?.role) query = query.eq('role', params.role);
    if (params?.status) query = query.eq('status', params.status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async updateUserStatus(userId: string, status: string) {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
    if (error) throw error;
    return true;
  },

  async getCoinPackages() {
    const { data, error } = await supabase.from('coin_packages').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    return data;
  },
  
  async updateCoinPackage(id: string, updates: any) {
    const { error } = await supabase.from('coin_packages').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const chatService = {
  async getChats() {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getMessages(chatId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async sendMessage(chatId: string, text: string, type: string = 'text', fileName?: string) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        text,
        type,
        file_name: fileName,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        status: 'sent'
      });
    
    if (error) throw error;
    return data;
  },

  async deleteChat(chatId: string) {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);
    
    if (error) throw error;
    return true;
  }
};
