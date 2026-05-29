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
    <section id="como-funciona" className="py-24 bg-[#0B1729] border-t border-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Título único */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Por que escolher o <span className="text-emerald-400">MeloCalé</span>?
          </h2>
          <p className="text-[#94A3B8] max-w-xl mx-auto text-lg">
            A plataforma feita para o interior da Bahia — compare e veja a diferença.
          </p>
        </div>

        {/* Cards de benefícios */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-6">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Profissionais Verificados</h3>
            <p className="text-[#94A3B8] text-sm">Todos os profissionais passam por verificação de documentos e avaliações</p>
          </div>
          <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Atendimento Rápido</h3>
            <p className="text-[#94A3B8] text-sm">Receba orçamentos em minutos e agende serviços rapidamente</p>
          </div>
          <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-6">
              <MapPin size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Perto de Você</h3>
            <p className="text-[#94A3B8] text-sm">Profissionais qualificados nos melhores bairros de {userCity}</p>
          </div>
          <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6">
              <CreditCard size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Pagamento Seguro</h3>
            <p className="text-[#94A3B8] text-sm">Múltiplas opções de pagamento com garantia e proteção</p>
          </div>
        </div>

        {/* Subtítulo da tabela */}
        <div className="text-center mb-10">
          <h3 className="text-xl font-bold text-white mb-2">
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
