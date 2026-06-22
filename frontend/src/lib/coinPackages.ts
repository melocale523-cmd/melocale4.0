export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: string;
  priceNum: number;
  description: string;
  bonus: number;
  popular?: boolean;
}

export const CREDIT_PACKAGES: CoinPackage[] = [
  {
    id: 'pack_starter',
    name: 'Básico',
    coins: 60,
    price: '24,90',
    priceNum: 24.90,
    description: 'Para o primeiro cliente',
    bonus: 0,
  },
  {
    id: 'pack_pro',
    name: 'Popular',
    coins: 180,
    price: '59,90',
    priceNum: 59.90,
    description: 'Melhor custo por moeda',
    bonus: 20,
    popular: true,
  },
  {
    id: 'pack_premium',
    name: 'Máximo',
    coins: 480,
    price: '119,90',
    priceNum: 119.90,
    description: 'Para não perder nenhum lead',
    bonus: 80,
  },
];

export function getCoinPackage(id: string): CoinPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
