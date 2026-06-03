import { useQuery } from '@tanstack/react-query';
import { walletService, leadService, transactionService } from '../../services/dbServices';
import { Wallet, ArrowUpRight, ArrowDownRight, CreditCard, Receipt, Loader2, Plus, Coins } from 'lucide-react';
import { cn } from '../../lib/utils';
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
    <div className="w-full space-y-3">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Carteira</h1>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Gerencie seu saldo de moedas para comprar contatos de clientes.
          </p>
        </div>
      </div>

      {/* Balance + Stats */}
      <div className="grid gap-3 md:grid-cols-3">

        {/* Balance Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-emerald-600/30 via-[#1C3454] to-[#0E1C32] border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between shadow-2xl ring-1 ring-emerald-500/20">
          <div className="absolute -right-10 -top-10 text-emerald-500/5 rotate-12">
            <Coins size={160} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-2 bg-emerald-500/10 w-fit px-2 py-1 rounded-lg border border-emerald-500/20">
              <Coins size={12} className="mr-1.5" />
              Saldo Disponível
            </div>
            {isBalanceLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={24} className="text-emerald-500 animate-spin" />
                <span className="text-slate-400 text-sm font-medium">Calculando...</span>
              </div>
            ) : (
              <h2 className="text-3xl font-bold text-white tracking-tight flex items-baseline gap-1.5">
                {Math.floor(typeof balance === 'number' ? balance : 0)}
                <span className="text-base text-emerald-500 font-semibold uppercase tracking-wide">moedas</span>
              </h2>
            )}
          </div>
          <button
            onClick={() => navigate('/profissional/assinatura')}
            className="mt-3 w-full h-10 bg-emerald-500 hover:bg-emerald-400 text-[#0E1C32] px-6 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={16} /> Adicionar Saldo
          </button>
        </div>

        {/* Quick Stats */}
        <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
          <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3 relative overflow-hidden group">
            <div className="w-7 h-7 bg-slate-800/80 rounded-lg flex items-center justify-center mb-2 text-emerald-500 border border-[#1C3050] group-hover:border-emerald-500/30 transition-colors">
              <ArrowDownRight size={16} />
            </div>
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Gasto no Mês</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {stats?.totalSpentCoins ? `${stats.totalSpentCoins}` : '0'}
              <span className="text-sm font-medium text-slate-400 ml-1">moedas</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">≈ R$ {(((stats?.totalSpentCoins ?? 0) / 10)).toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3 relative overflow-hidden group">
            <div className="w-7 h-7 bg-slate-800/80 rounded-lg flex items-center justify-center mb-2 text-blue-400 border border-[#1C3050] group-hover:border-blue-500/30 transition-colors">
              <Receipt size={16} />
            </div>
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Contatos Comprados</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {stats?.contactsPurchased || 0}
              <span className="text-sm font-medium text-slate-400 ml-1">{stats?.contactsPurchased === 1 ? 'cliente' : 'clientes'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <h2 className="text-lg font-bold text-white pt-1">Histórico de Transações</h2>
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl overflow-hidden">
        {transactions && transactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1C3050]">
                <th className="text-left text-xs uppercase tracking-wide text-slate-400 px-3 py-2">Descrição</th>
                <th className="text-left text-xs uppercase tracking-wide text-slate-400 px-3 py-2 hidden sm:table-cell">Data</th>
                <th className="text-right text-xs uppercase tracking-wide text-slate-400 px-3 py-2">Valor</th>
                <th className="text-right text-xs uppercase tracking-wide text-slate-400 px-3 py-2 hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                        tx.type === 'deposit' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"
                      )}>
                        {tx.type === 'deposit' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <span className="text-sm text-slate-200">{tx.description || 'Transação'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <span className="text-xs text-slate-500">
                      {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn(
                      "text-sm font-semibold",
                      tx.type === 'deposit' ? "text-emerald-500" : "text-slate-300"
                    )}>
                      {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)} moedas
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Concluído
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-10 text-center text-slate-500 text-sm">Nenhuma transação encontrada.</div>
        )}
      </div>

    </div>
  );
}
