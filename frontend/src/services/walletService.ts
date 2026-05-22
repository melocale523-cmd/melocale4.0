import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface WalletTxRow {
  id: string;
  kind: string;
  amount: number;
  reference?: string | null;
  created_at: string;
  [key: string]: unknown;
}

function formatWalletDescription(kind: string, reference?: string | null): string {
  if (reference?.startsWith('lead_purchase:') || kind === 'debit_lead') return 'Compra de Lead';
  if (kind === 'bonus') return 'Bônus de boas-vindas';
  if (kind === 'subscription') return 'Assinatura';
  if (kind === 'purchase' || kind === 'credit_purchase') return 'Compra de moedas';
  return kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' ');
}

function txType(kind: string): 'deposit' | 'purchase' {
  return kind === 'credit_purchase' || kind === 'deposit' || kind === 'bonus' || kind === 'subscription'
    ? 'deposit'
    : 'purchase';
}

async function getWalletId(professionalId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('id')
    .eq('professional_id', professionalId)
    .single();
  if (error || !data) return null;
  return data.id;
}

export const walletService = {
  async getBalance() {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return 0;

      const { data, error } = await supabase
        .from('v_wallet_balance')
        .select('balance_coins')
        .eq('user_id', userId)
        .single();

      if (error || !data) return 0;

      return data.balance_coins || 0;
    } catch {
      return 0;
    }
  }
};

export const transactionService = {
  async getWalletTransactions() {
    const professionalId = useAuthStore.getState().user?.professionalId;
    if (!professionalId) throw new Error("Professional ID not found");

    const walletId = await getWalletId(professionalId);
    if (!walletId) throw new Error("Wallet not found");

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('id,kind,amount,reference,created_at')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((tx: WalletTxRow) => ({
      ...tx,
      type: txType(tx.kind),
      description: formatWalletDescription(tx.kind, tx.reference),
    }));
  },

  async getRecentTransactions(professionalId: string, limit = 5) {
    const walletId = await getWalletId(professionalId);
    if (!walletId) return [];

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('id,kind,amount,reference,created_at')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((tx: WalletTxRow) => ({
      ...tx,
      type: txType(tx.kind),
      description: formatWalletDescription(tx.kind, tx.reference),
    }));
  },
};

export const subscriptionService = {
  async getCurrentSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id,user_id,stripe_subscription_id,package_id,status,started_at,updated_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data;
  }
};
