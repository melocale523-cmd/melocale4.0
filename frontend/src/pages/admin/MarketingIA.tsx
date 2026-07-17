import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ImagePlus, Send, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
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
  created_at: string;
};

type FormState = { objective: Objective; audience: Audience; format: ContentFormat; topic: string; city: string; service: string; research: boolean };
const initialForm: FormState = { objective: 'education', audience: 'client', format: 'carousel', topic: '', city: 'Salvador', service: '', research: false };

const objectiveLabel: Record<Objective, string> = { reach: 'Alcance', client_leads: 'Clientes', professional_signup: 'Profissionais', trust: 'Confiança', education: 'Educação' };

export default function MarketingIA() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const contentQuery = useQuery({
    queryKey: ['admin-social-content'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/social-content');
      if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar o Marketing IA.');
      return await response.json() as { items: ContentItem[]; visual_enabled: boolean; research_enabled: boolean };
    },
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-social-content'] });
  const generateDraft = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/admin/social-content', { method: 'POST', body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível gerar o rascunho.');
      return body as { item: ContentItem };
    },
    onSuccess: () => { toast.success('Rascunho criado para aprovação.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const generateImage = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/admin/social-content/${id}/image`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível gerar a imagem.');
      return body as { item: ContentItem };
    },
    onSuccess: () => { toast.success('Imagem adicionada ao rascunho.'); invalidate(); },
    onError: (error) => toast.error((error as Error).message),
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

  return <section className="space-y-5">
    <header className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-[#132540] p-5">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-500/20 p-2 text-violet-200"><Sparkles size={24} /></div><div><h1 className="text-2xl font-bold text-white">Marketing IA</h1><p className="mt-1 max-w-3xl text-sm text-slate-300">Claude estrutura a estratégia e a copy; Gemini/Nano Banana cria a arte. Todo conteúdo nasce como rascunho e exige aprovação antes de qualquer publicação.</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Claude: estratégia</span><span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Gemini: {contentQuery.data?.visual_enabled ? 'imagem habilitada' : 'imagem aguardando chave'}</span><span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Pesquisa web: {contentQuery.data?.research_enabled ? 'habilitada' : 'desativada'}</span></div>
    </header>

    <form onSubmit={(event) => { event.preventDefault(); generateDraft.mutate(); }} className="grid gap-3 rounded-xl border border-[#1C3050] bg-[#132540] p-4 md:grid-cols-2">
      <label className="text-sm text-slate-300">Tema<input required maxLength={240} value={form.topic} onChange={(event) => update('topic', event.target.value)} placeholder="Ex.: O que fazer quando o chuveiro para de esquentar" className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
      <label className="text-sm text-slate-300">Objetivo<select value={form.objective} onChange={(event) => update('objective', event.target.value as Objective)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400">{Object.entries(objectiveLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm text-slate-300">Público<select value={form.audience} onChange={(event) => update('audience', event.target.value as Audience)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400"><option value="client">Cliente</option><option value="professional">Profissional</option><option value="mixed">Misto</option></select></label>
      <label className="text-sm text-slate-300">Formato<select value={form.format} onChange={(event) => update('format', event.target.value as ContentFormat)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400"><option value="carousel">Carrossel</option><option value="reel">Reel</option><option value="story">Story</option><option value="feed">Feed</option><option value="article">Artigo</option></select></label>
      <label className="text-sm text-slate-300">Cidade<input maxLength={100} value={form.city} onChange={(event) => update('city', event.target.value)} className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
      <label className="text-sm text-slate-300">Serviço<input maxLength={100} value={form.service} onChange={(event) => update('service', event.target.value)} placeholder="Ex.: Eletricista" className="mt-1 w-full rounded-lg border border-[#29415f] bg-[#0E1C32] px-3 py-2 text-white outline-none focus:border-violet-400" /></label>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#1C3050] pt-3"><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.research} disabled={!contentQuery.data?.research_enabled} onChange={(event) => update('research', event.target.checked)} /> Usar pesquisa web para encontrar dúvidas e referências públicas</label><button disabled={generateDraft.isPending || !form.topic.trim()} className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><Sparkles size={16} />{generateDraft.isPending ? 'Gerando…' : 'Criar rascunho'}</button></div>
    </form>

    {contentQuery.isLoading && <p className="text-slate-400">Carregando rascunhos…</p>}
    {contentQuery.error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{(contentQuery.error as Error).message}</div>}
    <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-[#1C3050] bg-[#132540]">
      {item.image_url && <img src={item.image_url} alt="Arte gerada para aprovação" className="h-64 w-full object-cover" />}
      <div className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-300">{objectiveLabel[item.objective]} · {item.format}</p><h2 className="mt-1 text-lg font-bold text-white">{item.title}</h2><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString('pt-BR')} · {item.generation_status}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : item.status === 'rejected' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-200'}`}>{item.status}</span></div>
      {item.generation_status === 'ready' && <><div className="rounded-lg bg-[#0E1C32] p-3"><p className="text-sm font-semibold text-white">{item.content.hook}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.content.caption}</p><p className="mt-2 text-sm font-semibold text-emerald-300">{item.content.cta}</p></div><details className="rounded-lg border border-[#29415f] p-3 text-sm text-slate-300"><summary className="cursor-pointer font-medium text-slate-200">Roteiro e regras de segurança</summary><ol className="mt-2 list-decimal space-y-1 pl-5">{item.content.slides?.map((slide, index) => <li key={`${slide.heading}-${index}`}><strong>{slide.heading}:</strong> {slide.body}</li>)}</ol>{item.safety_notes.length > 0 && <div className="mt-3 flex gap-2 text-xs text-amber-200"><ShieldCheck size={16} className="shrink-0" /><span>{item.safety_notes.join(' · ')}</span></div>}</details>
      <div className="flex flex-wrap gap-2"><button disabled={generateImage.isPending || !contentQuery.data?.visual_enabled} onClick={() => generateImage.mutate(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-violet-400/40 px-3 py-2 text-sm font-medium text-violet-200 disabled:opacity-50"><ImagePlus size={16} />{item.image_url ? 'Gerar nova arte' : 'Gerar arte'}</button>{item.status === 'draft' && <><button disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'approved' })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Aprovar</button><button disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'rejected' })} className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 px-3 py-2 text-sm font-medium text-red-200"><XCircle size={16} /> Rejeitar</button></>}{item.status === 'approved' && item.image_url && <button disabled={publishInstagram.isPending} onClick={() => { if (window.confirm('Publicar esta arte e legenda aprovadas no Instagram da MeloCalé?')) publishInstagram.mutate(item.id); }} className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />{publishInstagram.isPending ? 'Publicando...' : 'Publicar no Instagram'}</button>}{item.status === 'published' && <span className="inline-flex items-center rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300">Publicado no Instagram</span>}</div></>}
      {item.generation_status === 'failed' && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">A geração foi bloqueada ou falhou. Revise as notas de segurança antes de tentar novamente.</p>}{item.publication_error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">Falha na publicação: {item.publication_error}</p>}
      </div></article>)}</div>
    {!contentQuery.isLoading && !items.length && <div className="rounded-xl border border-dashed border-[#29415f] p-8 text-center text-slate-400">Ainda não há rascunhos. Crie a primeira pauta acima.</div>}
  </section>;
}