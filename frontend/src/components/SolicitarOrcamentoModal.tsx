import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, CheckCircle2, ChevronRight, ArrowLeft, Clock } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

const TITLE_SUGGESTIONS: Record<string, string[]> = {
  'Eletricista':     ['Instalação elétrica', 'Troca de tomadas', 'Curto circuito', 'Instalação de chuveiro'],
  'Encanador':       ['Vazamento de água', 'Entupimento', 'Instalação de torneira', 'Troca de cano'],
  'Pintor':          ['Pintura de quarto', 'Pintura externa', 'Pintura de apartamento', 'Reforma de pintura'],
  'Pedreiro':        ['Reforma de banheiro', 'Quebra de parede', 'Reboco', 'Construção de muro'],
  'Marceneiro':      ['Montagem de móveis', 'Conserto de móveis', 'Armário planejado', 'Mesa sob medida'],
  'Chaveiro':        ['Cópia de chave', 'Troca de fechadura', 'Abertura de porta', 'Fechadura digital'],
  'Ar-condicionado': ['Instalação de ar-condicionado', 'Limpeza de ar-condicionado', 'Manutenção de ar-condicionado'],
  'Diarista':        ['Limpeza residencial', 'Faxina completa', 'Limpeza semanal', 'Organização de casa'],
};

interface Props {
  open: boolean;
  onClose: () => void;
  professionalId: string;       // professionals.id
  professionalUserId: string;   // profiles.id / auth user id
  professionalName: string;
  defaultCategory?: string;
}

interface ExistingLead {
  id: string;
  title: string;
  category: string;
  created_at: string;
}

interface SolicitarResult {
  lead_id: string;
  conversation_id: string;
  already_exists: boolean;
  avg_response_hours: number | null;
}

type Step = 'choose' | 'form' | 'success';

export default function SolicitarOrcamentoModal({
  open, onClose,
  professionalId, professionalUserId, professionalName,
  defaultCategory = '',
}: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('choose');
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [city, setCity] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [result, setResult] = useState<SolicitarResult | null>(null);

  const { data: existingLeads } = useQuery<ExistingLead[]>({
    queryKey: ['my-leads-for-modal'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, title, category, created_at')
        .eq('client_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data ?? []) as ExistingLead[];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (leadId: string | undefined) => {
      const body: Record<string, unknown> = {
        professional_id:      professionalId,
        professional_user_id: professionalUserId,
        professional_name:    professionalName,
        title:       title || (selectedLeadId && existingLeads?.find(l => l.id === selectedLeadId)?.title) || 'Orçamento',
        description: description || 'Solicitação de orçamento via perfil.',
        category:    category || defaultCategory || 'Geral',
        city,
        budget_min:  budgetMin ? parseFloat(budgetMin) : null,
        budget_max:  budgetMax ? parseFloat(budgetMax) : null,
      };
      if (leadId) body.lead_id = leadId;
      const res = await apiFetch('/api/leads/solicitar-orcamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Erro ao solicitar orçamento.');
      }
      return res.json() as Promise<SolicitarResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('success');
      if (data.already_exists) {
        toast.info('Você já tem uma conversa aberta com este profissional para este pedido.');
      } else {
        toast.success('Orçamento solicitado com sucesso!');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleClose() {
    setStep('choose');
    setSelectedLeadId(undefined);
    setTitle(''); setDescription(''); setCategory(defaultCategory);
    setCity(''); setBudgetMin(''); setBudgetMax('');
    setResult(null);
    onClose();
  }

  function handleChooseExisting(leadId: string) {
    setSelectedLeadId(leadId);
    mutation.mutate(leadId);
  }

  function handleNewRequest() {
    setSelectedLeadId(undefined);
    setStep('form');
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 5) {
      toast.error('O título deve ter pelo menos 5 caracteres.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      toast.error('A descrição deve ter pelo menos 10 caracteres.');
      return;
    }
    mutation.mutate(undefined);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-[#132540] border border-[#1C3050] sm:rounded-2xl rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1C3050]">
          <div className="flex items-center gap-8">
            {step === 'form' && (
              <button
                onClick={() => setStep('choose')}
                className="p-6 text-[#4A6580] hover:text-white transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-white">Solicitar orçamento</h2>
              <p className="text-xs text-[#4A6580]">{professionalName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-[#4A6580] hover:text-white transition-colors rounded-lg hover:bg-[#1C3050]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Step: choose */}
          {step === 'choose' && (
            <div className="space-y-8">
              {mutation.isPending && (
                <div className="flex items-center justify-center py-8 gap-8 text-[#4A6580]">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Abrindo conversa...</span>
                </div>
              )}
              {!mutation.isPending && (
                <>
                  {existingLeads && existingLeads.length > 0 && (
                    <>
                      <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-7">Usar pedido existente</p>
                      <div className="space-y-7 max-h-48 overflow-y-auto pr-1">
                        {existingLeads.map(lead => (
                          <button
                            key={lead.id}
                            onClick={() => handleChooseExisting(lead.id)}
                            className="w-full flex items-center justify-between gap-8 px-9 py-8 bg-[#0E1C32] border border-[#1C3050] rounded-xl hover:border-emerald-500/30 hover:bg-[#1C3050] transition-all text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{lead.title}</p>
                              <p className="text-xs text-[#4A6580]">{lead.category}</p>
                            </div>
                            <ChevronRight size={16} className="text-[#4A6580] shrink-0" />
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-8 py-6">
                        <div className="flex-1 h-px bg-[#1C3050]" />
                        <span className="text-xs text-[#4A6580]">ou</span>
                        <div className="flex-1 h-px bg-[#1C3050]" />
                      </div>
                    </>
                  )}
                  <button
                    onClick={handleNewRequest}
                    className="w-full py-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Novo pedido de orçamento
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step: form */}
          {step === 'form' && (
            <form onSubmit={handleSubmitForm} className="space-y-9">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">
                  Título do serviço *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Instalação de ar-condicionado"
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
                  required
                  minLength={5}
                  maxLength={200}
                />
                {TITLE_SUGGESTIONS[category] && !title && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {TITLE_SUGGESTIONS[category].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTitle(s)}
                        className="text-[11px] px-2.5 py-6 bg-[#0E1C32] border border-[#1C3050] hover:border-emerald-500/40 text-[#94A3B8] hover:text-emerald-400 rounded-lg transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">
                  Descrição *
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva o serviço que precisa..."
                  rows={3}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580] resize-none"
                  required
                  minLength={10}
                  maxLength={2000}
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Ex: Elétrica"
                    className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">
                    Orçamento mín. (R$)
                  </label>
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={e => setBudgetMin(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5">
                    Orçamento máx. (R$)
                  </label>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={e => setBudgetMax(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className={cn(
                  'w-full py-8 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-7',
                  mutation.isPending
                    ? 'bg-emerald-700 text-white/70 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white',
                )}
              >
                {mutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                ) : (
                  'Solicitar orçamento'
                )}
              </button>
            </form>
          )}

          {/* Step: success */}
          {step === 'success' && result && (
            <div className="flex flex-col items-center text-center gap-9 py-9">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <div>
                <p className="text-lg font-bold text-white mb-6">
                  {result.already_exists ? 'Conversa já existe!' : 'Orçamento enviado!'}
                </p>
                <p className="text-sm text-[#94A3B8]">
                  {result.already_exists
                    ? 'Você já tem uma conversa com este profissional para este pedido.'
                    : `${professionalName} receberá sua solicitação e entrará em contato.`}
                </p>
              </div>
              {result.avg_response_hours !== null && result.avg_response_hours > 0 && (
                <div className="flex items-center justify-center gap-7 text-sm text-[#94A3B8] bg-[#0E1C32] border border-[#1C3050] rounded-xl px-9 py-2.5">
                  <Clock size={14} className="text-emerald-400 shrink-0" />
                  <span>
                    {professionalName} costuma responder em{' '}
                    <strong className="text-white">
                      {result.avg_response_hours < 1
                        ? 'menos de 1 hora'
                        : result.avg_response_hours === 1
                        ? '1 hora'
                        : `${result.avg_response_hours} horas`}
                    </strong>
                  </span>
                </div>
              )}
              <button
                onClick={() => {
                  handleClose();
                  navigate(`/cliente/mensagens?chatId=${result.conversation_id}`);
                }}
                className="w-full py-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all"
              >
                Ver conversa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
