import { Link } from 'react-router-dom';

const categories = [
  { emoji: '⚡', label: 'Eletricista',      slug: 'eletricista' },
  { emoji: '🔧', label: 'Encanador',        slug: 'encanador' },
  { emoji: '🎨', label: 'Pintor',           slug: 'pintor' },
  { emoji: '🧹', label: 'Limpeza',          slug: 'limpeza' },
  { emoji: '🪚', label: 'Marceneiro',       slug: 'marceneiro' },
  { emoji: '❄️', label: 'Ar Condicionado',  slug: 'ar-condicionado' },
  { emoji: '🏗️', label: 'Pedreiro',        slug: 'pedreiro' },
  { emoji: '🌿', label: 'Jardineiro',       slug: 'jardineiro' },
];

interface Props {
  userCity: string;
}

export default function CategoryGrid({ userCity }: Props) {
  return (
    <section className="py-28" style={{ background: '#0f172a', borderTop: '2px solid #f59e0b' }}>
      <div className="container-app">

        <div className="text-center" style={{ marginBottom: '2rem' }}>
          <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ marginBottom: '0.75rem' }}>
            Serviços disponíveis em <span className="text-emerald-400">{userCity}</span>
          </h2>
          <p className="text-base leading-relaxed text-[#94A3B8]" style={{ marginBottom: '0rem' }}>
            Encontre o profissional certo para cada necessidade
          </p>
        </div>

        <div className="landing-category-grid grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginBottom: '2rem', maxWidth: '65rem', margin: '0 auto 2rem', transform: 'translateX(2rem)' }}>
          {categories.map(cat => (
            <Link
              key={cat.slug}
              to={`/login?mode=signup&servico=${cat.slug}`}
              className="group flex flex-col items-center gap-3 bg-[#1e2d45] hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 transition-all duration-200"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
                {cat.emoji}
              </span>
              <span className="text-white font-bold text-sm text-center group-hover:text-emerald-400 transition-colors">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-slate-400" style={{ marginBottom: '0.75rem' }}>
            Não encontrou o que precisa?
          </p>
          <Link
            to="/login?mode=signup"
            className="cta-pulse inline-flex items-center gap-2 h-16 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-10 rounded-xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wide"
          >
            Ver todos os serviços →
          </Link>
        </div>

      </div>
    </section>
  );
}
