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
    <section className="py-10 md:py-20 bg-[#0E1C32] border-t border-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Serviços disponíveis em <span className="text-emerald-400">{userCity}</span>
          </h2>
          <p className="text-[#94A3B8] text-sm sm:text-base">
            Encontre o profissional certo para cada necessidade
          </p>
        </div>

        {/* Grid 4x2 desktop / 2x4 mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10">
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

        {/* CTA */}
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-4">
            Não encontrou o que precisa?
          </p>
          <Link
            to="/login?mode=signup"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-3 rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wide"
          >
            Ver todos os serviços →
          </Link>
        </div>

      </div>
    </section>
  );
}
