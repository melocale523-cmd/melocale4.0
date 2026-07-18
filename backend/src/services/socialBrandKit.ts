export const MELOCALE_BRAND_KIT = {
  name: 'MeloCal\u00e9',
  country: 'Brasil', language: 'pt-BR',
  logoUrl: process.env.MELOCALE_BRAND_LOGO_URL?.trim() || 'https://www.melocale.com.br/logo.png',
  colors: { navy: '#092D86', royalBlue: '#0B43B8', cyan: '#08BDF2', emerald: '#08734F', ice: '#F4F8FF', coral: '#FF7A59' },
} as const;

export const DEFAULT_HIGHLIGHT_PACKS = [
  { slug: 'comece-aqui', name: 'Comece aqui', category: 'start', description: 'O que \u00e9 a MeloCal\u00e9 e como pedir um or\u00e7amento.', coverColor: MELOCALE_BRAND_KIT.colors.navy, stories: ['Marketplace de servi\u00e7os para todo o Brasil.', 'Escolha o servi\u00e7o que voc\u00ea precisa.', 'Compare profissionais e pe\u00e7a seu or\u00e7amento.', 'A MeloCal\u00e9 ajuda voc\u00ea a come\u00e7ar com clareza.'] },
  { slug: 'para-clientes', name: 'Para clientes', category: 'clients', description: 'Orienta\u00e7\u00f5es para contratar servi\u00e7os com seguran\u00e7a.', coverColor: MELOCALE_BRAND_KIT.colors.royalBlue, stories: ['Explique o que voc\u00ea precisa.', 'Compare propostas com calma.', 'Combine escopo, prazo e forma de pagamento.', 'Pe\u00e7a ajuda quando tiver d\u00favidas.'] },
  { slug: 'para-profissionais', name: 'Profissionais', category: 'professionals', description: 'Como profissionais podem participar do marketplace.', coverColor: MELOCALE_BRAND_KIT.colors.emerald, stories: ['Mostre seu trabalho com clareza.', 'Mantenha seu perfil atualizado.', 'Responda clientes com transpar\u00eancia.', 'Cadastre-se para conhecer a plataforma.'] },
  { slug: 'servicos', name: 'Servi\u00e7os', category: 'services', description: 'Categorias e situa\u00e7\u00f5es em que a MeloCal\u00e9 pode ajudar.', coverColor: MELOCALE_BRAND_KIT.colors.cyan, stories: ['Eletricista, encanador, pintor e muito mais.', 'Conte\u00fado para cuidar da sua casa.', 'Encontre o pr\u00f3ximo passo para o seu servi\u00e7o.', 'Consulte as op\u00e7\u00f5es dispon\u00edveis na plataforma.'] },
  { slug: 'seguranca', name: 'Seguran\u00e7a', category: 'safety', description: 'Boas pr\u00e1ticas antes, durante e depois de contratar.', coverColor: MELOCALE_BRAND_KIT.colors.coral, stories: ['Nunca compartilhe senhas ou c\u00f3digos.', 'Confirme o escopo antes de come\u00e7ar.', 'Registre d\u00favidas e combinados.', 'Seguran\u00e7a vem antes da pressa.'] },
  { slug: 'melocale', name: 'MeloCal\u00e9', category: 'brand', description: 'Nossa proposta, valores e novidades.', coverColor: MELOCALE_BRAND_KIT.colors.navy, stories: ['Conectamos pessoas e profissionais.', 'Conte\u00fado \u00fatil para decis\u00f5es melhores.', 'Uma experi\u00eancia simples e transparente.', 'MeloCal\u00e9: marketplace de servi\u00e7os.'] },
];

export function highlightStoriesFor(pack: typeof DEFAULT_HIGHLIGHT_PACKS[number]) {
  return pack.stories.map((text, index) => ({ id: index + 1, title: pack.name, text, order: index + 1, status: 'ready' as const }));
}
