import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';

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

// TODO: calcAvgResponseTime deve ser implementado como RPC no banco (get_avg_response_time_minutes)
// para evitar carregar centenas de linhas de mensagens no cliente.
async function calcAvgResponseTime(): Promise<string> {
  return '—';
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
