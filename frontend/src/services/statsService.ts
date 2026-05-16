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
    let pendingCount = 0, totalRevenue = 0;
    let avgResponseTime = '—';
    try {
      const [totalUsersRes, activeLeadsRes, pendingDisputesRes, pendingProfsRes, purchasesRes, avgTime] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id, status').eq('status', 'pending'),
        supabase
          .from('lead_purchases')
          .select('price')
          .not('price', 'is', null)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        calcAvgResponseTime(),
      ]);

      if (pendingProfsRes.data) {
        pendingCount = pendingProfsRes.data.length;
      }
      if (purchasesRes.data) {
        totalRevenue = (purchasesRes.data as { price: number | null }[]).reduce((acc, p) => acc + Number(p.price ?? 0), 0);
      }
      avgResponseTime = avgTime;

      return {
        totalUsers: totalUsersRes.count ?? 0,
        activeLeads: activeLeadsRes.count ?? 0,
        estimatedRevenue: totalRevenue,
        pendingVerifications: pendingCount,
        avgResponseTime,
        pendingDisputes: pendingDisputesRes.count ?? 0,
      };
    } catch {
      return {
        totalUsers: 0,
        activeLeads: 0,
        estimatedRevenue: totalRevenue,
        pendingVerifications: pendingCount,
        avgResponseTime,
        pendingDisputes: 0,
      };
    }
  },

  async getUsers(filters?: { role?: string; status?: string; search?: string; limit?: number }) {
    try {
      const limit = filters?.limit ?? 100;

      let query = supabase
        .from('profiles')
        .select('id, full_name, role, account_type, created_at, updated_at')
        .limit(limit)
        .order('created_at', { ascending: false });

      if (filters?.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }

      if (filters?.search) {
        query = query.ilike('full_name', `%${filters.search}%`);
      }

      const { data: profilesData, error: profilesError } = await query;
      if (profilesError) return [];

      const ids = (profilesData ?? []).map(p => p.id);

      const [clientsRes, profsRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('clients').select('id, email, full_name').in('id', ids)
          : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[] }),
        ids.length > 0
          ? supabase.from('professionals').select('user_id, is_public').in('user_id', ids)
          : Promise.resolve({ data: [] as { user_id: string; is_public: boolean }[] }),
      ]);

      const clientMap = Object.fromEntries((clientsRes.data ?? []).map(c => [c.id, c]));
      const profMap = Object.fromEntries((profsRes.data ?? []).map(p => [p.user_id, p]));

      const mapped = (profilesData ?? []).map(p => {
        const client = clientMap[p.id];
        const prof = profMap[p.id];
        return {
          ...p,
          email: client?.email ?? null,
          full_name: p.full_name ?? client?.full_name ?? null,
          name: p.full_name ?? client?.full_name ?? null,
          status: prof ? (prof.is_public ? 'approved' : 'pending') : 'approved',
        };
      });

      if (filters?.status) {
        return mapped.filter(u => u.status === filters.status);
      }
      return mapped;
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
