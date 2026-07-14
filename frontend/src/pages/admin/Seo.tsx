import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Coins, Loader2, MousePointerClick, Search, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SeoTotals {
  visits: number;
  signups: number;
  client_signups: number;
  professional_signups: number;
  leads_created: number;
  leads_purchased: number;
  coins_spent: number;
  revenue_brl: number;
}

interface SeoPageRow extends SeoTotals {
  landing_path: string;
  service_slug?: string | null;
  service_category?: string | null;
  service_city?: string | null;
}

interface SeoServiceRow {
  service_category: string;
  service_city: string;
  visits: number;
  signups: number;
  leads_created: number;
  leads_purchased: number;
  coins_spent: number;
  revenue_brl: number;
}

interface SeoDashboardData {
  since: string;
  totals: SeoTotals;
  pages: SeoPageRow[];
  services: SeoServiceRow[];
  gargalos: {
    visits_without_signup: number;
    signups_without_lead: number;
    leads_without_purchase: number;
  };
}

const emptyTotals: SeoTotals = {
  visits: 0,
  signups: 0,
  client_signups: 0,
  professional_signups: 0,
  leads_created: 0,
  leads_purchased: 0,
  coins_spent: 0,
  revenue_brl: 0,
};

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeDashboard(raw: unknown): SeoDashboardData {
  const value = (raw ?? {}) as Partial<SeoDashboardData>;
  const totals = { ...emptyTotals, ...(value.totals ?? {}) };
  return {
    since: typeof value.since === 'string' ? value.since : new Date().toISOString(),
    totals: {
      visits: asNumber(totals.visits),
      signups: asNumber(totals.signups),
      client_signups: asNumber(totals.client_signups),
      professional_signups: asNumber(totals.professional_signups),
      leads_created: asNumber(totals.leads_created),
      leads_purchased: asNumber(totals.leads_purchased),
      coins_spent: asNumber(totals.coins_spent),
      revenue_brl: asNumber(totals.revenue_brl),
    },
    pages: Array.isArray(value.pages) ? value.pages : [],
    services: Array.isArray(value.services) ? value.services : [],
    gargalos: {
      visits_without_signup: Math.max(0, asNumber(value.gargalos?.visits_without_signup)),
      signups_without_lead: Math.max(0, asNumber(value.gargalos?.signups_without_lead)),
      leads_without_purchase: Math.max(0, asNumber(value.gargalos?.leads_without_purchase)),
    },
  };
}

function percent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatCard({ icon: Icon, label, value, helper }: { icon: typeof Search; label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
        </div>
      </div>
      {helper && <p className="mt-3 text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

export default function AdminSeo() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin_seo_dashboard', days],
    queryFn: async () => {
      const { data: raw, error: rpcError } = await (supabase.rpc as any)('admin_get_seo_conversion_dashboard', { p_days: days });
      if (rpcError) throw rpcError;
      return normalizeDashboard(raw);
    },
  });

  const dashboard = data ?? normalizeDashboard(null);
  const startedAt = useMemo(() => new Date(dashboard.since).toLocaleDateString('pt-BR'), [dashboard.since]);

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-emerald-300">
        <Loader2 className="mr-2 animate-spin" /> Carregando funil organico...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">SEO monetizavel</p>
          <h1 className="mt-2 text-3xl font-black">Painel de conversao organica</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Acompanha entrada por pagina, cadastro, pedido criado, lead comprado e receita/moedas por servico e cidade desde {startedAt}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-10 rounded-xl border border-white/10 bg-[#132540] px-3 text-sm text-white outline-none">
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>365 dias</option>
          </select>
          <button type="button" onClick={() => void refetch()} className="h-10 rounded-xl bg-emerald-500 px-4 text-sm font-black text-black transition hover:bg-emerald-400">
            {isFetching ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Nao consegui carregar o painel. Confirme se a migracao ja foi aplicada no Supabase e se seu usuario e admin.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MousePointerClick} label="Entradas organicas" value={dashboard.totals.visits} helper={`${percent(dashboard.totals.signups, dashboard.totals.visits)} viraram cadastro`} />
        <StatCard icon={Users} label="Cadastros" value={dashboard.totals.signups} helper={`${dashboard.totals.client_signups} clientes ? ${dashboard.totals.professional_signups} profissionais`} />
        <StatCard icon={ClipboardList} label="Pedidos criados" value={dashboard.totals.leads_created} helper={`${percent(dashboard.totals.leads_created, dashboard.totals.signups)} dos cadastros`} />
        <StatCard icon={Coins} label="Leads comprados" value={dashboard.totals.leads_purchased} helper={`${dashboard.totals.coins_spent} moedas ? ${formatMoney(dashboard.totals.revenue_brl)}`} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard icon={AlertTriangle} label="Visitas sem cadastro" value={dashboard.gargalos.visits_without_signup} />
        <StatCard icon={AlertTriangle} label="Cadastros sem pedido" value={dashboard.gargalos.signups_without_lead} />
        <StatCard icon={AlertTriangle} label="Pedidos sem compra" value={dashboard.gargalos.leads_without_purchase} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <h2 className="text-lg font-black">Paginas que mais entram e convertem</h2>
            <p className="text-xs text-slate-400">Ordenado por visitas, depois pedidos e cadastros.</p>
          </div>
          <TrendingUp className="text-emerald-300" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-4 py-3">Pagina</th>
                <th className="px-4 py-3">Servico/cidade</th>
                <th className="px-4 py-3">Entradas</th>
                <th className="px-4 py-3">Cadastros</th>
                <th className="px-4 py-3">Pedidos</th>
                <th className="px-4 py-3">Compras</th>
                <th className="px-4 py-3">Moedas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {dashboard.pages.slice(0, 25).map((row) => (
                <tr key={row.landing_path} className="text-slate-200">
                  <td className="max-w-[320px] px-4 py-3 font-medium text-white truncate">{row.landing_path}</td>
                  <td className="px-4 py-3 text-slate-300">{[row.service_category, row.service_city].filter(Boolean).join(' ? ') || '?'}</td>
                  <td className="px-4 py-3">{row.visits}</td>
                  <td className="px-4 py-3">{row.client_signups + row.professional_signups}</td>
                  <td className="px-4 py-3">{row.leads_created}</td>
                  <td className="px-4 py-3">{row.leads_purchased}</td>
                  <td className="px-4 py-3">{row.coins_spent}</td>
                </tr>
              ))}
              {!dashboard.pages.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Ainda nao ha eventos SEO nesse periodo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="border-b border-white/10 p-4">
          <h2 className="text-lg font-black">Servico/cidade que converte</h2>
          <p className="text-xs text-slate-400">Bom para decidir quais paginas organicas escalar primeiro.</p>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {dashboard.services.slice(0, 12).map((row) => (
            <div key={`${row.service_category}-${row.service_city}`} className="rounded-2xl border border-white/10 bg-[#0E1C32] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-white">{row.service_category}</p>
                  <p className="text-sm text-slate-400">{row.service_city}</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                  {percent(row.leads_purchased, row.visits)} compra/visita
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-400">
                <div><p className="text-lg font-black text-white">{row.visits}</p>visitas</div>
                <div><p className="text-lg font-black text-white">{row.signups}</p>cadastros</div>
                <div><p className="text-lg font-black text-white">{row.leads_created}</p>pedidos</div>
                <div><p className="text-lg font-black text-white">{row.coins_spent}</p>moedas</div>
              </div>
            </div>
          ))}
          {!dashboard.services.length && (
            <div className="rounded-2xl border border-white/10 p-6 text-center text-sm text-slate-400 md:col-span-2">
              Nenhum servico/cidade medido ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
