import { Professional } from './types';

export const PROFESSIONALS: Professional[] = [
  {
    id: '1',
    name: 'Roberto Silva',
    category: 'Reformas e Reparos',
    rating: 4.9,
    reviewsCount: 124,
    location: 'Pinheiros, São Paulo',
    description: 'Especialista em elétrica e pintura residencial. Mais de 15 anos de experiência com foco em acabamento premium.',
    priceStarting: 150,
    imageUrl: 'https://images.unsplash.com/photo-1581578731522-745d4b45a27e?auto=format&fit=crop&q=80&w=800',
    featured: true,
    specialties: ['Elétrica', 'Pintura', 'Hidráulica']
  },
  {
    id: '2',
    name: 'Mariana Costa',
    category: 'Design e Tecnologia',
    rating: 5.0,
    reviewsCount: 89,
    location: 'Vila Madalena, São Paulo',
    description: 'Designer de Interiores e modelagem 3D. Transformo ambientes com soluções criativas e funcionais.',
    priceStarting: 500,
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800',
    featured: true,
    specialties: ['Interiores', 'AutoCAD', '3D Rendering']
  },
  {
    id: '3',
    name: 'Ana Júlia',
    category: 'Serviços Domésticos',
    rating: 4.8,
    reviewsCount: 256,
    location: 'Itaim Bibi, São Paulo',
    description: 'Limpeza profissional e organização de ambientes. Atendimento personalizado para residências e escritórios.',
    priceStarting: 180,
    imageUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=800',
    specialties: ['Limpeza Pesada', 'Organização', 'Passar Roupa']
  },
  {
    id: '4',
    name: 'Marcos Oliveira',
    category: 'Aulas e Consultoria',
    rating: 4.9,
    reviewsCount: 45,
    location: 'Moema, São Paulo',
    description: 'Professor particular de matemática e física. Metodologia focada em resultados e provas de vestibular.',
    priceStarting: 80,
    imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=800',
    featured: true,
    specialties: ['Matemática', 'Física', 'Cálculo']
  }
];
