import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, ExternalLink, Palette, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';

type HighlightPack = { id: string; name: string; slug: string; category: string; description: string; cover_color: string; cover_logo_url: string | null; stories: Array<{ id: number; text: string }>; status: 'draft' | 'ready' | 'published' | 'archived'; last_error: string | null };
type BrandKit = { logoUrl: string; colors: { navy: string; royalBlue: string; cyan: string; emerald: string; ice: string; coral: string } };

const STYLES = [
  { id: 'editorial', label: 'Editorial', shape: 'rounded' },
  { id: 'minimal', label: 'Minimalista', shape: 'square' },
  { id: 'bold', label: 'Impacto', shape: 'circle' },
  { id: 'seasonal', label: 'Sazonal', shape: 'spark' },
] as const;
const SEASONS = ['Sempre ativo', 'Verao', 'Casa segura', 'Black Friday', 'Fim de ano'];
const SYMBOLS: Record<string, string> = { start: '*', clients: '+', professionals: '#', services: '~', safety: 'OK', brand: 'M' };

function CoverArtwork({ pack, logoUrl, styleId, seasonalTag, vertical = false }: { pack: HighlightPack; logoUrl?: string; styleId: string; seasonalTag: string; vertical?: boolean }) {
  const symbol = SYMBOLS[pack.category] ?? SYMBOLS.brand;
  const style = STYLES.find((item) => item.id === styleId) ?? STYLES[0];
  const radius = style.shape === 'circle' ? '9999px' : style.shape === 'square' ? '18px' : '34px';
  return <div className={vertical ? 'relative flex h-[460px] w-[260px] shrink-0 flex-col justify-between overflow-hidden p-6 shadow-2xl' : 'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden shadow-lg'} style={{ borderRadius: radius, background: `linear-gradient(145deg, ${pack.cover_color}, #06182f)` }}>
    <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full border border-white/20 bg-white/10" />
    <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full border border-white/10 bg-black/10" />
    <div className={vertical ? 'relative z-10 flex items-center justify-between' : 'relative z-10 flex h-full w-full flex-col items-center justify-center'}>
      {vertical && <span className="text-xs font-black tracking-[0.2em] text-white/80">MELOCAL� � BRASIL</span>}
      <span className={vertical ? 'text-4xl font-black text-white' : 'text-lg font-black leading-none text-white'}>{symbol}</span>
    </div>
    <div className={vertical ? 'relative z-10' : 'relative z-10 text-center'}>
      <p className={vertical ? 'text-3xl font-black leading-tight text-white' : 'max-w-[48px] truncate text-[6px] font-black tracking-[0.06em] text-white'}>{pack.name}</p>
      {vertical && <p className="mt-3 text-sm font-medium text-white/80">{seasonalTag === 'Sempre ativo' ? pack.description : seasonalTag}</p>}
    </div>
    <img src={logoUrl} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/apple-touch-icon.png'; }} alt="Logo MeloCal�" className={vertical ? 'relative z-10 mt-6 h-14 w-14 rounded-2xl border-2 border-white/70 object-cover' : 'absolute bottom-1 right-1 z-20 h-4 w-4 rounded-full border border-white/70 object-cover'} />
  </div>;
}

export default function MarketingHighlights() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<HighlightPack | null>(null);
  const [styleId, setStyleId] = useState('editorial');
  const [seasonalTag, setSeasonalTag] = useState(SEASONS[0]);
  const [draft, setDraft] = useState({ name: '', description: '', color: '#0B3D91' });
  const storyQuery = useQuery({ queryKey: ['admin-social-story-availability'], queryFn: async () => { const response = await apiFetch('/api/admin/social-content?limit=100'); if (!response.ok) return { items: [] as Array<{ format: string; status: string; generation_status: string; image_url: string | null }> }; return await response.json() as { items: Array<{ format: string; status: string; generation_status: string; image_url: string | null }> }; } });
  const query = useQuery({ queryKey: ['admin-social-highlights'], queryFn: async () => { const response = await apiFetch('/api/admin/social-content/highlights'); if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar Destaques.'); return await response.json() as { packs: HighlightPack[]; brand_kit: BrandKit }; } });
  const bootstrap = useMutation({ mutationFn: async () => { const response = await apiFetch('/api/admin/social-content/highlights/bootstrap', { method: 'POST' }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Falha ao preparar Destaques.'); return body as { created: number }; }, onSuccess: (body) => { toast.success(body.created ? body.created + ' pacotes preparados.' : 'Os pacotes j� est�o preparados.'); queryClient.invalidateQueries({ queryKey: ['admin-social-highlights'] }); }, onError: (error) => toast.error((error as Error).message) });
  const archive = useMutation({ mutationFn: async (id: string) => { const response = await apiFetch('/api/admin/social-content/highlights/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Falha ao arquivar Destaque.'); return body; }, onSuccess: () => { toast.success('Destaque arquivado.'); queryClient.invalidateQueries({ queryKey: ['admin-social-highlights'] }); }, onError: (error) => toast.error((error as Error).message) });
  const publishStories = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch('/api/admin/social-content/highlights/' + id + '/publish-stories', { method: 'POST', body: JSON.stringify({}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Falha ao publicar os Stories.');
      return body as { published_count: number; highlight_action?: string };
    },
    onSuccess: (body) => { toast.success(body.highlight_action ?? (body.published_count + ' Stories publicados.')); queryClient.invalidateQueries({ queryKey: ['admin-social-highlights'] }); },
    onError: (error) => toast.error((error as Error).message),
  });
  const save = useMutation({ mutationFn: async () => { if (!editing) return; const response = await apiFetch('/api/admin/social-content/highlights/' + editing.id, { method: 'PATCH', body: JSON.stringify({ name: draft.name, description: draft.description, cover_color: draft.color }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Falha ao salvar capa.'); return body; }, onSuccess: () => { toast.success('Capa personalizada salva.'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['admin-social-highlights'] }); }, onError: (error) => toast.error((error as Error).message) });
  const availableStoryCount = (storyQuery.data?.items ?? []).filter((item) => item.format === 'story' && item.status === 'approved' && item.generation_status === 'ready' && Boolean(item.image_url)).length;
  const packs = query.data?.packs ?? [];
  const kit = query.data?.brand_kit;
  const previewPack = useMemo(() => editing ? { ...editing, name: draft.name, description: draft.description, cover_color: draft.color } : null, [editing, draft]);

  function openEditor(pack: HighlightPack) {
    setEditing(pack);
    setDraft({ name: pack.name, description: pack.description, color: pack.cover_color });
    setStyleId('editorial');
    setSeasonalTag(SEASONS[0]);
  }

  function randomize() {
    if (!editing) return;
    const next = STYLES[Math.floor(Math.random() * STYLES.length)];
    const colors = [kit?.colors.navy, kit?.colors.royalBlue, kit?.colors.cyan, kit?.colors.emerald, kit?.colors.coral].filter(Boolean) as string[];
    setStyleId(next.id);
    setDraft((current) => ({ ...current, color: colors[Math.floor(Math.random() * colors.length)] ?? current.color }));
    toast.success('Nova varia��o pronta para revis�o.');
  }

  function downloadCover() {
    if (!previewPack) return;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="100%" height="100%" fill="#092D86"/></svg>';
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a'); link.href = url; link.download = previewPack.slug + '-capa.svg'; link.click(); URL.revokeObjectURL(url);
  }

  return <section className="rounded-2xl border border-cyan-400/20 bg-[#102342] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-lg font-bold text-white"><Palette size={19} className="text-cyan-300" /> Destaques do Instagram</div><p className="mt-1 max-w-3xl text-sm text-slate-300">Capas personalizadas, estilos sazonais e prévia vertical com a identidade MeloCalé.</p></div><button type="button" onClick={() => bootstrap.mutate()} disabled={bootstrap.isPending} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-[#06203d] disabled:opacity-50"><Sparkles size={16} />{bootstrap.isPending ? 'Preparando...' : packs.length ? 'Atualizar pacotes' : 'Criar pacotes padrao'}</button></div>
    {!storyQuery.isLoading && availableStoryCount === 0 && <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Crie um Story em Marketing IA, gere a arte e aprove-o. Depois ele aparecera aqui para publicacao.</p>}
    {kit && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300"><span className="font-semibold text-white">Brand Kit:</span>{Object.entries(kit.colors).map(([name, color]) => <span key={name} title={name} className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-1"><i className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: color }} />{name}</span>)}</div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{packs.map((pack) => <article key={pack.id} className="rounded-xl border border-white/10 bg-[#0B1B34] p-3"><div className="flex items-center gap-3"><CoverArtwork pack={pack} logoUrl={pack.cover_logo_url ?? kit?.logoUrl} styleId="editorial" seasonalTag="Sempre ativo" /><div className="min-w-0"><h3 className="font-semibold text-white">{pack.name}</h3><p className="text-xs text-slate-400">{pack.stories.length} Stories - {pack.status === 'ready' ? 'pronto' : pack.status}</p></div></div><p className="mt-3 min-h-10 text-xs leading-5 text-slate-300">{pack.description}</p><div className="mt-3 flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => openEditor(pack)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 px-2.5 py-1.5 text-xs font-semibold text-cyan-100"><Palette size={14} />Personalizar</button><button type="button" onClick={() => { if (window.confirm('Publicar os Stories aprovados disponiveis neste pacote?')) publishStories.mutate(pack.id); }} disabled={publishStories.isPending || storyQuery.isLoading || availableStoryCount === 0} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"><Send size={14} />{publishStories.isPending ? 'Publicando...' : availableStoryCount ? 'Publicar Stories' : 'Sem Stories prontos'}</button><button type="button" onClick={() => window.open('https://www.instagram.com/melocale.app/', '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded-lg border border-pink-400/40 px-2.5 py-1.5 text-xs font-semibold text-pink-200"><ExternalLink size={14} />Abrir Instagram</button><button type="button" onClick={() => { if (window.confirm('Arquivar o Destaque ' + pack.name + '?')) archive.mutate(pack.id); }} disabled={archive.isPending} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-2.5 py-1.5 text-xs font-semibold text-red-200"><Archive size={14} />Arquivar</button></div>{pack.last_error && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-200">{pack.last_error}</p>}</article>)}</div>
    {editing && previewPack && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[95vh] w-full max-w-4xl overflow-auto rounded-2xl border border-cyan-400/30 bg-[#102342] p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-white">Personalizar capa</h2><button type="button" onClick={() => setEditing(null)} className="text-slate-300"><X /></button></div><div className="mt-4 grid gap-6 md:grid-cols-[260px_1fr]"><div className="flex justify-center"><CoverArtwork pack={previewPack} logoUrl={previewPack.cover_logo_url ?? kit?.logoUrl} styleId={styleId} seasonalTag={seasonalTag} vertical /></div><div className="space-y-4"><label className="block text-sm text-slate-200">Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1B34] px-3 py-2 text-white" /></label><label className="block text-sm text-slate-200">Descri��o<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border border-white/10 bg-[#0B1B34] px-3 py-2 text-white" /></label><label className="block text-sm text-slate-200">Cor principal<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} className="mt-1 block h-10 w-20 rounded border-0 bg-transparent" /></label><label className="block text-sm text-slate-200">Estilo<select value={styleId} onChange={(event) => setStyleId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1B34] px-3 py-2 text-white">{STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label><label className="block text-sm text-slate-200">Tema sazonal<select value={seasonalTag} onChange={(event) => setSeasonalTag(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1B34] px-3 py-2 text-white">{SEASONS.map((season) => <option key={season}>{season}</option>)}</select></label><div className="flex flex-wrap gap-2"><button type="button" onClick={randomize} className="inline-flex items-center gap-2 rounded-lg border border-purple-400/40 px-3 py-2 text-sm font-semibold text-purple-100"><RefreshCw size={15} />Gerar varia��o</button><button type="button" onClick={downloadCover} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white"><Download size={15} />Exportar capa</button><button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-[#06203d] disabled:opacity-50">{save.isPending ? 'Salvando...' : 'Salvar capa'}</button></div></div></div></div></div>}
  </section>;
}
