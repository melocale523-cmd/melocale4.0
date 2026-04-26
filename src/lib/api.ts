export const API_URL = "https://melocale4-0.onrender.com";

/**
 * Utilitário para fazer requisições para a API do backend no Render.
 * Corrige o problema do frontend em Vercel tentar chamar '/api/...' relativo.
 */
export async function apiFetch(path: string, options?: RequestInit) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${normalizedPath}`;
  
  return fetch(url, options);
}

export const api = {
  getProfile: async () => {
    // Simulated delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true };
  },

  getLeads: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      { id: '1', title: 'Pintura completa de apartamento', location: 'São Paulo, SP', price: 150, status: 'open' },
      { id: '2', title: 'Troca de fiação elétrica', location: 'Osasco, SP', price: 80, status: 'open' },
      { id: '3', title: 'Instalação de ar condicionado', location: 'Guarulhos, SP', price: 120, status: 'open' },
    ];
  },

  getWallet: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { balance: 450.00 }; // Saldo simulado em "moedas" da plataforma
  },

  getPurchases: async () => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return [
      { id: '101', leadId: '1', date: '2026-04-20', amount: 150 },
      { id: '102', leadId: '4', date: '2026-04-18', amount: 90 },
    ];
  },
  
  getPedidos: async () => {
     await new Promise(resolve => setTimeout(resolve, 400));
     return [
       { id: '1', title: 'Pintura completa de apartamento', status: 'Orçando', professionals: 3 },
       { id: '2', title: 'Instalação de porcelanato', status: 'Finalizado', professionals: 1 },
     ]
  },
  
  getMensagens: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return [
        { id: '1', from: 'Carlos Pinto (Pintor)', lastMessage: 'Posso ir ver o local amanhã?', unread: true },
        { id: '2', from: 'Suporte Melocale', lastMessage: 'Seu pedido foi aprovado.', unread: false },
      ]
  }
};
