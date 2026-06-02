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
    <div className="space-y-4 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Carteira</h1>
          <p className="text-[#94A3B8] mt-3">
            Gerencie seu saldo de moedas para comprar contatos de clientes.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Balance Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-emerald-600/30 via-[#1C3454] to-[#0E1C32] border border-emerald-500/30 rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between shadow-2xl ring-1 ring-emerald-500/20">
          <div className="absolute -right-12 -top-12 text-emerald-500/5 rotate-12 transition-transform group-hover:scale-110">
            <Coins size={240} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-3 bg-emerald-500/10 w-fit px-4 py-3 rounded-full border border-emerald-500/20">
              <Coins size={14} className="mr-2" />
              Saldo Disponível
            </div>
            {isBalanceLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 size={32} className="text-emerald-500 animate-spin" />
                <span className="text-[#94A3B8] font-bold">Calculando...</span>
              </div>
            ) : (
              <div className="flex flex-col">
                <h2 className="text-4xl font-black text-white tracking-tighter flex items-baseline gap-2">
                  {Math.floor(typeof balance === 'number' ? balance : 0)}
                  <span className="text-xl text-emerald-500 font-bold uppercase tracking-widest">moedas</span>
                </h2>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/profissional/assinatura')}
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-[#0E1C32] py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex justify-center items-center shadow-xl shadow-emerald-500/20 group/btn active:scale-95">
            <Plus size={20} className="mr-2 group-hover/btn:rotate-90 transition-transform" /> Adicionar Saldo
          </button>
        </div>

        {/* Quick Stats */}
        <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
           <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-11 relative overflow-hidden group">
             <div className="w-10 h-10 bg-slate-800/80 rounded-xl flex items-center justify-center mb-3 text-emerald-500 border border-[#1C3050] group-hover:border-emerald-500/30 transition-colors">
               <ArrowDownRight size={20} />
             </div>
             <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Gasto no Mês</h3>
             <p className="text-3xl font-semibold text-white mt-3">
               {stats?.totalSpentCoins ? `${stats.totalSpentCoins} moedas` : '0 moedas'}
             </p>
             <p className="text-xs text-[#4A6580] mt-3 italic">≈ R$ {(((stats?.totalSpentCoins ?? 0) / 10)).toFixed(2).replace('.', ',')}</p>
           </div>
           <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-11 relative overflow-hidden group">
             <div className="w-10 h-10 bg-slate-800/80 rounded-xl flex items-center justify-center mb-3 text-blue-400 border border-[#1C3050] group-hover:border-blue-500/30 transition-colors">
               <Receipt size={20} />
             </div>
             <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Contatos Comprados</h3>
             <p className="text-3xl font-semibold text-white mt-3">
               {stats?.contactsPurchased || 0} {stats?.contactsPurchased === 1 ? 'cliente' : 'clientes'}
             </p>
           </div>
        </div>
      </div>

      {/* Transaction History */}
      <h2 className="text-lg font-bold text-white pt-4">Histórico de Transações</h2>
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl overflow-hidden shadow-xl">
        <ul className="divide-y divide-slate-800/50">
          {transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <li key={tx.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    tx.type === 'deposit' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"
                  )}>
                    {tx.type === 'deposit' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-200">{tx.description || 'Transação'}</p>
                    <p className="text-xs text-[#4A6580] mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold",
                    tx.type === 'deposit' ? "text-emerald-500" : "text-slate-300"
                  )}>
                    {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)} moedas
                  </p>
                  <p className="text-xs text-emerald-500/70 mt-0.5 font-medium">Concluído</p>
                </div>
              </li>
            ))
          ) : (
            <li className="p-10 text-center text-[#4A6580]">Nenhuma transação encontrada.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
