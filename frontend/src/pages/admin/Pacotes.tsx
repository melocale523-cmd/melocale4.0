import { useState } from 'react';
import { Plus, Edit2, Loader2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface PacoteForm {
  id: string;
  name: string;
  price: string;
  coins: string;
  bonus_coins: string;
  display_order: string;
  is_active: boolean;
}

const EMPTY_FORM: PacoteForm = { id: '', name: '', price: '', coins: '', bonus_coins: '0', display_order: '0', is_active: true };

export default function AdminPacotes() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PacoteForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: pacotes, isLoading } = useQuery({
    queryKey: ['adminPacotes'],
    queryFn: () => adminService.getCoinPackages()
  });

  // Vendas e receita reais por pacote (payments pagos com package_id = id do pacote)
  const { data: salesStats = {} } = useQuery({
    queryKey: ['adminPacotesVendas'],
    queryFn: async () => {
      const { data } = await supabase.from('payments').select('package_id, amount, status');
      const map: Record<string, { vendas: number; receita: number }> = {};
      (data ?? []).forEach((p: { package_id: string | null; amount: number | null; status: string | null }) => {
        if (p.status !== 'paid' || !p.package_id) return;
        if (!map[p.package_id]) map[p.package_id] = { vendas: 0, receita: 0 };
        map[p.package_id].vendas += 1;
        map[p.package_id].receita += p.amount ?? 0;
      });
      return map;
    },
    staleTime: 60_000,
  });

  // Ordena por preço (não pela ordem crua do banco); inclui TODOS os
  // pacotes — inativos ficam esmaecidos com badge, não somem da lista
  const sortedPacotes = [...(pacotes ?? [])].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, currentActive }: { id: string; currentActive: boolean }) =>
      adminService.updateCoinPackage(id, { is_active: !currentActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPacotes'] });
      toast.success('Pacote atualizado com sucesso');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Erro ao atualizar pacote'),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; coins: number; price: number; bonus_coins: number; display_order: number; is_active: boolean }) =>
      editingId
        ? adminService.updateCoinPackage(editingId, {
            name: payload.name, coins: payload.coins, price: payload.price,
            bonus_coins: payload.bonus_coins, display_order: payload.display_order, is_active: payload.is_active,
          })
        : adminService.createCoinPackage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPacotes'] });
      toast.success(editingId ? 'Pacote atualizado com sucesso' : 'Pacote criado com sucesso');
      closeModal();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Erro ao salvar pacote'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (pacote: { id: string; name: string; price: number; coins: number; bonus_coins: number | null; display_order: number | null; is_active: boolean | null }) => {
    setEditingId(pacote.id);
    setForm({
      id: pacote.id,
      name: pacote.name,
      price: pacote.price != null ? String(pacote.price).replace('.', ',') : '',
      coins: String(pacote.coins ?? ''),
      bonus_coins: String(pacote.bonus_coins ?? 0),
      display_order: String(pacote.display_order ?? 0),
      is_active: pacote.is_active ?? true,
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = () => {
    const id = form.id.trim();
    const name = form.name.trim();
    const price = Number(form.price.replace(',', '.'));
    const coins = Number(form.coins);
    const bonusCoins = Number(form.bonus_coins || 0);
    const displayOrder = Number(form.display_order || 0);

    if (!editingId && !id) return setFormError('Informe o ID do pacote (ex: pack_starter).');
    if (!editingId && !/^[a-z0-9_-]+$/.test(id)) return setFormError('ID deve conter apenas letras minúsculas, números, hífen e underscore.');
    if (!editingId && pacotes?.some(p => p.id === id)) return setFormError(`Já existe um pacote com o ID "${id}".`);
    if (!name) return setFormError('Informe o nome do pacote.');
    if (!Number.isFinite(price) || price <= 0) return setFormError('Preço deve ser um número maior que zero.');
    if (!Number.isInteger(coins) || coins <= 0) return setFormError('Quantidade de moedas deve ser um inteiro maior que zero.');
    if (!Number.isInteger(bonusCoins) || bonusCoins < 0) return setFormError('Bônus deve ser um inteiro maior ou igual a zero.');
    if (!Number.isInteger(displayOrder) || displayOrder < 0) return setFormError('Ordem de exibição deve ser um inteiro maior ou igual a zero.');

    setFormError(null);
    saveMutation.mutate({ id, name, coins, price, bonus_coins: bonusCoins, display_order: displayOrder, is_active: form.is_active });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#132540', border: '1px solid rgba(255,255,255,.1)',
    color: 'white', borderRadius: 8, padding: '8px 12px',
    fontSize: 14, outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#4a6580', marginBottom: 6, fontWeight: 600, display: 'block' };

  return (
    <div className="space-y-11 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-9">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gerenciamento de Pacotes de Moedas</h1>
          <p className="text-[#94A3B8] mt-6">Configure os pacotes avulsos disponíveis para os profissionais comprarem lideranças</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-7 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus size={18} /> Novo Pacote
        </button>
      </div>

      {isLoading ? (
         <div className="flex justify-center p-12 bg-[#1C3454] rounded-2xl border border-slate-800"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-11">
           {sortedPacotes.map(pacote => (
             <div key={pacote.id} className="bg-[#1C3454] border border-slate-800 rounded-2xl p-11 flex flex-col relative overflow-hidden group" style={{ opacity: pacote.is_active ? 1 : 0.55 }}>
               <div className="flex justify-between items-start mb-11 z-10 relative">
                  <div>
                    <h3 className="text-xl font-bold text-white">{pacote.name}</h3>
                    <span className={`inline-block mt-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${pacote.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {pacote.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-400">R$ {(pacote.price ?? 0).toFixed(2).replace('.', ',')}</div>
                  </div>
               </div>

               <div className="space-y-9 mb-13 flex-1 z-10 relative">
                  <div className="bg-[#0E1C32] border border-[#1C3050] p-9 rounded-xl flex items-center justify-between">
                     <span className="text-[#94A3B8] text-sm">Moedas</span>
                     <div className="flex items-center gap-7 text-yellow-500 font-bold text-lg">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                       {pacote.coins}
                     </div>
                  </div>
                  {/* Bloco sempre presente pra manter os cards com a mesma altura */}
                  {pacote.bonus_coins > 0 ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-xl flex justify-between items-center text-sm text-emerald-400">
                      <span>Bônus</span>
                      <span className="font-bold">+{pacote.bonus_coins}</span>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] border border-white/5 p-8 rounded-xl flex justify-between items-center text-sm text-slate-600">
                      <span>Bônus</span>
                      <span>—</span>
                    </div>
                  )}
                  <div className="bg-[#0E1C32] border border-[#1C3050] p-8 rounded-xl grid grid-cols-2 gap-8 text-sm">
                    <div>
                      <p className="text-[#4A6580] text-xs uppercase tracking-wide mb-4">Vendas</p>
                      <p className="text-white font-bold">{salesStats[pacote.id]?.vendas ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[#4A6580] text-xs uppercase tracking-wide mb-4">Receita</p>
                      <p className="text-emerald-400 font-bold">R$ {(((salesStats[pacote.id]?.receita ?? 0)) / 100).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                </div>

               <div className="flex items-center gap-8 mt-auto pt-6 border-t border-[#1C3050] z-10 relative">
                  <button
                    onClick={() => openEdit(pacote)}
                    className="flex-1 flex items-center justify-center gap-7 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  <button
                    onClick={() => toggleStatusMutation.mutate({ id: pacote.id, currentActive: pacote.is_active })}
                    disabled={toggleStatusMutation.isPending}
                    className={`flex items-center justify-center gap-1 py-2.5 px-3 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${pacote.is_active ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}
                    title={pacote.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {toggleStatusMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : pacote.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
               </div>
             </div>
           ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }} onClick={closeModal} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 440, background: '#0E1C32', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#10b981,#059669)' }} />

            <div style={{ background: '#132540', padding: '1.25rem', paddingTop: '1.5rem', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>
                {editingId ? `Editar pacote — ${form.name || editingId}` : 'Novo pacote de moedas'}
              </p>
              <button onClick={closeModal} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,0,0,.3)', border: 'none', color: '#4a6580', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {!editingId && (
                <div>
                  <label style={labelStyle}>ID do pacote *</label>
                  <input
                    type="text"
                    placeholder="ex: pack_starter"
                    value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                    style={inputStyle}
                  />
                  <p style={{ fontSize: 10, color: '#4a6580', margin: '4px 0 0' }}>Identificador único usado no checkout — não pode ser alterado depois.</p>
                </div>
              )}

              <div>
                <label style={labelStyle}>Nome *</label>
                <input
                  type="text"
                  placeholder="ex: Básico"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>Preço (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="24,90"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Moedas *</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="60"
                    value={form.coins}
                    onChange={e => setForm(f => ({ ...f, coins: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>Moedas bônus</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bonus_coins}
                    onChange={e => setForm(f => ({ ...f, bonus_coins: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ordem de exibição</label>
                  <input
                    type="number"
                    min={0}
                    value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: form.is_active ? 'rgba(16,185,129,.08)' : 'rgba(0,0,0,.2)',
                  border: `1px solid ${form.is_active ? 'rgba(16,185,129,.25)' : 'rgba(255,255,255,.08)'}`,
                  borderRadius: 8, padding: '0.625rem 0.875rem', cursor: 'pointer', width: '100%',
                }}
              >
                <span style={{ fontSize: 13, color: form.is_active ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                  {form.is_active ? 'Pacote ativo — visível para compra' : 'Pacote inativo — oculto da loja'}
                </span>
                {form.is_active ? <ToggleRight size={20} color="#34d399" /> : <ToggleLeft size={20} color="#4a6580" />}
              </button>

              {formError && (
                <p style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '0.5rem 0.75rem', margin: 0 }}>
                  {formError}
                </p>
              )}
            </div>

            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(90deg,#10b981,#059669)', border: 'none', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saveMutation.isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {editingId ? 'Salvar alterações' : 'Criar pacote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
