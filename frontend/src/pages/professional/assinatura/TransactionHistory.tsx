import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  description: string;
  amount: number;
  created_at: string;
}

interface Props {
  transactions: Transaction[] | undefined;
  isLoading: boolean;
}

export default function TransactionHistory({ transactions, isLoading }: Props) {
  return (
    <div style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Últimas Transações</p>
        <a href="/profissional/carteira" style={{ fontSize: 11, color: '#4A6580', textDecoration: 'none' }}>Ver tudo →</a>
      </div>
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
          <Loader2 size={18} className="animate-spin text-emerald-500" />
        </div>
      ) : transactions && transactions.length > 0 ? (
        <ul style={{ listStyle: 'none' }}>
          {transactions.map((tx) => (
            <li key={tx.id} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid rgba(255,255,255,.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: tx.type === 'deposit' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {tx.type === 'deposit' ? <ArrowUpRight size={13} style={{ color: '#34d399' }} /> : <ArrowDownRight size={13} style={{ color: '#f87171' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description}</p>
                  <p style={{ fontSize: 11, color: '#4A6580' }}>{new Date(tx.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 500, color: tx.type === 'deposit' ? '#34d399' : '#94a3b8', flexShrink: 0 }}>
                {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ textAlign: 'center', color: '#4A6580', fontSize: 12, padding: '1rem' }}>Nenhuma transação encontrada.</p>
      )}
    </div>
  );
}
