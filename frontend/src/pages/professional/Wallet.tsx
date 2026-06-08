import { useQuery } from '@tanstack/react-query';
import { walletService, leadService, transactionService } from '../../services/dbServices';
import { Wallet, ArrowUpRight, ArrowDownRight, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProfessionalWallet() {
  const navigate = useNavigate();

  const { data: balance, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['professionalStats'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => leadService.getProfessionalStats('30d'),
  });

  const { data: transactions, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ['walletTransactions'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: transactionService.getWalletTransactions,
  });

  const isLoading = isBalanceLoading || isStatsLoading || isTransactionsLoading;

  if (isLoading && !transactions) return <LoadingSpinner />;

  return (
    <div className="w-full space-y-5" style={{ fontFamily:"'DM Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.25rem' }}>Carteira</p>
          <h1 style={{ fontSize:'1.25rem', fontWeight:900, color:'white', marginBottom:'0.25rem' }}>Meu Saldo de Moedas</h1>
          <p style={{ fontSize:'0.75rem', color:'#4A6580' }}>Gerencie seu saldo para comprar contatos de clientes.</p>
        </div>
        <button
          onClick={() => navigate('/profissional/assinatura')}
          style={{ height:'2.5rem', padding:'0 1.25rem', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:'0.75rem', color:'white', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.375rem', boxShadow:'0 4px 16px rgba(16,185,129,.25)' }}
        >
          <Plus size={15} /> Adicionar Saldo
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem' }}>
        {/* Saldo */}
        <div style={{ background:'linear-gradient(145deg,#0a1928,#0e2038)', border:'1px solid rgba(16,185,129,.22)', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <div style={{ position:'absolute', top:'-1.875rem', right:'-1.875rem', width:'6.25rem', height:'6.25rem', background:'radial-gradient(circle,rgba(16,185,129,.08),transparent 70%)', pointerEvents:'none' }} />
          <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.5rem' }}>Saldo disponível</p>
          {isBalanceLoading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Loader2 size={20} className="animate-spin" style={{ color:'#10b981' }} />
              <span style={{ fontSize:'0.75rem', color:'#4A6580' }}>Calculando...</span>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'baseline', gap:'0.375rem' }}>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:'2.25rem', fontWeight:900, color:'#34d399', lineHeight:1, letterSpacing:'-1px' }}>
                {Math.floor(typeof balance === 'number' ? balance : 0)}
              </p>
              <span style={{ fontSize:'0.8125rem', color:'#10b981', fontWeight:700 }}>moedas</span>
            </div>
          )}
          <p style={{ fontSize:'0.6875rem', color:'#4A6580', marginTop:'0.375rem' }}>
            ≈ R$ {(Math.floor(typeof balance === 'number' ? balance : 0) * 0.311).toFixed(2).replace('.', ',')} em leads
          </p>
        </div>

        {/* Gasto no mês */}
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#f87171,#dc2626)' }} />
          <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.5rem' }}>Gasto no mês</p>
          <div style={{ display:'flex', alignItems:'baseline', gap:'0.375rem' }}>
            <p style={{ fontFamily:"'DM Mono',monospace", fontSize:'2.25rem', fontWeight:900, color:'white', lineHeight:1, letterSpacing:'-1px' }}>
              {stats?.totalSpentCoins ?? 0}
            </p>
            <span style={{ fontSize:'0.8125rem', color:'#4A6580', fontWeight:500 }}>moedas</span>
          </div>
          <p style={{ fontSize:'0.6875rem', color:'#4A6580', marginTop:'0.375rem' }}>
            ≈ R$ {((stats?.totalSpentCoins ?? 0) * 0.311).toFixed(2).replace('.', ',')}
          </p>
        </div>

        {/* Contatos comprados */}
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#60a5fa,#378ADD)' }} />
          <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.5rem' }}>Contatos comprados</p>
          <div style={{ display:'flex', alignItems:'baseline', gap:'0.375rem' }}>
            <p style={{ fontFamily:"'DM Mono',monospace", fontSize:'2.25rem', fontWeight:900, color:'#60a5fa', lineHeight:1, letterSpacing:'-1px' }}>
              {stats?.contactsPurchased ?? 0}
            </p>
            <span style={{ fontSize:'0.8125rem', color:'#4A6580', fontWeight:500 }}>{stats?.contactsPurchased === 1 ? 'cliente' : 'clientes'}</span>
          </div>
          <p style={{ fontSize:'0.6875rem', color:'#4A6580', marginTop:'0.375rem' }}>nos últimos 30 dias</p>
        </div>
      </div>

      {/* CTA comprar moedas */}
      <div style={{ background:'linear-gradient(135deg,rgba(16,185,129,.08),rgba(5,150,105,.05))', border:'1px solid rgba(16,185,129,.2)', borderRadius:'1.125rem', padding:'1.25rem 1.5rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#10b981,#059669)' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <p style={{ fontSize:'0.9375rem', fontWeight:900, color:'white', marginBottom:'0.25rem' }}>💡 Precisa de mais moedas?</p>
            <p style={{ fontSize:'0.75rem', color:'#4A6580' }}>Compre moedas avulsas ou assine um plano e pague até <span style={{ color:'#34d399', fontWeight:600 }}>55% menos</span> por moeda.</p>
          </div>
          <button
            onClick={() => navigate('/profissional/assinatura')}
            style={{ height:'2.5rem', padding:'0 1.25rem', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:'0.75rem', color:'white', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(16,185,129,.25)', whiteSpace:'nowrap' }}
          >
            Ver planos e pacotes →
          </button>
        </div>
      </div>

      {/* Histórico de Transações */}
      <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', overflow:'hidden' }}>
        <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #1C3050', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white' }}>Histórico de Transações</p>
          {transactions && transactions.length > 0 && (
            <span style={{ fontSize:'0.6875rem', color:'#4A6580', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', padding:'2px 8px', borderRadius:'1.25rem', fontFamily:'monospace' }}>
              {transactions.length}
            </span>
          )}
        </div>

        {isTransactionsLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}>
            <Loader2 size={20} className="animate-spin" style={{ color:'#10b981' }} />
          </div>
        ) : transactions && transactions.length > 0 ? (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'rgba(0,0,0,.2)' }}>
                <th style={{ padding:'0.625rem 1rem', textAlign:'left', fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580' }}>Descrição</th>
                <th style={{ padding:'0.625rem 1rem', textAlign:'left', fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580' }}>Data</th>
                <th style={{ padding:'0.625rem 1rem', textAlign:'right', fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580' }}>Valor</th>
                <th style={{ padding:'0.625rem 1rem', textAlign:'right', fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <td style={{ padding:'0.75rem 1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <div style={{ width:'1.75rem', height:'1.75rem', borderRadius:'50%', background: tx.type === 'deposit' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {tx.type === 'deposit'
                          ? <ArrowUpRight size={14} style={{ color:'#34d399' }} />
                          : <ArrowDownRight size={14} style={{ color:'#f87171' }} />}
                      </div>
                      <span style={{ fontSize:'0.8125rem', color:'#e2e8f0' }}>{tx.description || 'Transação'}</span>
                    </div>
                  </td>
                  <td style={{ padding:'0.75rem 1rem' }}>
                    <span style={{ fontSize:'0.75rem', color:'#4A6580' }}>
                      {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td style={{ padding:'0.75rem 1rem', textAlign:'right' }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.8125rem', fontWeight:600, color: tx.type === 'deposit' ? '#34d399' : '#94a3b8' }}>
                      {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)} moedas
                    </span>
                  </td>
                  <td style={{ padding:'0.75rem 1rem', textAlign:'right' }}>
                    <span style={{ fontSize:'0.6875rem', fontWeight:600, padding:'2px 8px', borderRadius:'1.25rem', background:'rgba(16,185,129,.1)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)' }}>
                      Concluído
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'3rem', gap:'0.75rem', textAlign:'center' }}>
            <div style={{ width:'3rem', height:'3rem', borderRadius:'50%', background:'rgba(96,165,250,.1)', border:'1px solid rgba(96,165,250,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Wallet size={22} style={{ color:'#60a5fa' }} />
            </div>
            <p style={{ fontSize:'0.8125rem', color:'white', fontWeight:500 }}>Nenhuma transação encontrada</p>
            <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Suas transações aparecerão aqui após comprar moedas.</p>
          </div>
        )}
      </div>

    </div>
  );
}
