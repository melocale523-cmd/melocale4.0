import { Link } from 'react-router-dom';

interface Feature {
  label: string;
  melocale: boolean;
  a: boolean;
  b: boolean;
}

const features: Feature[] = [
  { label: 'Preço acessível',          melocale: true,  a: false, b: true  },
  { label: 'Foco no interior da BA',   melocale: true,  a: false, b: false },
  { label: 'Suporte humano',           melocale: true,  a: true,  b: false },
  { label: 'Moedas / cashback',        melocale: true,  a: false, b: false },
  { label: 'Profissionais verificados',melocale: true,  a: true,  b: false },
];

function Check({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-emerald-400 text-xl font-bold">✅</span>
    : <span className="text-red-400 text-xl font-bold">❌</span>;
}

export default function CompetitorTable(_props: { userCity?: string }) {
  return (
    <section className="py-12 bg-[#0B1729] border-t border-slate-800/50">
      <div className="container-app" style={{ paddingLeft: '24rem' }}>

        <div className="text-center mb-6 w-full">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Por que o <span className="text-emerald-400">MeloCalé</span> é a melhor escolha?
          </h2>
          <p className="text-base leading-relaxed text-[#94A3B8] max-w-xl mx-auto text-center">
            Compare e veja por que profissionais e clientes da Bahia preferem o MeloCalé.
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800 max-w-3xl mx-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1C3454] border-b border-slate-800">
                <th className="text-left px-4 py-3 text-[#7A9EBF] font-bold uppercase tracking-widest text-xs w-1/3">
                  Recurso
                </th>
                <th className="px-4 py-3 text-center w-1/5">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="text-emerald-400 font-black text-base">MeloCalé</span>
                    <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Melhor escolha
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-[#7A9EBF] font-bold text-xs uppercase tracking-widest w-1/5">
                  Plataforma A
                </th>
                <th className="px-4 py-3 text-center text-[#7A9EBF] font-bold text-xs uppercase tracking-widest w-1/5">
                  Plataforma B
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={f.label}
                  className={`border-b border-slate-800/60 ${i % 2 === 0 ? 'bg-[#0E1C32]' : 'bg-[#0B1729]'}`}
                >
                  <td className="px-4 py-3 text-slate-300 font-medium">{f.label}</td>
                  <td className="px-4 py-3 text-center border-x border-emerald-500/30 bg-emerald-500/5">
                    <Check ok={f.melocale} />
                  </td>
                  <td className="px-4 py-3 text-center"><Check ok={f.a} /></td>
                  <td className="px-4 py-3 text-center"><Check ok={f.b} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-4">
          {features.map(f => (
            <div key={f.label} className="bg-[#1C3454] border border-slate-800 rounded-2xl p-4">
              <p className="text-white font-bold mb-3 text-sm">{f.label}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-emerald-400 font-black uppercase">MeloCalé</span>
                  <Check ok={f.melocale} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#7A9EBF] uppercase">Plataforma A</span>
                  <Check ok={f.a} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#7A9EBF] uppercase">Plataforma B</span>
                  <Check ok={f.b} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6 text-center max-w-3xl mx-auto">
          <Link
            to="/login?mode=signup"
            className="inline-flex items-center gap-2 h-10 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 rounded-xl text-sm shadow-xl shadow-emerald-500/20 transition-all uppercase tracking-wide"
          >
            Cadastre-se grátis agora →
          </Link>
          <p className="text-[#4A6580] text-xs mt-3">Sem cartão de crédito • Cancele quando quiser</p>
        </div>

      </div>
    </section>
  );
}
