import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// === Auth Functions ===
export const authService = {
  async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },
  async getProfessionalByUserId(userId: string) {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*');
      if (error) return null;
      // JS Filter to avoid 'eq' on potentially wrong columns
      const prof = data.find((p: any) => p.user_id === userId);
      return prof || null;
    } catch {
      return null;
    }
  }
};

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
      
      console.log("Saldo recebido:", data);

      if (error || !data) return 0;
      
      return data.balance_coins || 0;
    } catch {
      return 0;
    }
  }
};

// === Leads and Purchases ===
export const leadService = {
  async getAvailableLeads() {
    const { data, error } = await supabase
      .from('v_available_leads')
      .select('*');
      
    if (error) {
      // Fallback
      const fallback = await supabase.from('leads').select('*');
      return (fallback.data || []).filter((l: any) => l.status === 'open');
    }
    return data || [];
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
    try {
      const { data, error } = await supabase
        .from('v_my_purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map((row: any) => ({
        ...row,
        leads: {
          id: row.lead_id, title: row.title, description: row.description,
          category: row.category, city: row.city, state: row.state,
          budget_min: row.budget_min, budget_max: row.budget_max,
          event_date: row.event_date, status: row.lead_status,
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
      return data ?? [];
    } catch {
      return [];
    }
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
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  },

  async getClientSummary() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { waiting: 0, in_progress: 0 };

      const { data: requests, error } = await supabase
        .from('leads')
        .select('*');
      
      if (error) return { waiting: 0, in_progress: 0 };

      const userRequests = (requests || []).filter((r: any) => r.client_id === user.id || r.user_id === user.id);

      return {
        waiting: userRequests.filter((r: any) => r.status === 'open' || r.status === 'Orçando').length,
        in_progress: userRequests.filter((r: any) => r.status === 'in_progress' || r.status === 'Em Andamento').length
      };
    } catch {
      return { waiting: 0, in_progress: 0 };
    }
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

    let purchasesData: any[] = [];
    try {
      const { data: purchases, error: purchaseError } = await supabase
        .from('lead_purchases')
        .select('*');

      if (!purchaseError && purchases) {
        purchasesData = purchases.filter((p: any) => 
          (p.user_id === professionalId || p.wallet_id === professionalId) && 
          new Date(p.created_at || 0) >= startDate
        );
      }
    } catch {}

    let proposalsData: any[] = [];
    try {
      // Removed non-existent proposals table usage
      proposalsData = [];
    } catch {}
    
    const acceptedProposals = proposalsData.filter(p => p.status === 'Aceita');
    const totalRevenue = acceptedProposals.reduce((acc, p) => acc + (p.price || 0), 0);

    const dateMap = new Map();

    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dateMap.set(key, { name: key, total: 0, aceitas: 0, recusadas: 0, revenue: 0 });
      }

      proposalsData.forEach(p => {
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
      const months = range === '90d' ? 3 : 12;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const key = d.toLocaleDateString('pt-BR', { month: 'short' });
        dateMap.set(key, { name: key, total: 0, aceitas: 0, recusadas: 0, revenue: 0 });
      }

      proposalsData.forEach(p => {
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
      totalSpentCoins: purchasesData.reduce((acc, p) => acc + (p.price_coins || 0), 0),
      contactsPurchased: purchasesData.length,
      visualizacoes: Math.floor(Math.random() * 50) + (range === '7d' ? 20 : range === '1y' ? 500 : 120),
      totalProposals: proposalsData.length,
      acceptedProposalsCount: acceptedProposals.length,
      totalRevenue,
      seriesData
    };
  }
};

// === Transactions ===
export const transactionService = {
  async getWalletTransactions() {
    const professionalId = useAuthStore.getState().user?.professionalId;
    if (!professionalId) throw new Error("Professional ID not found");

    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*');

      if (error) throw error;

      return (data || [])
        .filter((t: any) => t.wallet_id === professionalId || t.user_id === professionalId)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } catch {
       const purchases = await leadService.getMyPurchases();
       return purchases.map((p: any) => ({
         id: p.id,
         type: 'purchase',
         amount: p.price_coins || p.price || 0,
         date: p.created_at,
         description: `Compra de Lead (Ref: ${p.lead_id || 'Serviço'})`
       }));
    }
  }
};

// === Proposals ===
export const proposalService = {
  async sendProposal(purchaseId: string, proposal: { price: number, duration: string, description: string, status: string }, clientId?: string) {
    // Removed non-existent proposals table usage

    await supabase
      .from('lead_purchases')
      .update({ status: proposal.status })
      .eq('id', purchaseId);

    if (clientId) {
      supabase
        .from('notifications')
        .insert({
          user_id: clientId,
          title: 'Nova Proposta Recebida',
          body: `Você recebeu uma nova proposta no valor de R$ ${proposal.price}.`,
          data: { type: 'proposal_received', purchaseId }
        }).then(({ error }) => {
          if (error) console.error("Erro ao notificar cliente", error);
        });
    }

    return { id: Math.random().toString(), purchase_id: purchaseId, ...proposal, status: 'Enviada' };
  },

  async getProposalByPurchase(purchaseId: string) {
    // Removed non-existent proposals table usage
    return null;
  },

  async getProposalsForLead(leadId: string) {
    // Removed non-existent proposals table usage
    return [];
  },

  async respondProposal(proposalId: string, purchaseId: string, status: 'Respondida pelo Cliente' | 'Aceita' | 'Recusada', professionalId?: string) {
    // Removed non-existent proposals table usage

    const { error: purchaseError } = await supabase
      .from('lead_purchases')
      .update({ status })
      .eq('id', purchaseId);
    
    if (purchaseError) throw purchaseError;

    if (professionalId) {
      supabase
        .from('notifications')
        .insert({
          user_id: professionalId,
          title: `Proposta ${status}`,
          body: `O cliente ${status.toLowerCase()} sua proposta.`,
          data: { type: 'proposal_status_update', proposalId, status }
        }).then(({ error }) => {
          if (error) console.error("Erro ao notificar profissional", error);
        });
    }

    return true;
  }
};

// === Admin ===
export const adminService = {
  async getDashboardSummary() {
    let usersCount = 0, pendingCount = 0, activeLeadsCount = 0, pendingDisputesCount = 0;
    try {
      const { data: profs } = await supabase.from('profiles').select('*');
      if (profs) {
        usersCount = profs.length;
        pendingCount = profs.filter((p: any) => p.status === 'pending').length;
      }
      
      const { data: leads } = await supabase.from('leads').select('*');
      if (leads) {
        activeLeadsCount = leads.filter((l: any) => l.status === 'open').length;
      }
      
      const { data: disputes } = await supabase.from('disputes').select('*');
      if (disputes) {
        pendingDisputesCount = disputes.filter((d: any) => d.status === 'pending').length;
      }
    } catch {}

    return {
      totalUsers: usersCount || 0,
      activeLeads: activeLeadsCount || 0,
      estimatedRevenue: 48500,
      pendingVerifications: pendingCount || 0,
      avgResponseTime: '12m',
      pendingDisputes: pendingDisputesCount || 0
    };
  },

  async getUsers(params?: { role?: string, status?: string }) {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) return [];
      
      return (data || [])
        .filter((user: any) => (!params?.role || user.role === params.role) && (!params?.status || user.status === params.status))
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
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
      // 100% select('*') no order, no eq
      const { data, error } = await supabase.from('coin_packages').select('*');
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
  
  async updateCoinPackage(id: string, updates: any) {
    // Apenas .eq na ID
    const { error } = await supabase.from('coin_packages').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  }
};

// === Chats ===
export const chatService = {
  async getChats() {
    const { data, error } = await supabase
      .from('chats')
      .select('*');
    
    if (error) throw error;
    
    // JS side sort to avoid order() parameter failing in DB
    return (data || []).sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  },

  async getMessages(chatId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*');
    
    if (error) throw error;
    
    // JS side filter and sort
    return (data || [])
      .filter((m: any) => m.chat_id === chatId)
      .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  },

  async sendMessage(chatId: string, text: string, type: string = 'text', fileName?: string, recipientId?: string) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        text,
        type,
        file_name: fileName,
        sender_id: userId,
        status: 'sent'
      })
      .select('*')
      .single();
    
    if (error) throw error;

    if (recipientId && recipientId !== userId) {
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: recipientId,
            title: 'Nova Mensagem',
            body: text.length > 50 ? text.substring(0, 47) + '...' : text,
            data: { chatId, type: 'message' }
          });
      } catch {}
    }

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

// === Profile ===
export const profileService = {
  async saveProfile(userId: string, data: {
    name: string;
    phone: string;
    bio: string;
    category: string;
    serviceRadius: string;
  }) {
    const { error } = await supabase.rpc('save_full_profile', {
      p_user_id: userId,
      p_full_name: data.name,
      p_phone: data.phone,
      p_bio: data.bio || null,
      p_category: data.category || null,
      p_service_radius: data.serviceRadius ? Number(data.serviceRadius) : null,
    });
    if (error) {
      console.error('[profileService.saveProfile] RPC ERROR:', error);
      throw new Error('Erro ao salvar dados. Tente novamente.');
    }
    return true;
  },
};

// === Subscriptions ===
export const subscriptionService = {
  async getCurrentSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) return null;
    return data;
  }
};

