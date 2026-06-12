import { useState, useEffect } from 'react';
import { X, Loader2, ImagePlus, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { compressImage } from '../lib/compressImage';

export interface WizardData {
  title: string;
  category: string;
  description: string;
  location: string;
  budget_min: string;
  budget_max: string;
  images: string[];
  urgency: 'hoje' | 'semana' | 'mes' | 'sem_pressa';
  work_size: 'pequeno' | 'medio' | 'grande' | 'projeto';
  availability: 'manha' | 'tarde' | 'noite' | 'qualquer';
  local_condition: 'vistoria' | 'medidas' | 'pronto';
  purchase_decision: 'agora' | 'pesquisando' | 'depende';
}

interface RequestWizardProps {
  onSubmit: (data: WizardData) => void;
  onClose: () => void;
  isPending: boolean;
  isUploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  initialData?: Partial<WizardData>;
}

type InternalData = Omit<WizardData, 'urgency' | 'work_size' | 'availability' | 'local_condition' | 'purchase_decision'> & {
  urgency: WizardData['urgency'] | '';
  work_size: WizardData['work_size'] | '';
  availability: WizardData['availability'] | '';
  local_condition: WizardData['local_condition'] | '';
  purchase_decision: WizardData['purchase_decision'] | '';
};

const STEP_SUBTITLES = [
  'O que você precisa?',
  'Urgência e Porte',
  'Contexto',
  'Localização e Detalhes',
];

const STEP_LABELS = ['Categoria', 'Urgência', 'Contexto', 'Detalhes'];

const FALLBACK_CATEGORIES = [
  { label: 'Pintura', icon: '🎨' },
  { label: 'Elétrica', icon: '⚡' },
  { label: 'Hidráulica', icon: '🔧' },
  { label: 'Reformas', icon: '🏗️' },
  { label: 'Jardinagem', icon: '🌿' },
  { label: 'Limpeza', icon: '🧹' },
  { label: 'Gesso', icon: '✨' },
  { label: 'Marcenaria', icon: '🪚' },
  { label: 'Outro', icon: '➕' },
];

function getCategoryIcon(slug: string): string {
  const icons: Record<string, string> = {
    'eletricista': '⚡',
    'encanador': '🔧',
    'pintor': '🎨',
    'pedreiro-construcao': '🏗️',
    'marceneiro-carpinteiro': '🪚',
    'serralheiro': '🔩',
    'vidraceiro': '🪟',
    'gesseiro-drywall': '✨',
    'impermeabilizacao': '💧',
    'ar-condicionado': '❄️',
    'dedetizacao': '🐛',
    'limpeza-residencial': '🧹',
    'jardinagem-paisagismo': '🌿',
    'mudanca-carreto': '🚛',
    'instalacao-moveis': '🛋️',
    'chaveiro': '🔑',
    'desentupimento': '🚿',
    'reforma-geral': '🏠',
    'telhado-telhadista': '🏘️',
    'piscina-manutencao': '🏊',
  };
  return icons[slug] ?? '🔨';
}

interface CatStyle { bg: string; border: string; textColor: string }
function getCategoryStyle(icon: string): CatStyle {
  const map: Record<string, CatStyle> = {
    '⚡': { bg: 'rgba(251,191,36,.1)', border: 'rgba(251,191,36,.2)', textColor: '#f59e0b' },
    '🔧': { bg: 'rgba(96,165,250,.1)', border: 'rgba(96,165,250,.2)', textColor: '#60a5fa' },
    '🎨': { bg: 'rgba(244,114,182,.1)', border: 'rgba(244,114,182,.2)', textColor: '#f472b6' },
    '❄️': { bg: 'rgba(103,232,249,.1)', border: 'rgba(103,232,249,.2)', textColor: '#67e8f9' },
    '🧹': { bg: 'rgba(52,211,153,.1)', border: 'rgba(52,211,153,.2)', textColor: '#34d399' },
    '🔑': { bg: 'rgba(167,139,250,.1)', border: 'rgba(167,139,250,.2)', textColor: '#a78bfa' },
    '🪚': { bg: 'rgba(251,146,60,.1)', border: 'rgba(251,146,60,.2)', textColor: '#fb923c' },
    '✨': { bg: 'rgba(226,232,240,.08)', border: 'rgba(226,232,240,.15)', textColor: '#e2e8f0' },
    '🏗️': { bg: 'rgba(251,146,60,.1)', border: 'rgba(251,146,60,.2)', textColor: '#fb923c' },
    '🌿': { bg: 'rgba(52,211,153,.1)', border: 'rgba(52,211,153,.2)', textColor: '#34d399' },
    '🔩': { bg: 'rgba(156,163,175,.1)', border: 'rgba(156,163,175,.2)', textColor: '#9ca3af' },
    '🪟': { bg: 'rgba(125,211,252,.1)', border: 'rgba(125,211,252,.2)', textColor: '#7dd3fc' },
    '💧': { bg: 'rgba(56,189,248,.1)', border: 'rgba(56,189,248,.2)', textColor: '#38bdf8' },
    '🐛': { bg: 'rgba(134,239,172,.1)', border: 'rgba(134,239,172,.2)', textColor: '#86efac' },
    '🚛': { bg: 'rgba(251,146,60,.1)', border: 'rgba(251,146,60,.2)', textColor: '#fb923c' },
    '🛋️': { bg: 'rgba(252,211,77,.1)', border: 'rgba(252,211,77,.2)', textColor: '#fcd34d' },
    '🚿': { bg: 'rgba(125,211,252,.1)', border: 'rgba(125,211,252,.2)', textColor: '#7dd3fc' },
    '🏠': { bg: 'rgba(251,191,36,.1)', border: 'rgba(251,191,36,.2)', textColor: '#fbbf24' },
    '🏘️': { bg: 'rgba(180,83,9,.1)', border: 'rgba(180,83,9,.2)', textColor: '#b45309' },
    '🏊': { bg: 'rgba(56,189,248,.1)', border: 'rgba(56,189,248,.2)', textColor: '#38bdf8' },
    '➕': { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.15)', textColor: '#f59e0b' },
    '🔨': { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.15)', textColor: '#f59e0b' },
  };
  return map[icon] ?? { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.15)', textColor: '#f59e0b' };
}

function getPriceHint(category: string): string | null {
  const l = category.toLowerCase();
  if (l.includes('eletric') || l.includes('elétr')) return 'R$ 120–450';
  if (l.includes('encana') || l.includes('hidráu') || l.includes('hidraul')) return 'R$ 100–380';
  if (l.includes('pint')) return 'R$ 200–800';
  if (l.includes('ar-condic') || l.includes('ar condic') || l.includes('clima')) return 'R$ 150–500';
  if (l.includes('limpez') || l.includes('faxin') || l.includes('diari')) return 'R$ 80–300';
  if (l.includes('chave')) return 'R$ 80–250';
  if (l.includes('marcen') || l.includes('carpint')) return 'R$ 200–900';
  if (l.includes('gess') || l.includes('drywall')) return 'R$ 150–600';
  return null;
}

function getDescriptionSuggestions(category: string): string[] {
  const l = category.toLowerCase();
  if (l.includes('eletric') || l.includes('elétr'))
    return ['Tomada com problema na sala', 'Troca de disjuntor que desliga sozinho', 'Instalação de ventilador de teto'];
  if (l.includes('encana') || l.includes('hidráu') || l.includes('hidraul'))
    return ['Torneira pingando no banheiro', 'Cano com vazamento na parede', 'Entupimento na pia da cozinha'];
  if (l.includes('pint'))
    return ['Pintar sala e dois quartos', 'Repintura fachada com tinta acrílica', 'Textura em parede de sala'];
  if (l.includes('limpez') || l.includes('faxin'))
    return ['Faxina completa de apartamento 2 quartos', 'Limpeza pós-obra com muita poeira', 'Organização e limpeza geral'];
  if (l.includes('marcen') || l.includes('carpint'))
    return ['Armário planejado para quarto', 'Mesa de madeira sob medida', 'Deck para área externa'];
  if (l.includes('gess') || l.includes('drywall'))
    return ['Forro de gesso em sala', 'Divisória de drywall', 'Sanca com LED embutido'];
  if (l.includes('reforma'))
    return ['Reforma completa de banheiro', 'Cozinha planejada completa', 'Área de lazer coberta'];
  return ['Descreva o serviço que precisa', 'Informe o tamanho do espaço', 'Mencione materiais necessários'];
}

const URGENCY_OPTIONS = [
  { value: 'hoje' as const, label: 'Hoje / Amanhã', icon: '🔥', desc: 'Preciso urgente' },
  { value: 'semana' as const, label: 'Esta semana', icon: '⚡', desc: 'Em breve' },
  { value: 'mes' as const, label: 'Este mês', icon: '📅', desc: 'Sem pressa imediata' },
  { value: 'sem_pressa' as const, label: 'Sem prazo', icon: '🕐', desc: 'Quando der' },
];

const WORK_SIZE_OPTIONS = [
  { value: 'pequeno' as const, label: 'Pequeno', icon: '🔹', desc: 'Poucas horas' },
  { value: 'medio' as const, label: 'Médio', icon: '🔷', desc: '1 a 2 dias' },
  { value: 'grande' as const, label: 'Grande', icon: '🔶', desc: 'Uma semana+' },
  { value: 'projeto' as const, label: 'Projeto completo', icon: '🏆', desc: 'Longo prazo' },
];

const PURCHASE_DECISION_OPTIONS = [
  { value: 'agora' as const, label: 'Sim, posso fechar já', icon: '✅', desc: 'Orçamento aprovado' },
  { value: 'pesquisando' as const, label: 'Pesquisando preços', icon: '🔍', desc: 'Comparando opções' },
  { value: 'depende' as const, label: 'Depende do valor', icon: '💬', desc: 'Preciso de proposta' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'manha' as const, label: 'Manhã', icon: '☀️' },
  { value: 'tarde' as const, label: 'Tarde', icon: '🌤️' },
  { value: 'noite' as const, label: 'Noite', icon: '🌙' },
  { value: 'qualquer' as const, label: 'Qualquer', icon: '📅' },
];

const LOCAL_CONDITION_OPTIONS = [
  { value: 'vistoria' as const, label: 'Precisa vistoria', icon: '👀', desc: 'Profissional deve visitar primeiro' },
  { value: 'medidas' as const, label: 'Tenho medidas', icon: '📐', desc: 'Já tenho fotos e medidas' },
  { value: 'pronto' as const, label: 'Pronto p/ iniciar', icon: '🚀', desc: 'Pode começar quando quiser' },
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function RequestWizard({
  onSubmit,
  onClose,
  isPending,
  isUploading,
  initialData,
}: RequestWizardProps) {
  const [step, setStep] = useState(1);
  const [slideDir, setSlideDir] = useState<'forward' | 'backward'>('forward');
  const [localUploading, setLocalUploading] = useState(false);
  const [dbCategories, setDbCategories] = useState<{ name: string; slug: string }[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [data, setData] = useState<InternalData>({
    title: initialData?.title ?? '',
    category: initialData?.category ?? '',
    description: initialData?.description ?? '',
    location: initialData?.location ?? '',
    budget_min: initialData?.budget_min ?? '0',
    budget_max: initialData?.budget_max ?? '5000',
    images: initialData?.images ?? [],
    urgency: initialData?.urgency ?? '',
    work_size: initialData?.work_size ?? '',
    availability: initialData?.availability ?? '',
    local_condition: initialData?.local_condition ?? '',
    purchase_decision: initialData?.purchase_decision ?? '',
  });

  const uploading = localUploading || isUploading;

  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'rw-keyframes';
    el.textContent = `
      @keyframes rw-fwd  { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
      @keyframes rw-back { from{opacity:0;transform:translateX(-18px)} to{opacity:1;transform:translateX(0)} }
      @keyframes rw-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      @keyframes rw-spin  { to{transform:rotate(360deg)} }
      .rw-fwd  { animation: rw-fwd  .22s cubic-bezier(.22,1,.36,1); }
      .rw-back { animation: rw-back .22s cubic-bezier(.22,1,.36,1); }
      .rw-blink { animation: rw-pulse 1.3s ease-in-out infinite; }
      .rw-spin  { animation: rw-spin 1s linear infinite; }
      .rw-cat-card:hover { transform: translateY(-2px); transition: transform .15s; }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById('rw-keyframes')?.remove(); };
  }, []);

  useEffect(() => {
    supabase
      .from('categories')
      .select('name, slug')
      .eq('is_active', true)
      .order('name')
      .then(({ data: cats, error }) => {
        if (error) {
          if (import.meta.env.DEV) console.error('[RequestWizard] erro ao carregar categorias:', error);
          toast.error('Não foi possível carregar as categorias. Usando lista padrão.');
          return;
        }
        if (cats?.length) setDbCategories(cats);
      });
  }, []);

  useEffect(() => {
    if (initialData?.location) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('city').eq('id', user.id).single().then(({ data: profile }) => {
        if (profile?.city) setData(prev => prev.location ? prev : { ...prev, location: profile.city });
      });
    });
  }, [initialData?.location]);

  const setField = <K extends keyof InternalData>(key: K, value: InternalData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  const MAX_FILE_SIZE_MB = 5;
  const MAX_FILES = 5;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    if (data.images.length + fileArray.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} arquivos por pedido.`);
      return;
    }
    for (const file of fileArray) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(`Tipo não permitido: ${file.name}. Use JPG, PNG, WebP, GIF ou PDF.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} excede ${MAX_FILE_SIZE_MB}MB. Escolha um arquivo menor.`);
        return;
      }
    }
    setLocalUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      const urls: string[] = [];
      for (const file of fileArray) {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          try { fileToUpload = await compressImage(file); } catch { /* fallback silencioso */ }
        }
        const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/leads/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from('avatars').upload(path, fileToUpload);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        urls.push(publicUrl);
      }
      setData(prev => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar imagem');
    } finally {
      setLocalUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!data.urgency || !data.work_size || !data.availability || !data.local_condition || !data.purchase_decision) return;
    onSubmit(data as WizardData);
  };

  const canProceedStep1 = data.title.trim() !== '' && data.category !== '';
  const canProceedStep2 = data.urgency !== '' && data.work_size !== '';
  const canProceedStep3 = data.purchase_decision !== '' && data.availability !== '' && data.local_condition !== '';

  const score = 40
    + (data.description.length > 20 ? 30 : 0)
    + (data.images.length > 0 ? 20 : 0)
    + (Number(data.budget_min) > 0 || Number(data.budget_max) < 5000 ? 10 : 0);
  const profCount = score < 50 ? '4' : score < 80 ? '8' : '12';
  const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  const filteredCategories = (dbCategories.length > 0
    ? dbCategories.map(c => ({ label: c.name, icon: getCategoryIcon(c.slug) }))
    : FALLBACK_CATEGORIES
  ).filter(c => !categorySearch || c.label.toLowerCase().includes(categorySearch.toLowerCase()));

  const priceHint = data.category ? getPriceHint(data.category) : null;
  const suggestions = data.category ? getDescriptionSuggestions(data.category) : [];

  const urgencyLabel = URGENCY_OPTIONS.find(u => u.value === data.urgency)?.label ?? '—';

  const canNext =
    (step === 1 && canProceedStep1) ||
    (step === 2 && canProceedStep2) ||
    (step === 3 && canProceedStep3) ||
    (step === 4 && !isPending && !uploading);

  const goNext = () => {
    setSlideDir('forward');
    if (step < 4) setStep(s => s + 1);
    else handleSubmit();
  };

  const goBack = () => {
    setSlideDir('backward');
    setStep(s => s - 1);
  };

  const nextLabel = step === 4
    ? (isPending ? 'Publicando…' : `🚀 Publicar para ${profCount} profissionais`)
    : step === 3 ? 'Revisar pedido →' : 'Próximo →';

  // shared card style
  const optCard = (sel: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
    borderRadius: 11, cursor: 'pointer', textAlign: 'left', width: '100%',
    background: sel ? 'rgba(245,158,11,.07)' : '#09182a',
    border: sel ? '1px solid #f59e0b' : '1px solid #0e2035',
    transition: 'all .15s',
    position: 'relative',
  });

  const dividerGrad: React.CSSProperties = {
    height: 1, background: 'linear-gradient(90deg,transparent,#0e2035,transparent)',
    margin: '4px 0',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#09182a', border: '1px solid #0e2035',
    borderRadius: 11, padding: '10px 14px', color: '#f0f6ff', fontSize: 14,
    outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
    transition: 'border-color .15s',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 800, color: '#3a5a78',
    textTransform: 'uppercase', letterSpacing: '.08em',
    display: 'block', marginBottom: 7,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }} onClick={onClose} />

      <div style={{
        position: 'relative', background: '#060d18', border: '1px solid #0e2035',
        borderRadius: 24, maxWidth: 520, width: '100%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif", boxShadow: '0 28px 70px rgba(0,0,0,.7)',
      }}>

        {/* Golden bar */}
        <div style={{ height: 2, background: 'linear-gradient(90deg,#92400e,#f59e0b,#fbbf24,#f59e0b,#92400e)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '16px 22px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', borderRadius: 5, padding: '2px 8px', display: 'inline-block', marginBottom: 6 }}>
                Nova Solicitação
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f0f6ff', margin: 0, lineHeight: 1.15 }}>
                {STEP_SUBTITLES[step - 1]}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ width: 28, height: 28, background: '#09182a', border: '1px solid #0e2035', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3a5a78', flexShrink: 0, transition: 'transform .2s, border-color .15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(90deg)'; e.currentTarget.style.borderColor = '#f59e0b'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = '#0e2035'; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{
                    height: 3, borderRadius: 2,
                    background: done
                      ? '#b45309'
                      : active
                        ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                        : '#0a1e32',
                    boxShadow: active ? '0 0 8px rgba(245,158,11,.4)' : 'none',
                    transition: 'background .3s',
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: active ? '#f59e0b' : done ? '#b45309' : '#1e3a5f' }}>
                      {label}
                    </span>
                    {active && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b' }}>{n * 25}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Social proof bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#040b14', borderBottom: '1px solid #0a1e32', padding: '7px 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex' }}>
              {[
                { init: 'C', bg: '#1d4ed8' },
                { init: 'M', bg: '#047857' },
                { init: 'A', bg: '#7c3aed' },
                { init: 'R', bg: '#b45309' },
                { init: 'J', bg: '#dc2626' },
              ].map(({ init, bg }, i) => (
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: '50%', border: '2px solid #040b14',
                  background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 7, fontWeight: 900, color: '#fff',
                  marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 5 - i,
                }}>{init}</div>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#4a6a80' }}>12 profissionais disponíveis agora</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="rw-blink" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', letterSpacing: '.06em' }}>ONLINE</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
          <div key={step} className={slideDir === 'backward' ? 'rw-back' : 'rw-fwd'}>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Section label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#f59e0b', flexShrink: 0 }}>1</div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#3a5a78', textTransform: 'uppercase', letterSpacing: '.08em' }}>Qual serviço você precisa?</span>
                </div>

                {/* Title input */}
                <div>
                  <label style={labelStyle}>Título do pedido</label>
                  <input
                    type="text"
                    placeholder="Ex: Pintura completa de apartamento"
                    maxLength={150}
                    value={data.title}
                    onChange={e => setField('title', e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#0e2035'; }}
                  />
                </div>

                {/* Category search + grid */}
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#3a5a78', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Filtrar categorias…"
                      value={categorySearch}
                      onChange={e => setCategorySearch(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 30, fontSize: 12, color: '#4a6a80' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#0e2035'; }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                    {filteredCategories.map(cat => {
                      const sel = data.category === cat.label;
                      const cs = getCategoryStyle(cat.icon);
                      return (
                        <button
                          key={cat.label}
                          type="button"
                          className="rw-cat-card"
                          onClick={() => setField('category', cat.label)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                            padding: '11px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                            background: sel ? 'rgba(245,158,11,.06)' : '#09182a',
                            border: sel ? `1px solid #f59e0b` : '1px solid #0e2035',
                            position: 'relative', transition: 'all .15s',
                          }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: cs.bg, border: `1px solid ${cs.border}` }}>
                            {cat.icon}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: sel ? cs.textColor : '#3a5a78', lineHeight: 1.3 }}>{cat.label}</span>
                          {sel && (
                            <div style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', background: cs.bg, border: `1px solid ${cs.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: cs.textColor, fontWeight: 900 }}>✓</div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {priceHint && (
                    <div style={{ marginTop: 10, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.12)', borderRadius: 10, padding: '7px 11px', fontSize: 11, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>💡</span>
                      <span>Preço médio na região: <strong>{priceHint}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Red tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)', borderRadius: 9 }}>
                  <span className="rw-blink" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.06em' }}>Urgente = Prioridade de Exibição</span>
                </div>

                <div>
                  <label style={labelStyle}>Quando você precisa?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    {URGENCY_OPTIONS.map(opt => {
                      const sel = data.urgency === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setField('urgency', opt.value)} style={optCard(sel)}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: sel ? 'rgba(245,158,11,.1)' : '#0d1e32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{opt.icon}</div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: sel ? '#f59e0b' : '#c8dce8', margin: '0 0 2px' }}>{opt.label}</p>
                            <p style={{ fontSize: 10, color: '#3a5a78', margin: 0 }}>{opt.desc}</p>
                          </div>
                          {sel && <span style={{ position: 'absolute', top: 7, right: 8, fontSize: 10, color: '#f59e0b', fontWeight: 900 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Tamanho do trabalho?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    {WORK_SIZE_OPTIONS.map(opt => {
                      const sel = data.work_size === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setField('work_size', opt.value)} style={optCard(sel)}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: sel ? 'rgba(245,158,11,.1)' : '#0d1e32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{opt.icon}</div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: sel ? '#f59e0b' : '#c8dce8', margin: '0 0 2px' }}>{opt.label}</p>
                            <p style={{ fontSize: 10, color: '#3a5a78', margin: 0 }}>{opt.desc}</p>
                          </div>
                          {sel && <span style={{ position: 'absolute', top: 7, right: 8, fontSize: 10, color: '#f59e0b', fontWeight: 900 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Green insight */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.18)', borderRadius: 9 }}>
                  <span>📊</span>
                  <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Pedidos detalhados recebem <strong>3× mais propostas</strong></span>
                </div>

                <div>
                  <label style={labelStyle}>Você pode contratar agora?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {PURCHASE_DECISION_OPTIONS.map(opt => {
                      const sel = data.purchase_decision === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setField('purchase_decision', opt.value)} style={optCard(sel)}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: sel ? 'rgba(245,158,11,.1)' : '#0d1e32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{opt.icon}</div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: sel ? '#f59e0b' : '#c8dce8', margin: '0 0 2px' }}>{opt.label}</p>
                            <p style={{ fontSize: 10, color: '#3a5a78', margin: 0 }}>{opt.desc}</p>
                          </div>
                          {sel && <span style={{ position: 'absolute', top: 7, right: 8, fontSize: 10, color: '#f59e0b', fontWeight: 900 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={dividerGrad} />

                <div>
                  <label style={labelStyle}>Disponibilidade para visita?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {AVAILABILITY_OPTIONS.map(opt => {
                      const sel = data.availability === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setField('availability', opt.value)} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          padding: '9px 4px', borderRadius: 11, cursor: 'pointer',
                          background: sel ? 'rgba(245,158,11,.07)' : '#09182a',
                          border: sel ? '1px solid #f59e0b' : '1px solid #0e2035',
                          transition: 'all .15s',
                        }}>
                          <span style={{ fontSize: 16 }}>{opt.icon}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: sel ? '#f59e0b' : '#3a5a78' }}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={dividerGrad} />

                <div>
                  <label style={labelStyle}>Como está o local?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {LOCAL_CONDITION_OPTIONS.map(opt => {
                      const sel = data.local_condition === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setField('local_condition', opt.value)} style={optCard(sel)}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: sel ? 'rgba(245,158,11,.1)' : '#0d1e32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{opt.icon}</div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: sel ? '#f59e0b' : '#c8dce8', margin: '0 0 2px' }}>{opt.label}</p>
                            <p style={{ fontSize: 10, color: '#3a5a78', margin: 0 }}>{opt.desc}</p>
                          </div>
                          {sel && <span style={{ position: 'absolute', top: 7, right: 8, fontSize: 10, color: '#f59e0b', fontWeight: 900 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4 ── */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Score bar */}
                <div style={{ background: '#09182a', border: '1px solid #0e2035', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#3a5a78', textTransform: 'uppercase', letterSpacing: '.06em' }}>Score do pedido</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: scoreColor, fontFamily: "'DM Mono', monospace" }}>{score}%</span>
                  </div>
                  <div style={{ height: 5, background: '#0a1e32', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${score}%`, background: scoreColor, transition: 'width .4s ease' }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                    {[
                      { label: 'Base', done: true },
                      { label: '+30% descrição', done: data.description.length > 20 },
                      { label: '+20% foto', done: data.images.length > 0 },
                      { label: '+10% orçamento', done: Number(data.budget_min) > 0 || Number(data.budget_max) < 5000 },
                    ].map(item => (
                      <span key={item.label} style={{ fontSize: 9, color: item.done ? '#4a7a60' : '#2a3a4a', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: item.done ? '#10b981' : '#2a3a4a' }}>{item.done ? '✓' : '○'}</span>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label style={labelStyle}>📍 Localização (Cidade, Estado)</label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo, SP"
                    maxLength={100}
                    value={data.location}
                    onChange={e => setField('location', e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#0e2035'; }}
                  />
                </div>

                {/* Budget */}
                <div>
                  <label style={labelStyle}>Orçamento estimado</label>
                  <div style={{ background: '#09182a', border: '1px solid #0e2035', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: '#3a5a78', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Faixa</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: '#f59e0b', fontFamily: "'DM Mono', monospace" }}>
                        {formatBRL(Number(data.budget_min))} — {formatBRL(Number(data.budget_max))}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#2a3a4a', textTransform: 'uppercase' }}>Mínimo</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{formatBRL(Number(data.budget_min))}</span>
                      </div>
                      <input type="range" min={0} max={Number(data.budget_max)} step={500} value={data.budget_min}
                        onChange={e => setField('budget_min', e.target.value)}
                        style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#2a3a4a', textTransform: 'uppercase' }}>Máximo</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{formatBRL(Number(data.budget_max))}</span>
                      </div>
                      <input type="range" min={Number(data.budget_min)} max={50000} step={500} value={data.budget_max}
                        onChange={e => setField('budget_max', e.target.value)}
                        style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>Descrição (opcional · +30% score)</label>
                  {suggestions.length > 0 && !data.description && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                      {suggestions.map(sg => (
                        <button key={sg} type="button" onClick={() => setField('description', sg)}
                          style={{ fontSize: 10, padding: '3px 10px', background: '#09182a', border: '1px solid rgba(245,158,11,.2)', borderRadius: 20, color: '#f59e0b', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                          {sg}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    rows={3}
                    placeholder="Conte mais detalhes — quanto mais informações, melhores serão as propostas!"
                    maxLength={2000}
                    value={data.description}
                    onChange={e => setField('description', e.target.value)}
                    style={{ ...inputStyle, padding: '10px 14px', fontSize: 13, resize: 'none' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#0e2035'; }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 9, color: '#2a3a4a', marginTop: 4 }}>
                    {data.description.length} / 2000
                  </div>
                </div>

                {/* Photos */}
                <div>
                  <label style={labelStyle}>Fotos (opcional · +20% score)</label>
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: 16, cursor: uploading ? 'not-allowed' : 'pointer',
                    background: '#09182a', border: '2px dashed #0e2035', borderRadius: 12,
                    opacity: uploading ? 0.5 : 1, textAlign: 'center',
                    transition: 'border-color .15s',
                  }}
                    onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = 'rgba(245,158,11,.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#0e2035'; }}
                  >
                    {uploading
                      ? <Loader2 size={24} className="rw-spin" style={{ color: '#10b981' }} />
                      : <ImagePlus size={24} style={{ color: '#3a5a78' }} />
                    }
                    <span style={{ fontSize: 12, color: '#3a5a78', fontWeight: 600 }}>
                      {uploading ? 'Enviando…' : 'Adicionar fotos do local'}
                    </span>
                    <span style={{ fontSize: 10, color: '#2a3a4a' }}>
                      {uploading ? '' : 'Pedidos com fotos recebem 2× mais propostas'}
                    </span>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
                  </label>
                  {data.images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {data.images.map((url, i) => (
                        <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 9, overflow: 'hidden', border: '1px solid #0e2035' }}>
                          <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button"
                            onClick={() => setData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .15s', cursor: 'pointer', border: 'none' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                          >
                            <X size={14} style={{ color: '#fff' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preview card */}
                <div style={{ background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.18)', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 0 9px' }}>📋 Revisão final</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { label: 'Serviço', value: data.category || '—' },
                      { label: 'Urgência', value: urgencyLabel },
                      { label: 'Porte', value: WORK_SIZE_OPTIONS.find(w => w.value === data.work_size)?.label ?? '—' },
                      { label: 'Orçamento', value: `${formatBRL(Number(data.budget_min))} – ${formatBRL(Number(data.budget_max))}` },
                      { label: 'Local', value: data.location || '—' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#3a5a78', textTransform: 'uppercase', minWidth: 62, flexShrink: 0 }}>{row.label}</span>
                        <span style={{ fontSize: 12, color: '#8aa8be', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust bar */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 14px' }}>
                  {['🔒 SSL', '⏱ Resposta em 2h', '⭐ Verificados', '🚫 Sem spam'].map(item => (
                    <span key={item} style={{ fontSize: 9, color: '#2a3a4a', fontWeight: 500 }}>{item}</span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#040b14', borderTop: '1px solid #0a1e32', padding: '10px 22px 14px', flexShrink: 0 }}>
          <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#2a3a4a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Etapa {step} de 4
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button type="button" onClick={goBack} disabled={uploading}
                style={{
                  flex: 1, height: 44, background: '#09182a', border: '1px solid #0e2035',
                  borderRadius: 11, color: '#2a4a64', fontSize: 13, fontWeight: 700,
                  cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif", transition: 'border-color .15s',
                }}
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = '#f59e0b'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#0e2035'; }}
              >← Voltar</button>
            )}
            <button type="button" onClick={goNext} disabled={!canNext}
              style={{
                flex: step === 1 ? 1 : 2, height: 44,
                background: !canNext
                  ? '#09182a'
                  : step === 4
                    ? 'linear-gradient(135deg,#047857,#059669,#10b981)'
                    : 'linear-gradient(135deg,#d97706,#f59e0b,#fbbf24)',
                border: 'none',
                borderRadius: 11,
                color: !canNext ? '#2a3a4a' : step === 4 ? '#fff' : '#000',
                fontSize: 13, fontWeight: 800,
                cursor: !canNext ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                fontFamily: "'DM Sans', sans-serif",
                transition: 'opacity .15s',
                opacity: !canNext ? 0.6 : 1,
              }}
            >
              {isPending && step === 4
                ? <><Loader2 size={15} className="rw-spin" /> Publicando…</>
                : nextLabel
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
