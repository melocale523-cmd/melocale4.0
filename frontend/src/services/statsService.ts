import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

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

async function calcAvgResponseTime(professionalId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_avg_response_time_hours', {
    p_professional_id: professionalId,
  });
  if (error || data === null) return '—';
  const hours = Number(data);
  if (hours < 1) return 'menos de 1h';
  if (hours === 1) return '1 hora';
  return `${hours} horas`;
}

async function calcAvgResponseTimeGlobal(): Promise<string> {
  const { data, error } = await supabase.rpc('get_avg_response_time_hours_global');
  if (error || data === null) return '—';
  const hours = Number(data);
  if (hours < 1) return 'menos de 1h';
  if (hours === 1) return '1 hora';
  return `${hours} horas`;
}

export interface EnrichedUser {
  id: string;
  full_name: string | null;
  role: 'client' | 'professional' | 'admin';
  phone: string | null;
  city: string | null;
  created_at: string;
  email: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  category: string | null;
  is_active: boolean | null;
  bio: string | null;
  professional_id: string | null;
  package_id: string | null;
  sub_status: string | null;
  sub_started_at: string | null;
  balance_coins: number | null;
  total_leads: number;
  total_appointments: number;
  total_spent: number;
  total_payments: number;
  leads_purchased: number;
  total_reviews: number;
  avg_rating: number;
}

export const adminService = {
  async getDashboardSummary() {
    try {
      const [
        totalUsersRes,
        activeLeadsRes,
        pendingDisputesRes,
        ticketsRes,
        paymentsRes,
        subscriptionsRes,
        professionaisRes,
        churnRes,
        newUsersMonthRes,
        coinCirculationRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('payments').select('amount, package_id, paid_at').eq('status', 'paid').not('paid_at', 'is', null),
        supabase.from('user_subscriptions').select('package_id, status'),
        supabase.from('professionals').select('*', { count: 'exact', head: true }),
        supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'canceling'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('professional_coins').select('balance'),
      ]);

      const payments = (paymentsRes.data ?? []) as { amount: number; package_id: string; paid_at: string }[];

      // Faturamento total
      const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0) / 100;

      // Faturamento por tipo
      const revenueSubscriptions = payments
        .filter(p => p.package_id.startsWith('plan_'))
        .reduce((acc, p) => acc + p.amount, 0) / 100;
      const revenueCoinPacks = payments
        .filter(p => !p.package_id.startsWith('plan_'))
        .reduce((acc, p) => acc + p.amount, 0) / 100;

      // Faturamento por mês (últimos 3 meses)
      const monthlyRevenue: Record<string, number> = {};
      payments.forEach(p => {
        const key = p.paid_at.slice(0, 7); // YYYY-MM
        monthlyRevenue[key] = (monthlyRevenue[key] ?? 0) + p.amount / 100;
      });

      // MRR (assinaturas ativas)
      const PLAN_PRICES: Record<string, number> = {
        plan_basic: 37, plan_starter: 37,
        plan_pro: 67, plan_business: 67,
        plan_elite: 127,
      };
      const activeSubs = (subscriptionsRes.data ?? []).filter((s: { status: string }) => s.status === 'active');
      const mrr = activeSubs.reduce((acc: number, s: { package_id: string }) => acc + (PLAN_PRICES[s.package_id] ?? 0), 0);

      // Breakdown de pagamentos por package
      const packageBreakdown: Record<string, { qtd: number; total: number }> = {};
      payments.forEach(p => {
        if (!packageBreakdown[p.package_id]) packageBreakdown[p.package_id] = { qtd: 0, total: 0 };
        packageBreakdown[p.package_id].qtd += 1;
        packageBreakdown[p.package_id].total += p.amount / 100;
      });

      // Moedas em circulação
      const totalCoins = ((coinCirculationRes.data ?? []) as { balance: number }[])
        .reduce((acc, w) => acc + (w.balance ?? 0), 0);

      return {
        totalUsers: totalUsersRes.count ?? 0,
        activeLeads: activeLeadsRes.count ?? 0,
        pendingDisputes: pendingDisputesRes.count ?? 0,
        openTickets: ticketsRes.count ?? 0,
        totalRevenue,
        revenueSubscriptions,
        revenueCoinPacks,
        monthlyRevenue,
        mrr,
        totalProfessionals: professionaisRes.count ?? 0,
        churnCount: churnRes.count ?? 0,
        newUsersThisMonth: newUsersMonthRes.count ?? 0,
        totalCoinsCirculation: totalCoins,
        packageBreakdown,
        pendingVerifications: 0,
        avgResponseTime: await calcAvgResponseTimeGlobal(),
        estimatedRevenue: totalRevenue,
      };
    } catch {
      return {
        totalUsers: 0, activeLeads: 0, pendingDisputes: 0, openTickets: 0,
        totalRevenue: 0, revenueSubscriptions: 0, revenueCoinPacks: 0,
        monthlyRevenue: {}, mrr: 0, totalProfessionals: 0, churnCount: 0,
        newUsersThisMonth: 0, totalCoinsCirculation: 0, packageBreakdown: {},
        pendingVerifications: 0, avgResponseTime: '—', estimatedRevenue: 0,
      };
    }
  },

  async getUsersEnriched(): Promise<EnrichedUser[]> {
    try {
      const [profilesRes, prosRes, subsRes, coinsRes, leadsRes, apptsRes, paymentsRes, purchasesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, phone, city, created_at').order('created_at', { ascending: false }),
        supabase.from('professionals').select('id, user_id, category, is_active, bio'),
        supabase.from('user_subscriptions').select('user_id, package_id, status, started_at'),
        supabase.from('professional_coins').select('professional_id, balance'),
        supabase.from('leads').select('client_id'),
        supabase.from('appointments').select('client_id'),
        supabase.from('payments').select('user_id, amount, status'),
        supabase.from('lead_purchases').select('professional_id'),
      ]);

      const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null; role: string; phone: string | null; city: string | null; created_at: string }[];
      const pros = (prosRes.data ?? []) as { id: string; user_id: string; category: string | null; is_active: boolean; bio: string | null }[];
      const subs = (subsRes.data ?? []) as { user_id: string; package_id: string; status: string; started_at: string }[];
      const coins = (coinsRes.data ?? []) as { professional_id: string; balance: number }[];
      const leads = (leadsRes.data ?? []) as { client_id: string }[];
      const appts = (apptsRes.data ?? []) as { client_id: string }[];
      const payments = (paymentsRes.data ?? []) as { user_id: string; amount: number; status: string }[];
      const purchases = (purchasesRes.data ?? []) as { professional_id: string }[];

      const prosMap = Object.fromEntries(pros.map(p => [p.user_id, p]));
      const subsMap = Object.fromEntries(subs.map(s => [s.user_id, s]));
      // professional_coins.professional_id armazena profiles.id (auth user_id), não professionals.id
      // — conforme a função SQL credit_professional_coins(), que usa p_user_id como chave diretamente.
      const coinsMap = Object.fromEntries(coins.map(c => [c.professional_id, c.balance]));

      const leadsCount: Record<string, number> = {};
      leads.forEach(l => { leadsCount[l.client_id] = (leadsCount[l.client_id] ?? 0) + 1; });

      const apptsCount: Record<string, number> = {};
      appts.forEach(a => { apptsCount[a.client_id] = (apptsCount[a.client_id] ?? 0) + 1; });

      const paymentsMap: Record<string, { total: number; count: number }> = {};
      payments.filter(p => p.status === 'paid').forEach(p => {
        if (!paymentsMap[p.user_id]) paymentsMap[p.user_id] = { total: 0, count: 0 };
        paymentsMap[p.user_id].total += p.amount;
        paymentsMap[p.user_id].count += 1;
      });

      const purchasesCount: Record<string, number> = {};
      purchases.forEach(lp => { purchasesCount[lp.professional_id] = (purchasesCount[lp.professional_id] ?? 0) + 1; });

      return profiles.map(p => {
        const pro = prosMap[p.id];
        const sub = subsMap[p.id];
        const paid = paymentsMap[p.id];
        return {
          id: p.id,
          full_name: p.full_name,
          role: p.role as 'client' | 'professional' | 'admin',
          phone: p.phone,
          city: p.city,
          created_at: p.created_at,
          email: null,
          last_sign_in_at: null,
          email_confirmed_at: null,
          category: pro?.category ?? null,
          is_active: pro?.is_active ?? null,
          bio: pro?.bio ?? null,
          professional_id: pro?.id ?? null,
          package_id: sub?.package_id ?? null,
          sub_status: sub?.status ?? null,
          sub_started_at: sub?.started_at ?? null,
          balance_coins: pro ? (coinsMap[p.id] ?? null) : null,
          total_leads: leadsCount[p.id] ?? 0,
          total_appointments: apptsCount[p.id] ?? 0,
          total_spent: paid ? paid.total / 100 : 0,
          total_payments: paid?.count ?? 0,
          leads_purchased: pro ? (purchasesCount[pro.id] ?? 0) : 0,
          total_reviews: 0,
          avg_rating: 0,
        };
      });
    } catch {
      return [];
    }
  },

  async getUsers(filters?: { role?: string; status?: string; limit?: number }) {
    try {
      const limit = filters?.limit ?? 100;

      // If a status filter is given, resolve matching user_ids from professionals table first
      let allowedIds: string[] | null = null;
      if (filters?.status) {
        const isActive = filters.status === 'active';
        const { data: profRows } = await supabase
          .from('professionals')
          .select('user_id')
          .eq('is_active', isActive);
        allowedIds = (profRows ?? []).map(r => r.user_id);
        if (allowedIds.length === 0) return [];
      }

      let query = supabase
        .from('profiles')
        .select('id, full_name, role, account_type, created_at, updated_at')
        .limit(limit)
        .order('created_at', { ascending: false });

      if (filters?.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }
      if (allowedIds !== null) {
        query = query.in('id', allowedIds);
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
          const res = await apiFetch(`/api/admin/user-emails?ids=${missingEmailIds.join(',')}`);
          if (res.ok) {
            const json = await res.json() as { emails?: Record<string, string> };
            authEmails = json.emails ?? {};
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

      return mapped;
    } catch {
      return [];
    }
  },

  async updateUserStatus(userId: string, status: string) {
    const isActive = status === 'active';
    const res = await apiFetch('/api/admin/professional-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_active: isActive }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error((err as { error?: string }).error || 'Erro ao atualizar status');
    }
    return true;
  },

  async rejectProfessional(userId: string) {
    const res = await apiFetch(`/api/admin/professionals/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error((err as { error?: string }).error || 'Erro ao rejeitar profissional');
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

  async getUserAuthData(): Promise<Record<string, { email: string | null; last_sign_in_at: string | null }>> {
    try {
      const res = await apiFetch('/api/admin/users-enriched');
      if (!res.ok) return {};
      const users = await res.json() as Array<{ id: string; email: string | null; last_sign_in_at: string | null }>;
      return Object.fromEntries(users.map(u => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at }]));
    } catch {
      return {};
    }
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
  },

  async getRankingProfissionais(): Promise<RankedProfessional[]> {
    const [profsRes, coinsRes, paymentsRes, subsRes] = await Promise.all([
      supabase.from('professionals').select('id, user_id, category, city, created_at, is_active'),
      supabase.from('professional_coins').select('professional_id, balance, total_earned'),
      supabase.from('payments').select('user_id, amount, status').eq('status', 'paid'),
      supabase.from('user_subscriptions').select('user_id, package_id, status').in('status', ['active', 'canceling']),
    ]);

    const profs = (profsRes.data ?? []) as Array<{ id: string; user_id: string; category: string | null; city: string | null; created_at: string; is_active: boolean }>;
    const coins = (coinsRes.data ?? []) as Array<{ professional_id: string; balance: number; total_earned: number }>;
    const payments = (paymentsRes.data ?? []) as Array<{ user_id: string; amount: number; status: string }>;
    const subs = (subsRes.data ?? []) as Array<{ user_id: string; package_id: string; status: string }>;

    const userIds = profs.map(p => p.user_id);
    const profilesRes = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, avatar_url, address_state').in('id', userIds)
      : { data: [] };
    const profilesData = (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; address_state: string | null }>;

    // Lookup maps — professional_coins.professional_id === profiles.id === auth UUID
    const coinsMap = new Map(coins.map(c => [c.professional_id, c]));
    const profileMap = new Map(profilesData.map(p => [p.id, p]));
    const subsMap = new Map(subs.map(s => [s.user_id, s]));

    const paymentsByUser = new Map<string, { count: number; total: number }>();
    for (const p of payments) {
      const cur = paymentsByUser.get(p.user_id) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += p.amount ?? 0;
      paymentsByUser.set(p.user_id, cur);
    }

    const enriched: RankedProfessional[] = profs.map(prof => {
      const coinData = coinsMap.get(prof.user_id);
      const profile = profileMap.get(prof.user_id);
      const sub = subsMap.get(prof.user_id);
      const pay = paymentsByUser.get(prof.user_id) ?? { count: 0, total: 0 };
      return {
        professional_id: prof.id,
        user_id: prof.user_id,
        full_name: profile?.full_name ?? 'Sem nome',
        avatar_url: profile?.avatar_url ?? null,
        category: prof.category ?? null,
        city: prof.city ?? null,
        state: profile?.address_state ?? null,
        created_at: prof.created_at,
        is_active: prof.is_active ?? false,
        coins: coinData?.balance ?? 0,
        total_earned: coinData?.total_earned ?? 0,
        payment_count: pay.count,
        total_spent: pay.total,
        plan: sub?.package_id ?? null,
        plan_status: sub?.status ?? null,
        score: 0,
      };
    });

    const maxCoins = Math.max(...enriched.map(p => p.coins), 1);
    const maxPayments = Math.max(...enriched.map(p => p.payment_count), 1);

    for (const p of enriched) {
      p.score = Math.round(
        (p.coins / maxCoins) * 50 +
        (p.payment_count / maxPayments) * 30 +
        (p.plan ? 20 : 0)
      );
    }

    return enriched.sort((a, b) => b.score - a.score);
  },
};

export type RankedProfessional = {
  professional_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  is_active: boolean;
  coins: number;
  total_earned: number;
  payment_count: number;
  total_spent: number;
  plan: string | null;
  plan_status: string | null;
  score: number;
};
