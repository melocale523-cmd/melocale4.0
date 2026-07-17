import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, CheckSquare, ImagePlus, LoaderCircle, Play, Send, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';

type Objective = 'reach' | 'client_leads' | 'professional_signup' | 'trust' | 'education';
type Audience = 'client' | 'professional' | 'mixed';
type ContentFormat = 'reel' | 'carousel' | 'story' | 'feed' | 'article';
type ContentItem = {
  id: string;
  title: string;
  objective: Objective;
  audience: Audience;
  city: string | null;
  service: string | null;
  format: ContentFormat;
  status: 'draft' | 'approved' | 'rejected' | 'published';
  generation_status: 'pending' | 'generating' | 'ready' | 'failed';
  content: { hook?: string; caption?: string; cta?: string; slides?: Array<{ heading: string; body: string }> };
  visual_prompt: string | null;
  image_url: string | null;
  estimated_cost_cents: number;
  safety_notes: string[];
  instagram_media_id: string | null;
  publication_error: string | null;
  published_at: string | null;
  automation_note?: string | null;
  created_at: string;
};

type FormState = { objective: Objective; audience: Audience; format: ContentFormat; topic: string; city: string; service: string; research: boolean };
type CampaignForm = { name: string; city: string; service: string; objective: Objective; audience: Audience; posts_per_week: number; budget_cents: number; research: boolean; auto_generate: boolean; auto_generate_images: boolean; trend_radar_enabled: boolean };
type Campaign = { id: string; name: string; city: string; service: string | null; status: 'active' | 'paused' | 'archived'; auto_generate: boolean; posts_per_week: number; research_enabled: boolean };
const initialForm: FormState = { objective: 'education', audience: 'client', format: 'carousel', topic: '', city: 'Salvador', service: '', research: false };
const initialCampaign: CampaignForm = { name: '', city: 'Salvador', service: '', objective: 'education', audience: 'mixed', posts_per_week: 3, budget_cents: 0, research: true, auto_generate: true, auto_generate_images: true, trend_radar_enabled: true };

const objectiveLabel: Record<Objective, string> = { reach: 'Alcance', client_leads: 'Clientes', professional_signup: 'Profissionais', trust: 'Confiança', education: 'Educação' };

export default function MarketingIA() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [automationPhase, setAutomationPhase] = useState<'copy' | 'image' | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(initialCampaign);
  const contentQuery = useQuery({
    queryKey: ['admin-social-content'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/social-content');
      if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar o Marketing IA.');
      return await response.json() as { items: ContentItem[]; visual_enabled: boolean; research_enabled: boolean };
    },
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-social-content'] });
  const overviewQuery = useQuery({
    queryKey: ['admin-social-content-overview'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/social-content/overview');
      if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar metricas.');
      return await response.json() as { metrics: { total: number; drafts: number; approved: number; published: number; failed: number; estimated_cost_cents: number } };
    },
  });
  const campaignsQuery = useQuery({
    queryKey: ['admin-social-campaigns'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/social-content/campaigns');
      if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar campanhas.');
      return await response.json() as { campaigns: Campaign[]; autopilot_enabled: boolean };
    },
  });
  const createCampaign = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/admin/social-content/campaigns', { method: 'POST', body: JSON.stringify(campaignForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Falha ao criar campanha.');
      return body as { planned_count: number };
    },
    onSuccess: (body) => {
      toast.success(String(body.planned_count) + ' pautas planejadas.');
      setCampaignForm(initialCampaign);
      campaignsQuery.refetch();
      invalidate();
      overviewQuery.refetch();
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const toggleCampaign = useMutation({
    mutationFn: async ({ id, status, auto_generate }: { id: string; status: Campaign['status']; auto_generate: boolean }) => {
      const response = await apiFetch('/api/admin/social-content/campaigns/' + id, { method: 'PATCH', body: JSON.stringify({ status, auto_generate }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Falha ao atualizar campanha.');
      return body;
    },
    onSuccess: () => { toast.success('Campanha atualizada.'); campaignsQuery.refetch(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const runAutopilot = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/admin/social-content/autopilot/run', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Falha ao executar o autopilot.');
      return body as { processed: number };
    },
    onSuccess: (body) => { toast.success(body.processed ? String(body.processed) + ' pauta(s) processada(s).' : 'Nenhuma pauta vencida para processar.'); invalidate(); overviewQuery.refetch(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const batchApprove = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/admin/social-content/batch-status', { method: 'PATCH', body: JSON.stringify({ ids: selectedIds, status: 'approved' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Falha ao aprovar em lote.');
      return body as { updated: number };
    },
    onSuccess: (body) => { setSelectedIds([]); toast.success(String(body.updated) + ' pauta(s) aprovada(s).'); invalidate(); overviewQuery.refetch(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const generateDraft = useMutation({
    mutationFn: async () => {
      setAutomationPhase('copy');
      const response = await apiFetch('/api/admin/social-content', { method: 'POST', body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível gerar o conteúdo.');
      const draft = body as { item: ContentItem };
      if (draft.item.id && contentQuery.data?.visual_enabled !== false) {
        setAutomationPhase('image');
        setGeneratingImageId(draft.item.id);
        const imageResponse = await apiFetch('/api/admin/social-content/' + draft.item.id + '/image', { method: 'POST' });
        const imageBody = await imageResponse.json();
        if (!imageResponse.ok) throw new Error(imageBody.error ?? 'Copy criada, mas não foi possível gerar a arte.');
        return imageBody as { item: ContentItem };
      }
      return draft;
    },
    onSuccess: () => { toast.success('Conteúdo completo pronto para sua aprovação.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
    onSettled: () => { setAutomationPhase(null); setGeneratingImageId(null); },
  });
  const generateImage = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/admin/social-content/${id}/image`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível gerar a imagem.');
      return body as { item: ContentItem };
    },
    onMutate: (id) => setGeneratingImageId(id),
    onSuccess: () => { toast.success('Imagem adicionada ao rascunho.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
    onSettled: () => setGeneratingImageId(null),
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const response = await apiFetch(`/api/admin/social-content/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível atualizar o rascunho.');
      return body as { item: ContentItem };
    },
    onSuccess: (_, variables) => { toast.success(variables.status === 'approved' ? 'Conteúdo aprovado.' : 'Conteúdo rejeitado.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const approveAndPublish = useMutation({
    mutationFn: async (id: string) => {
      const approvalResponse = await apiFetch('/api/admin/social-content/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
      const approvalBody = await approvalResponse.json();
      if (!approvalResponse.ok) throw new Error(approvalBody.error ?? 'Não foi possível aprovar o conteúdo.');
      const publishResponse = await apiFetch('/api/admin/social-content/' + id + '/publish-instagram', { method: 'POST' });
      const publishBody = await publishResponse.json();
      if (!publishResponse.ok) throw new Error(publishBody.error ?? 'Conteúdo aprovado, mas não foi possível publicar.');
      return publishBody as { item: ContentItem; instagram_media_id: string };
    },
    onSuccess: () => { toast.success('Conteúdo aprovado e publicado no Instagram.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const publishInstagram = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/admin/social-content/${id}/publish-instagram`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível publicar no Instagram.');
      return body as { item: ContentItem; instagram_media_id: string };
    },
    onSuccess: () => { toast.success('Conteúdo publicado no Instagram.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const items = contentQuery.data?.items ?? [];
  const metrics = overviewQuery.data?.metrics;

  return <section className="space-y-5">
    <header className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-[#132540] p-5">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-500/20 p-2 text-violet-200"><Sparkles size={24} /></div><div><h1 className="text-2xl font-bold text-white">Marketing IA</h1><p className="mt-1 max-w-3xl text-sm text-slate-300">A MeloCalé prepara a pauta, a copy e a arte automaticamente. Você só revisa e aprova antes da publicação.</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Claude: estratégia</span><span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Gemini: {contentQuery.data?.visual_enabled ? 'imagem habilitada' : 'imagem aguardando chave'}</span><span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Pesquisa web: {contentQuery.data?.research_enabled ? 'habilitada' : 'desativada'}</span></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        ['Pautas', metrics?.total ?? 0],
        ['Aguardando aprovacao', metrics?.drafts ?? 0],
        ['Aprovadas', metrics?.approved ?? 0],
        ['Publicadas', metrics?.published ?? 0],
        ['Falhas', metrics?.failed ?? 0],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#1C3050] bg-[#132540] p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-bold text-white">{value}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2 text-sm text-emerald-100"><BarChart3 size={18} /><span>Autopilot: gera pautas, artes e variacoes; publicar continua exigindo sua aprovacao.</span></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => runAutopilot.mutate()} disabled={runAutopilot.isPending} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50"><Play size={15} />{runAutopilot.isPending ? 'Processando...' : 'Executar agora'}</button>
        <button type="button" onClick={() => batchApprove.mutate()} disabled={!selectedIds.length || batchApprove.isPending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckSquare size={15} />Aprovar selecionadas ({selectedIds.length})</button>
      </div>
    </div>

    <section className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-white">Assistente de campanha</h2><p className="mt-1 text-sm text-slate-300">Cria o calendario de pautas e deixa o autopilot preparar os conteudos no ritmo escolhido.</p></div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">{campaignsQuery.data?.autopilot_enabled ? 'Worker automatico ativo' : 'Worker automatico desligado no Render'}</span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); createCampaign.mutate(); }} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-300">Nome da campanha<input required maxLength={120} value={campaignForm.name} onChange={(event) => setCampaignForm((c) => ({ ...c, name: event.target.value }))} placeholder="Ex.: Salvador - eletrica e confianca" className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
        <label className="text-sm text-slate-300">Cidade<input required maxLength={100} value={campaignForm.city} onChange={(event) => setCampaignForm((c) => ({ ...c, city: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
        <label className="text-sm text-slate-300">Servico<input maxLength={100} value={campaignForm.service} onChange={(event) => setCampaignForm((c) => ({ ...c, service: event.target.value }))} placeholder="Ex.: Eletricista" className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
        <label className="text-sm text-slate-300">Publico<select value={campaignForm.audience} onChange={(event) => setCampaignForm((c) => ({ ...c, audience: event.target.value as Audience }))} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white"><option value="mixed">Misto</option><option value="client">Clientes</option><option value="professional">Profissionais</option></select></label>
        <label className="text-sm text-slate-300">Objetivo<select value={campaignForm.objective} onChange={(event) => setCampaignForm((c) => ({ ...c, objective: event.target.value as Objective }))} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white">{Object.entries(objectiveLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm text-slate-300">Posts por semana<select value={campaignForm.posts_per_week} onChange={(event) => setCampaignForm((c) => ({ ...c, posts_per_week: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white"><option value={1}>1 post</option><option value={2}>2 posts</option><option value={3}>3 posts</option><option value={4}>4 posts</option><option value={5}>5 posts</option><option value={7}>7 posts</option></select></label>
        <label className="text-sm text-slate-300">Orcamento total da campanha (R$)<input type="number" min={0} max={10000} step={1} value={campaignForm.budget_cents / 100} onChange={(event) => setCampaignForm((c) => ({ ...c, budget_cents: Math.round(Number(event.target.value || 0) * 100) }))} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white" /></label>
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={campaignForm.research} onChange={(event) => setCampaignForm((c) => ({ ...c, research: event.target.checked }))} /> Pesquisa web</label>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={campaignForm.auto_generate_images} onChange={(event) => setCampaignForm((c) => ({ ...c, auto_generate_images: event.target.checked }))} /> Gerar artes</label>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={campaignForm.trend_radar_enabled} onChange={(event) => setCampaignForm((c) => ({ ...c, trend_radar_enabled: event.target.checked }))} /> Radar de tendencias</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><input type="checkbox" checked={campaignForm.auto_generate} onChange={(event) => setCampaignForm((c) => ({ ...c, auto_generate: event.target.checked }))} /> Ativar autopilot agora</label>
        </div>
        <button disabled={createCampaign.isPending || !campaignForm.name.trim() || !campaignForm.city.trim()} className="inline-flex w-fit items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 font-semibold text-white disabled:opacity-50"><Sparkles size={16} />{createCampaign.isPending ? 'Criando campanha...' : 'Criar campanha automatica'}</button>
      </form>
      {(campaignsQuery.data?.campaigns ?? []).length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Campanhas existentes</p>{campaignsQuery.data?.campaigns.map((campaign) => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#29415f] bg-[#0E1C32] p-3"><div><p className="font-semibold text-white">{campaign.name}</p><p className="text-xs text-slate-400">{campaign.city}{campaign.service ? ' � ' + campaign.service : ''} � {campaign.posts_per_week} posts/semana</p></div><button type="button" onClick={() => toggleCampaign.mutate({ id: campaign.id, status: campaign.status === 'active' && campaign.auto_generate ? 'paused' : 'active', auto_generate: !(campaign.status === 'active' && campaign.auto_generate) })} className="rounded-lg border border-emerald-400/40 px-3 py-2 text-sm font-semibold text-emerald-200">{campaign.status === 'active' && campaign.auto_generate ? 'Pausar autopilot' : 'Ativar autopilot'}</button></div>)}</div>}
    </section>
    <form onSubmit={(event) => { event.preventDefault(); generateDraft.mutate(); }} className="grid gap-3 rounded-xl border border-[#1C3050] bg-[#132540] p-4 md:grid-cols-2">
      <label className="text-sm text-slate-300">Tema<input required maxLength={240} value={form.topic} onChange={(event) => update('topic', event.target.value)} placeholder="Ex.: O que fazer quando o chuveiro para de esquentar" className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
      <label className="text-sm text-slate-300">Objetivo<select value={form.objective} onChange={(event) => update('objective', event.target.value as Objective)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400">{Object.entries(objectiveLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm text-slate-300">Público<select value={form.audience} onChange={(event) => update('audience', event.target.value as Audience)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400"><option value="client">Cliente</option><option value="professional">Profissional</option><option value="mixed">Misto</option></select></label>
      <label className="text-sm text-slate-300">Formato<select value={form.format} onChange={(event) => update('format', event.target.value as ContentFormat)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400"><option value="carousel">Carrossel</option><option value="reel">Reel</option><option value="story">Story</option><option value="feed">Feed</option><option value="article">Artigo</option></select></label>
      <label className="text-sm text-slate-300">Cidade<input maxLength={100} value={form.city} onChange={(event) => update('city', event.target.value)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
      <label className="text-sm text-slate-300">Serviço<input maxLength={100} value={form.service} onChange={(event) => update('service', event.target.value)} placeholder="Ex.: Eletricista" className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#1C3050] pt-3"><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.research} disabled={!contentQuery.data?.research_enabled} onChange={(event) => update('research', event.target.checked)} /> Usar pesquisa web para encontrar dúvidas e referências públicas</label><button disabled={generateDraft.isPending || !form.topic.trim()} className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><Sparkles size={16} />{generateDraft.isPending ? automationPhase === 'image' ? 'Processando imagem…' : 'Gerando conteúdo…' : 'Criar conteúdo completo'}</button></div>
    </form>

    {contentQuery.isLoading && <p className="text-slate-400">Carregando rascunhos…</p>}
    {contentQuery.error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{(contentQuery.error as Error).message}</div>}
    <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <article key={item.id} className="relative overflow-hidden rounded-xl border border-[#1C3050] bg-[#132540]">
      {item.status === 'draft' && <label className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-[#0E1C32]/90 px-2 py-1 text-xs text-slate-200"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /> selecionar</label>}
      {generatingImageId === item.id && <div className="flex items-center gap-3 border-b border-violet-400/20 bg-violet-500/10 px-4 py-3 text-violet-100"><LoaderCircle size={18} className="animate-spin" /><div><p className="text-sm font-semibold">Processando imagem…</p><p className="text-xs text-violet-200/80">A MeloCalé está criando uma arte realista e alinhada à marca. Isso pode levar até 90 segundos.</p></div></div>}
      {item.image_url && <img src={item.image_url} alt="Arte gerada para aprovação" className="h-64 w-full object-cover" />}
      <div className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-300">{objectiveLabel[item.objective]} · {item.format}</p><h2 className="mt-1 text-lg font-bold text-white">{item.title}</h2><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString('pt-BR')} · {item.generation_status}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : item.status === 'rejected' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-200'}`}>{item.status}</span></div>
      {item.generation_status === 'ready' && <><div className="rounded-lg bg-[#0E1C32] p-3"><p className="text-sm font-semibold text-white">{item.content.hook}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.content.caption}</p><p className="mt-2 text-sm font-semibold text-emerald-300">{item.content.cta}</p></div><details className="rounded-lg border border-[#29415f] p-3 text-sm text-slate-300"><summary className="cursor-pointer font-medium text-slate-200">Roteiro e regras de segurança</summary><ol className="mt-2 list-decimal space-y-1 pl-5">{item.content.slides?.map((slide, index) => <li key={`${slide.heading}-${index}`}><strong>{slide.heading}:</strong> {slide.body}</li>)}</ol>{item.safety_notes.length > 0 && <div className="mt-3 flex gap-2 text-xs text-amber-200"><ShieldCheck size={16} className="shrink-0" /><span>{item.safety_notes.join(' · ')}</span></div>}</details>
      <div className="flex flex-wrap gap-2"><button disabled={generateImage.isPending || !contentQuery.data?.visual_enabled} onClick={() => generateImage.mutate(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-violet-400/40 px-3 py-2 text-sm font-medium text-violet-200 disabled:opacity-50">{generatingImageId === item.id ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}{generatingImageId === item.id ? 'Processando imagem…' : item.image_url ? 'Gerar nova arte' : 'Gerar arte'}</button>{item.status === 'draft' && <><button disabled={updateStatus.isPending || approveAndPublish.isPending || (Boolean(item.image_url) && !contentQuery.data?.visual_enabled)} onClick={() => item.image_url ? approveAndPublish.mutate(item.id) : updateStatus.mutate({ id: item.id, status: 'approved' })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"><CheckCircle2 size={16} /> {item.image_url ? approveAndPublish.isPending ? 'Publicando…' : 'Aprovar e publicar' : 'Aprovar'}</button><button disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'rejected' })} className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 px-3 py-2 text-sm font-medium text-red-200"><XCircle size={16} /> Rejeitar</button></>}{item.status === 'approved' && item.image_url && <button disabled={publishInstagram.isPending} onClick={() => { if (window.confirm('Publicar esta arte e legenda aprovadas no Instagram da MeloCalé?')) publishInstagram.mutate(item.id); }} className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />{publishInstagram.isPending ? 'Publicando...' : 'Publicar no Instagram'}</button>}{item.status === 'published' && <span className="inline-flex items-center rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300">Publicado no Instagram</span>}</div></>}
      {item.automation_note && <p className="rounded-lg bg-violet-500/10 p-3 text-xs text-violet-200">{item.automation_note}</p>}{item.generation_status === 'failed' && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">A geração foi bloqueada ou falhou. Revise as notas de segurança antes de tentar novamente.</p>}{item.publication_error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">Falha na publicação: {item.publication_error}</p>}
      </div></article>)}</div>
    {!contentQuery.isLoading && !items.length && <div className="rounded-xl border border-dashed border-[#29415f] p-8 text-center text-slate-400">Ainda não há rascunhos. Crie a primeira pauta acima.</div>}
  </section>;
}