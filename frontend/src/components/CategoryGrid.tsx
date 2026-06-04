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
    <section className="py-28 bg-[#0E1C32] border-t border-slate-800/50">
      <div className="container-app">

        <div className="text-center" style={{ marginBottom: '6rem' }}>
          <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ marginBottom: '2rem' }}>
            Serviços disponíveis em <span className="text-emerald-400">{userCity}</span>
          </h2>
          <p className="text-base leading-relaxed text-[#94A3B8]" style={{ marginBottom: '0rem' }}>
            Encontre o profissional certo para cada necessidade
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginBottom: '4rem' }}>
          {categories.map(cat => (
            <Link
              key={cat.slug}
              to={`/login?mode=signup&servico=${cat.slug}`}
              className="group flex flex-col items-center gap-3 bg-[#1C3454] hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 transition-all duration-200"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform duration-200">
                {cat.emoji}
              </span>
              <span className="text-white font-bold text-sm text-center group-hover:text-emerald-400 transition-colors">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-slate-400" style={{ marginBottom: '1.5rem' }}>
            Não encontrou o que precisa?
          </p>
          <Link
            to="/login?mode=signup"
            className="inline-flex items-center gap-2 h-16 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-10 rounded-xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wide"
          >
            Ver todos os serviços →
          </Link>
        </div>

      </div>
    </section>
  );
}
