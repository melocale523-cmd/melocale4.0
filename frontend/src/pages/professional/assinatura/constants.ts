export const STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  active:    { label: 'Ativo',                    colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  canceling: { label: 'Cancela no fim do período', colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20'  },
  canceled:  { label: 'Cancelado',                colorClass: 'bg-red-500/10 text-red-400 border-red-500/20'            },
  past_due:  { label: 'Pagamento Pendente',        colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'  },
  trialing:  { label: 'Em Teste',                 colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'         },
};

export const PLAN_NAMES: Record<string, string> = {
  plan_basic:    'Starter',
  plan_pro:      'PRO',
  plan_business: 'Elite',
};

export const PLAN_LEADS: Record<string, string> = {
  plan_basic:    '25%',
  plan_pro:      '40%',
  plan_business: '55%',
};

export const PLAN_PRICES: Record<string, string> = {
  plan_basic:    '37',
  plan_pro:      '67',
  plan_business: '127',
};

export const SUBSCRIPTION_PLANS = [
  {
    id: 'plan_basic',
    name: 'Starter',
    price: '37',
    description: 'Comece a receber clientes',
    discount: '25%',
    color: 'blue',
    popular: false,
    welcomeCoins: 30,
    features: [
      '25% desconto em moedas avulsas',
      'Badge ✅ VERIFICADO',
      'Perfil público visível',
      'Suporte por chat',
    ],
    savings: 'Pacote R$59,90 → R$44,93',
  },
  {
    id: 'plan_pro',
    name: 'PRO',
    price: '67',
    description: 'Para quem quer crescer de verdade',
    discount: '40%',
    color: 'emerald',
    popular: true,
    welcomeCoins: 80,
    features: [
      '40% desconto em moedas avulsas',
      'Badge ⚡ PRO em destaque',
      '2x mais visível nas buscas',
      'Moedas nunca expiram',
      'Suporte prioritário (2h)',
    ],
    savings: 'Pacote R$59,90 → R$35,94 — plano se paga em 1 compra',
  },
  {
    id: 'plan_business',
    name: 'Elite',
    price: '127',
    description: 'Seja o líder da sua região',
    discount: '55%',
    color: 'yellow',
    popular: false,
    welcomeCoins: 200,
    features: [
      '55% desconto em moedas avulsas',
      'Badge 🏆 ELITE dourado',
      'Topo absoluto das buscas',
      'Até 3 profissionais na conta',
      'Gerente de conta dedicado',
    ],
    savings: 'Pacote R$119,90 → R$53,96',
  },
];
