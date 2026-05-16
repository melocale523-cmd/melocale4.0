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
    let totalRevenue = 0;
    let avgResponseTime = '—';
    try {
      const [totalUsersRes, activeLeadsRes, pendingDisputesRes, purchasesRes, avgTime] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('lead_purchases')
          .select('price')
          .not('price', 'is', null)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        calcAvgResponseTime(),
      ]);

      if (purchasesRes.data) {
        totalRevenue = (purchasesRes.data as { price: number | null }[]).reduce((acc, p) => acc + Number(p.price ?? 0), 0);
      }
      avgResponseTime = avgTime;

      return {
        totalUsers: totalUsersRes.count ?? 0,
        activeLeads: activeLeadsRes.count ?? 0,
        estimatedRevenue: totalRevenue,
        pendingVerifications: 0,
        avgResponseTime,
        pendingDisputes: pendingDisputesRes.count ?? 0,
      };
    } catch {
      return {
        totalUsers: 0,
        activeLeads: 0,
        estimatedRevenue: totalRevenue,
        pendingVerifications: 0,
        avgResponseTime,
        pendingDisputes: 0,
      };
    }
  },

  async getUsers(filters?: { role?: string; status?: string; limit?: number }) {
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

      const { data: profilesData, error: profilesError } = await query;
      if (profilesError) return [];

      const ids = (profilesData ?? []).map(p => p.id);

      const clientsRes = ids.length > 0
        ? await supabase.from('clients').select('id, email, full_name').in('id', ids)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

      const clientMap = Object.fromEntries((clientsRes.data ?? []).map(c => [c.id, c]));

      const missingEmailIds = (profilesData ?? [])
        .filter(p => !clientMap[p.id]?.email)
        .map(p => p.id);

      let authEmails: Record<string, string> = {};
      if (missingEmailIds.length > 0) {
        try {
          const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL || 'https://melocale4-0.onrender.com';
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            const res = await fetch(`${API_URL}/api/admin/user-emails?ids=${missingEmailIds.join(',')}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const json = await res.json() as { emails?: Record<string, string> };
              authEmails = json.emails ?? {};
            }
          }
        } catch {}
      }

      let profMap: Record<string, { is_active: boolean }> = {};
      try {
        if (ids.length > 0) {
          const { data, error } = await supabase
            .from('professionals')
            .select('user_id, is_active')
            .in('user_id', ids);
          if (!error && data) {
            profMap = Object.fromEntries(data.map(p => [p.user_id, p]));
          }
        }
      } catch {}

      const mapped = (profilesData ?? []).map(p => {
        const client = clientMap[p.id];
        const prof = profMap[p.id];
        return {
          ...p,
          email: client?.email ?? authEmails[p.id] ?? null,
          full_name: p.full_name ?? client?.full_name ?? null,
          name: p.full_name ?? client?.full_name ?? null,
          status: prof !== undefined
            ? (prof.is_active ? 'active' : 'inactive')
            : 'active',
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
    const isActive = status === 'active';
    const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL || 'https://melocale4-0.onrender.com';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Não autenticado');

    const res = await fetch(`${API_URL}/api/admin/professional-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, is_active: isActive }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || 'Erro ao atualizar status');
    }
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
