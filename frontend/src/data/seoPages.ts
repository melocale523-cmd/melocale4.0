export interface SeoPageData {
  slug: string;
  categoriaSlug: string;
  cidadeSlug: string;
  categoriaDisplay: string;
  cidadeDisplay: string;
  title: string;
  metaDescription: string;
  h1: string;
  paragraphs: string[];
}

const categorias: { slug: string; display: string; paragraphs: (cidade: string) => string[] }[] = [
  {
    slug: 'eletricista',
    display: 'Eletricista',
    paragraphs: (cidade) => [
      `Precisa de um eletricista em ${cidade}? No MeloCalé você encontra profissionais qualificados para instalações elétricas residenciais e comerciais, troca de disjuntores, reparo de curtos-circuitos, instalação de luminárias, tomadas e quadros de distribuição.`,
      `Eletricistas cadastrados no MeloCalé em ${cidade} passam por verificação de perfil e são avaliados por outros clientes. Você descreve o serviço, recebe contato dos profissionais disponíveis e escolhe o melhor custo-benefício — tudo de forma segura e rápida.`,
    ],
  },
  {
    slug: 'encanador',
    display: 'Encanador',
    paragraphs: (cidade) => [
      `Encontre encanadores de confiança em ${cidade} pelo MeloCalé. Nossos profissionais atuam em consertos de vazamentos, desentupimento de pias, ralos e tubulações, instalação de caixas d'água, torneiras, chuveiros e todo tipo de serviço hidráulico.`,
      `Com o MeloCalé em ${cidade} você não precisa sair de casa para procurar encanador: publique seu pedido, receba orçamentos e contrate o profissional com as melhores avaliações na sua região.`,
    ],
  },
  {
    slug: 'pintor',
    display: 'Pintor',
    paragraphs: (cidade) => [
      `Quer renovar sua casa ou comércio em ${cidade}? Encontre pintores experientes no MeloCalé. Nossos profissionais realizam pintura interna e externa, aplicação de textura, massa corrida, grafiato e reparo de paredes — residências, apartamentos e estabelecimentos comerciais.`,
      `Pintores em ${cidade} conectados ao MeloCalé apresentam portfólio, são avaliados por clientes anteriores e você pode solicitar orçamento sem compromisso diretamente pelo aplicativo.`,
    ],
  },
  {
    slug: 'pedreiro',
    display: 'Pedreiro',
    paragraphs: (cidade) => [
      `Precisa de pedreiro em ${cidade} para reforma, construção ou reparos? No MeloCalé você contrata profissionais experientes em alvenaria, assentamento de pisos e azulejos, reboco, contra-piso, demolição e todo tipo de obra residencial ou comercial.`,
      `Publique seu projeto no MeloCalé, receba propostas de pedreiros qualificados em ${cidade} e acompanhe as avaliações de outros clientes para contratar com segurança.`,
    ],
  },
  {
    slug: 'marceneiro',
    display: 'Marceneiro',
    paragraphs: (cidade) => [
      `Encontre marceneiros habilidosos em ${cidade} pelo MeloCalé. Nossos profissionais executam fabricação de móveis planejados, armários embutidos, bancadas, reparos em portas e janelas de madeira, montagem de móveis e trabalhos de carpintaria em geral.`,
      `Com o MeloCalé em ${cidade} você compara orçamentos de marceneiros locais, vê avaliações de trabalhos anteriores e agenda o serviço de forma prática pelo aplicativo.`,
    ],
  },
  {
    slug: 'jardineiro',
    display: 'Jardineiro',
    paragraphs: (cidade) => [
      `Mantenha seu jardim sempre bonito com jardineiros profissionais em ${cidade} cadastrados no MeloCalé. Serviços de corte de grama, poda de árvores e arbustos, paisagismo, plantio, adubação e manutenção de jardins residenciais e corporativos.`,
      `Jardineiros em ${cidade} disponíveis no MeloCalé atendem sob demanda ou em contratos periódicos. Publique seu pedido, receba orçamentos e contrate com facilidade.`,
    ],
  },
  {
    slug: 'diarista',
    display: 'Diarista',
    paragraphs: (cidade) => [
      `Precisa de diarista em ${cidade}? O MeloCalé conecta você com profissionais de limpeza residencial experientes e com boas avaliações. Serviços de faxina completa, limpeza pós-obra, organização de ambientes, higienização de banheiros, cozinhas e quartos.`,
      `Diaristas cadastradas no MeloCalé em ${cidade} são avaliadas por outros moradores da cidade. Solicite pelo aplicativo, escolha a disponibilidade e agende com praticidade.`,
    ],
  },
  {
    slug: 'ar-condicionado',
    display: 'Técnico de Ar-Condicionado',
    paragraphs: (cidade) => [
      `Seu ar-condicionado com defeito ou precisando de higienização em ${cidade}? Encontre técnicos especializados no MeloCalé. Nossos profissionais realizam instalação, manutenção preventiva, higienização, recarga de gás e reparo de aparelhos split, janela e multi-split.`,
      `Técnicos de ar-condicionado em ${cidade} conectados ao MeloCalé atendem marcas como Samsung, LG, Electrolux, Midea e outras. Solicite pelo app e agende no melhor horário para você.`,
    ],
  },
  {
    slug: 'tecnico-de-informatica',
    display: 'Técnico de Informática',
    paragraphs: (cidade) => [
      `Encontre técnicos de informática em ${cidade} pelo MeloCalé. Nossos profissionais prestam suporte técnico para computadores e notebooks, formatação, remoção de vírus, configuração de redes Wi-Fi, troca de peças, recuperação de dados e instalação de programas.`,
      `Técnicos em ${cidade} disponíveis no MeloCalé atendem tanto na sua casa ou empresa quanto de forma remota. Publique seu problema, receba propostas e resolva rapidamente.`,
    ],
  },
  {
    slug: 'gesseiro',
    display: 'Gesseiro',
    paragraphs: (cidade) => [
      `Procura gesseiro em ${cidade} para acabamentos sofisticados? No MeloCalé você encontra profissionais especializados em forro de gesso, sancas, molduras, nichos, drywall e divisórias. Serviços residenciais e comerciais com acabamento de qualidade.`,
      `Gesseiros cadastrados no MeloCalé em ${cidade} apresentam portfólio de trabalhos e são avaliados por clientes reais. Solicite orçamento sem compromisso diretamente pelo aplicativo.`,
    ],
  },
  {
    slug: 'dedetizador',
    display: 'Dedetizador',
    paragraphs: (cidade) => [
      `Livre-se de pragas com dedetizadores profissionais em ${cidade} pelo MeloCalé. Controle de baratas, formigas, cupins, ratos, mosquitos, escorpiões e outros insetos. Aplicação de produtos certificados, seguros para crianças e animais de estimação.`,
      `Dedetizadores em ${cidade} disponíveis no MeloCalé emitem laudo técnico e utilizam produtos aprovados pela Anvisa. Solicite orçamento e programe a visita pelo aplicativo.`,
    ],
  },
];

const cidades: { slug: string; display: string }[] = [
  { slug: 'salvador', display: 'Salvador' },
  { slug: 'jacobina', display: 'Jacobina' },
  { slug: 'feira-de-santana', display: 'Feira de Santana' },
  { slug: 'irece', display: 'Irecê' },
  { slug: 'senhor-do-bonfim', display: 'Senhor do Bonfim' },
];

export const seoPages: SeoPageData[] = categorias.flatMap((cat) =>
  cidades.map((cidade) => {
    const slug = `${cat.slug}-em-${cidade.slug}`;
    const h1 = `${cat.display} em ${cidade.display}`;
    return {
      slug,
      categoriaSlug: cat.slug,
      cidadeSlug: cidade.slug,
      categoriaDisplay: cat.display,
      cidadeDisplay: cidade.display,
      title: `${cat.display} em ${cidade.display} | MeloCalé`,
      metaDescription: `Contrate ${cat.display.toLowerCase()} em ${cidade.display} com facilidade pelo MeloCalé. Profissionais avaliados, orçamento rápido e serviço de qualidade na sua cidade.`,
      h1,
      paragraphs: cat.paragraphs(cidade.display),
    };
  })
);

export const seoPagesBySlug = new Map(seoPages.map((p) => [p.slug, p]));
