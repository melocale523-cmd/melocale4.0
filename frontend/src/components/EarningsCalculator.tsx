import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'

function SliderTrack({ value, min, max, onChange, color = '#10b981' }: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  color?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="earnings-slider w-full cursor-pointer"
      style={{
        background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #1e3a5f ${pct}%, #1e3a5f 100%)`,
      }}
    />
  )
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}

export default function EarningsCalculator() {
  const [services, setServices] = useState(5)
  const [ticket, setTicket] = useState(300)

  const current   = services * ticket
  const withMelo  = Math.round(current * 1.3)
  const extra     = withMelo - current
  const profitPro = extra - 67

  return (
    <section className="pt-8 pb-20 md:pt-20 bg-[#0B1729] border-t border-slate-800/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">
            <TrendingUp size={14} />
            Calculadora de Ganhos
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Quanto você pode ganhar com o <span className="text-emerald-400">MeloCalé</span>?
          </h2>
        </div>

        <div className="bg-[#1C3454] border border-slate-700/50 rounded-3xl p-6 md:p-8 space-y-8">

          {/* Slider A */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-slate-300">Quantos serviços você faz por mês?</label>
              <span className="text-emerald-400 font-extrabold text-lg min-w-[2.5rem] text-right">{services}</span>
            </div>
            <SliderTrack value={services} min={1} max={30} onChange={setServices} color="#10b981" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>1</span><span>30</span>
            </div>
          </div>

          {/* Slider B */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-slate-300">Ticket médio por serviço (R$)</label>
              <span className="text-blue-400 font-extrabold text-lg min-w-[4rem] text-right">R${fmt(ticket)}</span>
            </div>
            <SliderTrack value={ticket} min={50} max={2000} onChange={setTicket} color="#3b82f6" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>R$50</span><span>R$2.000</span>
            </div>
          </div>

          {/* Results */}
          <div className="bg-[#0d1f35] rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-xl bg-slate-800/40">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Renda atual estimada</p>
                <p className="text-white font-extrabold text-xl">R${fmt(current)}/mês</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-1">Com MeloCalé (+30%)</p>
                <p className="text-white font-extrabold text-xl">R${fmt(withMelo)}/mês</p>
              </div>
            </div>

            {/* Destaque principal */}
            <div className="text-center py-4 border-t border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">Ganho extra potencial</p>
              <p key={extra} className="number-pop text-4xl md:text-5xl font-extrabold text-emerald-400">
                +R${fmt(extra)}/mês
              </p>
            </div>

            {/* ROI do plano PRO */}
            <div className="text-center text-sm text-slate-400 bg-emerald-500/5 border border-emerald-500/15 rounded-xl py-3 px-4">
              Com plano PRO (R$67/mês) você teria lucro de{' '}
              <span key={profitPro} className={`number-pop font-extrabold ${profitPro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R${fmt(Math.abs(profitPro))}{profitPro >= 0 ? '' : ' (negativo)'}
              </span>
              /mês
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/login?mode=signup&role=professional"
            className="block w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base py-4 rounded-2xl text-center transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
          >
            Quero ganhar R${fmt(extra)}/mês →
          </Link>
          <p className="text-xs text-slate-500 text-center -mt-4">Grátis para começar • Resultado baseado em 30% mais clientes via plataforma</p>
        </div>
      </div>
    </section>
  )
}
