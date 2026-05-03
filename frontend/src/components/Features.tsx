import { ShieldCheck, Zap, HeartHandshake, MousePointer2, Search } from 'lucide-react';
import { motion } from 'motion/react';

const features = [
  {
    icon: ShieldCheck,
    title: "Segurança 100%",
    description: "Profissionais rigorosamente verificados com histórico de antecedentes e avaliações reais.",
  },
  {
    icon: Zap,
    title: "Orçamentos Instantâneos",
    description: "Receba até 4 propostas em menos de 60 minutos para resolver seu problema rápido.",
  },
  {
    icon: HeartHandshake,
    title: "Garantia MeloCalé",
    description: "Seu pagamento só é liberado quando você aprova o serviço realizado. Proteção total.",
  },
  {
    icon: Search,
    title: "Eco de Confiança",
    description: "Filtre por preço, proximidade e reputação para encontrar o ninja ideal.",
  }
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-[#0A0B0D]">
      <div className="container mx-auto px-6">
        <div className="text-left md:text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-4">
            Nosso Ecossistema
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Por que somos diferentes?</h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Redefinimos a experiência imobiliária com mecanismos de transparência e segurança de nível institucional.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              viewport={{ once: true }}
              transition={{ 
                delay: idx * 0.1,
                scale: { duration: 0.2 },
                y: { duration: 0.2 }
              }}
              className="p-8 rounded-3xl border border-white/5 bg-[#14161B] hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all group overflow-hidden relative cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <feature.icon size={80} />
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 group-hover:text-emerald-400 transition-all">
                <feature.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
