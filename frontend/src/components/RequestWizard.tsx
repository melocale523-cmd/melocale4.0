import { useState, useEffect } from 'react';
import { X, Loader2, ImagePlus, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

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

const CATEGORIES = [
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
  const [localUploading, setLocalUploading] = useState(false);
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
    if (initialData?.location) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('city').eq('id', user.id).single().then(({ data }) => {
        if (data?.city) setData(prev => prev.location ? prev : { ...prev, location: data.city });
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
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/leads/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from('avatars').upload(path, file);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-[2.5rem] max-w-2xl w-full max-h-screen sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">

        {/* Header */}
        <div className="p-8 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                <FileText size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Nova Solicitação</h2>
                <p className="text-[#94A3B8] font-medium">{STEP_SUBTITLES[step - 1]}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-[#4A6580] hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  s === step ? 'bg-emerald-500 flex-1' : s < step ? 'bg-emerald-500/40 w-8' : 'bg-slate-800 w-8'
                )}
              />
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="px-8 pb-8 flex-1 overflow-y-auto space-y-0">

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Título</label>
                <input
                  type="text"
                  placeholder="Ex: Pintura completa de apartamento"
                  value={data.title}
                  onChange={e => setField('title', e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Categoria</label>
                <div className="grid grid-cols-3 gap-3">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setField('category', cat.label)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-center',
                        data.category === cat.label
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#0E1C32] border-[#1C3050] hover:border-emerald-500/30'
                      )}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className={cn('text-xs font-bold', data.category === cat.label ? 'text-emerald-400' : 'text-[#94A3B8]')}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl transition-all"
              >
                Próximo →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Quando você precisa?</label>
                <div className="grid grid-cols-2 gap-3">
                  {URGENCY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField('urgency', opt.value)}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left',
                        data.urgency === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#0E1C32] border-[#1C3050] hover:border-emerald-500/30'
                      )}
                    >
                      <span className="text-xl mt-0.5">{opt.icon}</span>
                      <div>
                        <p className={cn('text-sm font-bold', data.urgency === opt.value ? 'text-emerald-400' : 'text-white')}>{opt.label}</p>
                        <p className="text-xs text-[#4A6580]">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Tamanho do trabalho?</label>
                <div className="grid grid-cols-2 gap-3">
                  {WORK_SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField('work_size', opt.value)}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left',
                        data.work_size === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#0E1C32] border-[#1C3050] hover:border-emerald-500/30'
                      )}
                    >
                      <span className="text-xl mt-0.5">{opt.icon}</span>
                      <div>
                        <p className={cn('text-sm font-bold', data.work_size === opt.value ? 'text-emerald-400' : 'text-white')}>{opt.label}</p>
                        <p className="text-xs text-[#4A6580]">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-[#0E1C32] border border-[#1C3050] hover:border-white/20 text-[#94A3B8] font-black py-4 rounded-2xl transition-all"
                >
                  ← Voltar
                </button>
                <button
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl transition-all"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Você pode contratar agora?</label>
                <div className="space-y-2">
                  {PURCHASE_DECISION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField('purchase_decision', opt.value)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left',
                        data.purchase_decision === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#0E1C32] border-[#1C3050] hover:border-emerald-500/30'
                      )}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <p className={cn('text-sm font-bold', data.purchase_decision === opt.value ? 'text-emerald-400' : 'text-white')}>{opt.label}</p>
                        <p className="text-xs text-[#4A6580]">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Disponibilidade para visita?</label>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField('availability', opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all text-center',
                        data.availability === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#0E1C32] border-[#1C3050] hover:border-emerald-500/30'
                      )}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className={cn('text-xs font-bold', data.availability === opt.value ? 'text-emerald-400' : 'text-[#94A3B8]')}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Como está o local?</label>
                <div className="space-y-2">
                  {LOCAL_CONDITION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField('local_condition', opt.value)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left',
                        data.local_condition === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#0E1C32] border-[#1C3050] hover:border-emerald-500/30'
                      )}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <p className={cn('text-sm font-bold', data.local_condition === opt.value ? 'text-emerald-400' : 'text-white')}>{opt.label}</p>
                        <p className="text-xs text-[#4A6580]">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-[#0E1C32] border border-[#1C3050] hover:border-white/20 text-[#94A3B8] font-black py-4 rounded-2xl transition-all"
                >
                  ← Voltar
                </button>
                <button
                  disabled={!canProceedStep3}
                  onClick={() => setStep(4)}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl transition-all"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Localização (Cidade, Estado)</label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo, SP"
                  value={data.location}
                  onChange={e => setField('location', e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Orçamento</label>
                <div className="bg-[#0E1C32] border border-[#1C3050] rounded-2xl p-5 space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] text-[#4A6580] font-bold uppercase tracking-widest">Mínimo</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#4A6580] font-bold">R$</span>
                          <input
                            type="number"
                            step={50}
                            min={0}
                            max={Number(data.budget_max)}
                            value={data.budget_min}
                            onChange={e => setField('budget_min', String(Math.min(Number(e.target.value), Number(data.budget_max))))}
                            className="w-24 bg-transparent border-b border-[#243F6A] text-white text-right text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Number(data.budget_max)}
                        step={500}
                        value={data.budget_min}
                        onChange={e => setField('budget_min', e.target.value)}
                        className="w-full accent-yellow-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] text-[#4A6580] font-bold uppercase tracking-widest">Máximo</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#4A6580] font-bold">R$</span>
                          <input
                            type="number"
                            step={50}
                            min={Number(data.budget_min)}
                            max={50000}
                            value={data.budget_max}
                            onChange={e => setField('budget_max', String(Math.max(Number(e.target.value), Number(data.budget_min))))}
                            className="w-24 bg-transparent border-b border-[#243F6A] text-white text-right text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                      <input
                        type="range"
                        min={Number(data.budget_min)}
                        max={50000}
                        step={500}
                        value={data.budget_max}
                        onChange={e => setField('budget_max', e.target.value)}
                        className="w-full accent-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Descrição (opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Conte mais detalhes — quanto mais informações, melhores serão as propostas!"
                  value={data.description}
                  onChange={e => setField('description', e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest pl-1">Fotos (opcional)</label>
                <label className={cn(
                  'flex items-center gap-3 cursor-pointer w-full bg-[#0E1C32] border border-[#1C3050] hover:border-emerald-500/30 rounded-2xl px-5 py-4 transition-all',
                  uploading && 'opacity-50 pointer-events-none'
                )}>
                  {uploading
                    ? <Loader2 size={20} className="animate-spin text-emerald-500 shrink-0" />
                    : <ImagePlus size={20} className="text-[#4A6580] shrink-0" />
                  }
                  <span className="text-sm text-[#94A3B8] font-medium">
                    {uploading ? 'Enviando...' : 'Adicionar fotos'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
                {data.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {data.images.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#243F6A] group/thumb">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all"
                        >
                          <X size={16} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  disabled={uploading}
                  className="flex-1 bg-[#0E1C32] border border-[#1C3050] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-[#94A3B8] font-black py-4 rounded-2xl transition-all"
                >
                  ← Voltar
                </button>
                <button
                  disabled={isPending || uploading}
                  onClick={handleSubmit}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  {isPending
                    ? <Loader2 size={20} className="animate-spin" />
                    : '🚀 Publicar e Receber Propostas'
                  }
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
