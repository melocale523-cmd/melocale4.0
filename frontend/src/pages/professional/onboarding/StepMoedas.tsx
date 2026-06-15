import { Loader2, ArrowLeft, ShoppingCart } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/authStore';

interface StepMoedasProps {
  completeMutation: UseMutationResult<void, Error, void>;
  onBack: () => void;
}

export function StepMoedas({ completeMutation, onBack }: StepMoedasProps) {
  const [buying, setBuying] = useState(false);
  const { user } = useAuthStore();

  const handleBuy = async () => {
    setBuying(true);
    try {
      await completeMutation.mutateAsync();
      const res = await apiFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: 'pack_starter',
          user_id: user!.id,
        }),
      });
      if (!res.ok) throw new Error('Erro ao abrir checkout');
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar.');
      setBuying(false);
    }
  };

  const handleSkip = async () => {
    await completeMutation.mutateAsync();
  };

  const saldo = 20;
  const custo = 60;
  const faltam = custo - saldo;
  const pct = Math.round((saldo / custo) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🪙</div>
        <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Quase lá! Faltam {faltam} moedas
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Você ganhou {saldo} moedas de boas-vindas — cada lead custa {custo}
        </p>
      </div>

      {/* Saldo card */}
      <div style={{ background: '#0a1928', border: '1px solid #1C3050', borderRadius: '.75rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Seu saldo atual</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', fontFamily: 'DM Mono, monospace' }}>{saldo} moedas</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Custo por lead</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', fontFamily: 'DM Mono, monospace' }}>{custo} moedas</span>
        </div>
        <div style={{ height: 1, background: '#1C3050', marginBottom: 10 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>Faltam</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#f87171', fontFamily: 'DM Mono, monospace' }}>{faltam} moedas</span>
        </div>
        <div style={{ marginTop: 8, background: '#1C3050', borderRadius: 999, height: 5 }}>
          <div style={{ width: `${pct}%`, background: '#f59e0b', borderRadius: 999, height: 5 }} />
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'right' }}>{saldo} / {custo} moedas</div>
      </div>

      {/* Dica */}
      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '.75rem', padding: '.875rem', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <div>
          <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 700, marginBottom: 2 }}>Pacote recomendado para começar</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>60 moedas por R$24,90 — acesse seu primeiro cliente hoje</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <button
          type="button"
          onClick={handleBuy}
          disabled={buying || completeMutation.isPending}
          style={{ width: '100%', height: 52, background: '#10b981', border: 'none', borderRadius: '1rem', color: '#fff', fontSize: 14, fontWeight: 900, cursor: buying ? 'not-allowed' : 'pointer', opacity: buying ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif', letterSpacing: '.03em' }}
        >
          {buying ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ShoppingCart size={18} />}
          {buying ? 'Aguarde...' : 'Comprar 60 moedas — R$24,90'}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={completeMutation.isPending || buying}
          style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', padding: '8px 0', fontFamily: 'DM Sans, sans-serif' }}
        >
          Ver todos os pacotes de moedas
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={completeMutation.isPending || buying}
          style={{ width: '100%', height: 40, background: 'none', border: 'none', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' }}
        >
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    </div>
  );
}
