import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { logService } from '../lib/logService';

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
      return (fallback.data || []).filter((l: any) => l.status === 'open');
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
    return data as PurchaseLeadResult;
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
        waiting: userRequests.filter((r: any) => r.status === 'open' || r.status === 'Orçando').length,
        in_progress: userRequests.filter((r: any) => r.status === 'in_progress' || r.status === 'Em Andamento').length
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
    let purchasesData: any[] = [];
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
    const proposalsData = purchasesData.filter((p: any) =>
      p.status === 'Proposta Enviada' || p.status === 'Aceita' || p.status === 'Recusada'
    );
    const acceptedProposals = proposalsData.filter((p: any) => p.status === 'Aceita');
    const totalRevenue = acceptedProposals.reduce((acc: number, p: any) => acc + (p.price || 0), 0);

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
      purchasesData.forEach((p: any) => {
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
      purchasesData.forEach((p: any) => {
        const key = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short' });
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.total += 1;
          if (p.status === 'Aceita') { entry.aceitas += 1; entry.revenue += (p.price || 0); }
        }
      });
    }

    return {
      totalSpentCoins: purchasesData.reduce((acc: number, p: any) => acc + (p.price_coins || 0), 0),
      contactsPurchased: purchasesData.length,
      visualizacoes: null,
      totalProposals: proposalsData.length,
      acceptedProposalsCount: acceptedProposals.length,
      totalRevenue,
      seriesData: Array.from(dateMap.values()),
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
        .select('*')
        .or(`user_id.eq.${professionalId},wallet_id.eq.${professionalId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
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
        let chatId: string | null = purchase.chat_id ?? null;

        if (!chatId) {
          const { data: prof } = await supabase
            .from('professionals')
            .select('user_id')
            .eq('id', purchase.professional_id)
            .single();

          const { data: conv } = await supabase
            .from('conversations')
            .insert({
              professional_id: prof?.user_id ?? purchase.professional_id,
              client_id: purchase.client_id,
              lead_id: purchase.lead_id,
            })
            .select('id')
            .single();
          chatId = conv?.id ?? null;

          if (chatId) {
            await supabase
              .from('lead_purchases')
              .update({ chat_id: chatId })
              .eq('id', purchaseId);
          }
        }

        await supabase.from('notifications').insert({
          user_id: purchase.professional_id,
          title: 'Interesse confirmado! 🎉',
          body: 'Um cliente aceitou sua proposta. Abra o chat para iniciar o serviço.',
          data: { type: 'proposal_accepted', purchaseId, chatId },
        });
      }
    }

    return true;
  },

  async ensureChatForPurchase(purchaseId: string): Promise<string | null> {
    const { data: purchase } = await supabase
      .from('lead_purchases')
      .select('chat_id, professional_id, client_id, lead_id')
      .eq('id', purchaseId)
      .single();

    if (purchase?.chat_id) return purchase.chat_id;

    const { data: prof } = await supabase
      .from('professionals')
      .select('user_id')
      .eq('id', purchase?.professional_id)
      .single();

    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        professional_id: prof?.user_id ?? purchase?.professional_id,
        client_id: purchase?.client_id,
        lead_id: purchase?.lead_id,
      })
      .select('id')
      .single();

    if (!conv?.id) return null;

    await supabase
      .from('lead_purchases')
      .update({ chat_id: conv.id })
      .eq('id', purchaseId);

    return conv.id;
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
      const { data, error } = await supabase.from('coin_packages').select('*');
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
  
  async updateCoinPackage(id: string, updates: any) {
    const { error } = await supabase.from('coin_packages').update(updates).eq('id', id);
    if (error) throw error;
    return true;
  }
};

// === Chats ===
export const chatService = {
  async getChats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Step 1: Find this user's professionals.id (if they are a professional)
    // professional_id in conversations → professionals.id (not auth user id)
    const { data: profRecord } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const myProfessionalId = profRecord?.id ?? null;

    // client_id in conversations = clients.id = auth user id
    let filter = `client_id.eq.${user.id}`;
    if (myProfessionalId) filter += `,professional_id.eq.${myProfessionalId}`;

    const { data: convs, error } = await supabase
      .from('conversations')
      .select('*')
      .or(filter)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error || !convs?.length) return convs || [];

    const convIds = convs.map((c: any) => c.id);
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, body, attachments')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, string> = {};
    (lastMsgs || []).forEach((m: any) => {
      if (!lastMsgMap[m.conversation_id]) {
        const att = Array.isArray(m.attachments) ? m.attachments[0] : null;
        lastMsgMap[m.conversation_id] = att?.type === 'image' ? '📷 Foto' : att?.type === 'audio' ? '🎤 Áudio' : att?.type === 'file' ? `📎 ${att.fileName || 'Arquivo'}` : m.body;
      }
    });

    const { data: unreadClientData } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .eq('sender_type', 'professional')
      .is('read_at', null);
    const unreadClientMap: Record<string, number> = {};
    (unreadClientData || []).forEach((m: any) => {
      unreadClientMap[m.conversation_id] = (unreadClientMap[m.conversation_id] || 0) + 1;
    });

    // Step 2: professionals.id → professionals.user_id
    const profIds = [...new Set(convs.map((c: any) => c.professional_id).filter(Boolean))];
    const { data: profsData } = profIds.length
      ? await supabase.from('professionals').select('id, user_id').in('id', profIds)
      : { data: [] };
    const profIdToUserId: Record<string, string> = Object.fromEntries(
      (profsData || []).map((p: any) => [p.id, p.user_id]),
    );

    // Step 3: clients table has full_name directly (no user_id column)
    const clientIds = [...new Set(convs.map((c: any) => c.client_id).filter(Boolean))];
    const { data: clientsData } = clientIds.length
      ? await supabase.from('clients').select('id, full_name').in('id', clientIds)
      : { data: [] };
    const clientMap: Record<string, any> = Object.fromEntries(
      (clientsData || []).map((c: any) => [c.id, c]),
    );

    // Step 4: profiles for professional user_ids + client_ids (clients.id = auth user id = profiles.id)
    const profUserIds = [...new Set(Object.values(profIdToUserId).filter(Boolean))] as string[];
    const allProfileIds = [...new Set([...profUserIds, ...clientIds])];
    const { data: profilesData } = allProfileIds.length
      ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', allProfileIds)
      : { data: [] };
    const profileMap: Record<string, any> = Object.fromEntries(
      (profilesData || []).map((p: any) => [p.id, p]),
    );

    // Step 5: assemble
    return convs.map((c: any) => {
      const profUserId = profIdToUserId[c.professional_id] ?? null;
      const profProfile = profUserId ? (profileMap[profUserId] ?? null) : null;
      const clientFromProfile = profileMap[c.client_id];
      const clientFromTable = clientMap[c.client_id];
      const clientProfile = {
        full_name: clientFromProfile?.full_name ?? clientFromTable?.full_name ?? null,
        avatar_url: clientFromProfile?.avatar_url ?? null,
      };
      return { ...c, prof_user_id: profUserId, prof_profile: profProfile, client_profile: clientProfile, last_message: lastMsgMap[c.id] ?? null, unread_client: unreadClientMap[c.id] ?? 0 };
    });
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
        .select('client_id, professional_id')
        .eq('id', conversationId)
        .single();
      if (conv?.client_id === user.id) {
        senderType = 'client';
      } else if (conv?.professional_id) {
        // professional_id → professionals.id; resolve via user_id
        const { data: prof } = await supabase
          .from('professionals')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (prof?.id === conv.professional_id) senderType = 'professional';
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
  async saveProfile(userId: string, data: { name: string; phone: string; city: string }) {
    const payload = { id: userId, full_name: data.name, phone: data.phone, city: data.city };
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
