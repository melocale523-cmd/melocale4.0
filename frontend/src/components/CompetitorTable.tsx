import { Link } from 'react-router-dom';
import { ShieldCheck, Zap, MapPin, CreditCard } from 'lucide-react';

interface Props {
  userCity: string;
}

interface Feature {
  label: string;
  melocale: boolean;
  a: boolean;
  b: boolean;
}

const features: Feature[] = [
  { label: 'Preço acessível',           melocale: true,  a: false, b: true  },
  { label: 'Foco no interior da BA',    melocale: true,  a: false, b: false },
  { label: 'Suporte humano',            melocale: true,  a: true,  b: false },
  { label: 'Moedas / cashback',         melocale: true,  a: false, b: false },
  { label: 'Profissionais verificados', melocale: true,  a: true,  b: false },
];

function Check({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-emerald-400 text-xl font-bold">✅</span>
    : <span className="text-red-400 text-xl font-bold">❌</span>;
}

export default function CompetitorTable({ userCity }: Props) {
  return (
    <section id="como-funciona" className="pt-6 pb-10 md:py-24 bg-[#0B1729] border-t border-slate-800/50 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Container principal: cards à esquerda + tabela à direita */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-8 md:mb-12 md:items-start">

          {/* Coluna esquerda: 4 cards verticais */}
          <div className="hidden md:flex flex-col gap-2 md:w-56 shrink-0 md:order-1">

            {/* Card 1 — Profissionais Verificados */}
            <div className="relative bg-gradient-to-br from-emerald-600/20 to-emerald-500/5 border border-emerald-500/40 rounded-2xl p-2 md:p-3 flex flex-col">
              <span className="absolute top-3 right-3 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">✓ Verificado</span>
              <ShieldCheck size={18} className="text-emerald-400 mb-1" />
              <p className="text-lg font-black text-emerald-400">371+</p>
              <p className="text-[11px] text-slate-400">profissionais verificados na Bahia</p>
              <h3 className="text-white font-bold text-xs mt-1">Profissionais Verificados</h3>
              <p className="text-[#94A3B8] text-[11px] mt-1">Checagem manual, documentos e avaliações reais de clientes.</p>
            </div>

            {/* Card 2 — Atendimento Rápido */}
            <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-2 md:p-3 flex flex-col">
              <Zap size={18} className="text-yellow-400 mb-1" />
              <p className="text-lg font-black text-yellow-400">{'< 2h'}</p>
              <p className="text-[11px] text-slate-400">tempo médio de resposta</p>
              <h3 className="text-white font-bold text-xs mt-1">Atendimento Rápido</h3>
              <p className="text-[#94A3B8] text-[11px] mt-1">Orçamentos chegam em minutos.</p>
            </div>

            {/* Card 3 — Perto de Você */}
            <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-2 md:p-3 flex flex-col">
              <MapPin size={18} className="text-blue-400 mb-1" />
              <p className="text-lg font-black text-blue-400 truncate">{userCity}</p>
              <p className="text-[11px] text-slate-400">e região atendida</p>
              <h3 className="text-white font-bold text-xs mt-1">Perto de Você</h3>
              <p className="text-[#94A3B8] text-[11px] mt-1">Profissionais do seu bairro.</p>
            </div>

            {/* Card 4 — Pagamento Seguro */}
            <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-2 md:p-3 flex flex-col">
              <CreditCard size={18} className="text-purple-400 mb-1" />
              <p className="text-lg font-black text-purple-400">100%</p>
              <p className="text-[11px] text-slate-400">das transações protegidas</p>
              <h3 className="text-white font-bold text-xs mt-1">Pagamento Seguro</h3>
              <p className="text-[#94A3B8] text-[11px] mt-1">Garantia em todas as contratações.</p>
            </div>

          </div>

          {/* Coluna direita: título grande + tabela comparativa */}
          <div className="flex-1 min-w-0 order-1 md:order-2">

            {/* Título grande */}
            <div className="mb-6 text-center">
              <h2 className="text-3xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
                Por que escolher o <span className="text-emerald-400">MeloCalé</span>?
              </h2>
              <p className="text-[#94A3B8] text-base md:text-lg">
                A plataforma feita para o interior da Bahia — compare e veja a diferença.
              </p>
            </div>

            {/* Cards 2x2 — apenas mobile */}
            <div className="grid grid-cols-2 gap-2 mb-4 md:hidden">
              <div className="relative bg-gradient-to-br from-emerald-600/20 to-emerald-500/5 border border-emerald-500/40 rounded-2xl p-2 flex flex-col overflow-hidden min-w-0">
                <span className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">✓</span>
                <ShieldCheck size={16} className="text-emerald-400 mb-1" />
                <p className="text-base font-black text-emerald-400 truncate">371+</p>
                <p className="text-[10px] text-slate-400">verificados na Bahia</p>
                <h3 className="text-white font-bold text-[11px] mt-1">Profissionais Verificados</h3>
              </div>
              <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-2 flex flex-col overflow-hidden min-w-0">
                <Zap size={16} className="text-yellow-400 mb-1" />
                <p className="text-base font-black text-yellow-400 truncate">{'< 2h'}</p>
                <p className="text-[10px] text-slate-400">tempo de resposta</p>
                <h3 className="text-white font-bold text-[11px] mt-1">Atendimento Rápido</h3>
              </div>
              <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-2 flex flex-col overflow-hidden min-w-0">
                <MapPin size={16} className="text-blue-400 mb-1" />
                <p className="text-base font-black text-blue-400 truncate">{userCity}</p>
                <p className="text-[10px] text-slate-400">e região atendida</p>
                <h3 className="text-white font-bold text-[11px] mt-1">Perto de Você</h3>
              </div>
              <div className="bg-[#1C3454] border border-slate-700 rounded-2xl p-2 flex flex-col overflow-hidden min-w-0">
                <CreditCard size={16} className="text-purple-400 mb-1" />
                <p className="text-base font-black text-purple-400 truncate">100%</p>
                <p className="text-[10px] text-slate-400">transações protegidas</p>
                <h3 className="text-white font-bold text-[11px] mt-1">Pagamento Seguro</h3>
              </div>
            </div>

            {/* Subtítulo da tabela */}
            <div className="mb-3 md:pt-6 text-center">
              <h3 className="text-xl font-bold text-white mb-1">
                MeloCalé vs <span className="text-slate-400">Concorrentes</span>
              </h3>
              <p className="text-[#7A9EBF] text-sm">
                Veja lado a lado por que quem é da Bahia escolhe o MeloCalé.
              </p>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1C3454] border-b border-slate-800">
                    <th className="text-left px-6 py-4 text-[#7A9EBF] font-bold uppercase tracking-widest text-xs w-1/3">
                      Recurso
                    </th>
                    <th className="px-6 py-4 text-center w-1/5">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="text-emerald-400 font-black text-base">MeloCalé</span>
                        <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Melhor escolha
                        </span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-[#7A9EBF] font-bold text-xs uppercase tracking-widest w-1/5">
                      Plataforma A
                    </th>
                    <th className="px-6 py-4 text-center text-[#7A9EBF] font-bold text-xs uppercase tracking-widest w-1/5">
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
                      <td className="px-6 py-4 text-slate-300 font-medium">{f.label}</td>
                      <td className="px-6 py-4 text-center border-x border-emerald-500/30 bg-emerald-500/5">
                        <Check ok={f.melocale} />
                      </td>
                      <td className="px-6 py-4 text-center"><Check ok={f.a} /></td>
                      <td className="px-6 py-4 text-center"><Check ok={f.b} /></td>
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

          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            to="/login?mode=signup"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-4 rounded-xl text-base shadow-xl shadow-emerald-500/20 transition-all uppercase tracking-wide"
          >
            Cadastre-se grátis agora →
          </Link>
          <p className="text-[#4A6580] text-xs mt-3">Sem cartão de crédito • Cancele quando quiser</p>
        </div>

      </div>
    </section>
  );
}
