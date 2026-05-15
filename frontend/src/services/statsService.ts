import { supabase } from '../lib/supabase';

interface LeadStatusRow { status: string }

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
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role, account_type, created_at, updated_at');
      if (profilesError) return [];

      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, email, full_name');

      const { data: profsData } = await supabase
        .from('professionals')
        .select('user_id, is_public');

      const profiles = (profilesData || []).map(p => {
        const client = clientsData?.find(c => c.id === p.id);
        const prof = profsData?.find(pr => pr.user_id === p.id);
        return {
          ...p,
          email: client?.email ?? null,
          full_name: p.full_name ?? client?.full_name ?? null,
          status: prof ? (prof.is_public ? 'approved' : 'pending') : 'approved',
          name: p.full_name ?? client?.full_name ?? null,
        };
      });

      return profiles
        .filter(u => (!params?.role || u.role === params.role) && (!params?.status || u.status === params.status))
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
