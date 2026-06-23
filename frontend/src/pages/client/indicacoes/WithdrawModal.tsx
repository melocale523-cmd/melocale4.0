import { X } from 'lucide-react'
import { UseMutationResult } from '@tanstack/react-query'
import { CoinsData } from './constants'

interface Props {
  show: boolean
  onClose: () => void
  coinsData: CoinsData | undefined
  modalCoinsAmount: string
  setModalCoinsAmount: (v: string) => void
  pixKey: string
  setPixKey: (v: string) => void
  pixKeyType: string
  setPixKeyType: (v: string) => void
  withdrawMutation: UseMutationResult<void, Error, void>
}

export default function WithdrawModal({
  show,
  onClose,
  coinsData,
  modalCoinsAmount,
  setModalCoinsAmount,
  pixKey,
  setPixKey,
  pixKeyType,
  setPixKeyType,
  withdrawMutation,
}: Props) {
  if (!show) return null

  const balance = coinsData?.balance ?? 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#0d1e33', border: '1px solid #1e3a5f', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '400px', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>💸</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Sacar via Pix</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: '#0a1928', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>SALDO DISPONÍVEL</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
            R${(balance / 100).toFixed(2).replace('.', ',')}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {balance.toLocaleString('pt-BR')} moedas · mín. R$10,00 p/ sacar
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Quantidade de moedas</label>
          <input
            type="number"
            value={modalCoinsAmount}
            min={1000}
            max={balance}
            onChange={e => setModalCoinsAmount(e.target.value)}
            style={{ width: '100%', background: '#0a1928', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'DM Mono, monospace', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>
            = R${(Math.max(parseInt(modalCoinsAmount, 10) || 0, 0) / 100).toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Tipo de chave Pix</label>
          <select
            value={pixKeyType}
            onChange={e => setPixKeyType(e.target.value)}
            style={{ width: '100%', background: '#0a1928', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
          >
            <option value="cpf">CPF</option>
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
            <option value="random">Chave aleatória</option>
            <option value="cnpj">CNPJ</option>
          </select>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Chave Pix</label>
          <input
            type="text"
            value={pixKey}
            onChange={e => setPixKey(e.target.value)}
            placeholder={
              pixKeyType === 'cpf' ? '000.000.000-00'
              : pixKeyType === 'email' ? 'seu@email.com'
              : pixKeyType === 'phone' ? '+5511999999999'
              : pixKeyType === 'cnpj' ? '00.000.000/0001-00'
              : 'chave aleatória'
            }
            style={{ width: '100%', background: '#0a1928', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'DM Mono, monospace', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '1.25rem' }}>
          <span style={{ color: '#f59e0b', fontSize: '14px', flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
            Verifique a chave antes de confirmar. O saque é processado em até 24h.
          </span>
        </div>

        <button
          onClick={() => withdrawMutation.mutate()}
          disabled={!pixKey.trim() || withdrawMutation.isPending}
          style={{
            width: '100%', background: withdrawMutation.isPending ? '#065f46' : '#10b981',
            color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 0',
            fontSize: '14px', fontWeight: 700,
            cursor: !pixKey.trim() || withdrawMutation.isPending ? 'not-allowed' : 'pointer',
            opacity: !pixKey.trim() ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {withdrawMutation.isPending ? '⏳ Processando…' : 'Confirmar saque'}
        </button>
      </div>
    </div>
  )
}
