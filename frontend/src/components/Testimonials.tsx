import { motion } from 'motion/react';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    name: "Ricardo Oliveira",
    role: "Ladrilheiro",
    content: "Consegui triplicar meus serviços mensais depois que entrei na MeloCalé. O sistema de orçamentos é muito justo e foca em quem entrega qualidade.",
    avatar: "https://i.pravatar.cc/150?u=ricardo"
  },
  {
    name: "Ana Beatriz",
    role: "Cliente",
    content: "Precisava de um designer de última hora para um projeto e encontrei a profissional perfeita. O processo de pagamento seguro me deixou muito tranquila.",
    avatar: "https://i.pravatar.cc/150?u=ana"
  },
  {
    name: "Carlos Mendes",
    role: "Marido de Aluguel",
    content: "Plataforma séria que realmente valoriza o profissional. Uso todos os dias para gerenciar minha agenda e novos clientes.",
    avatar: "https://i.pravatar.cc/150?u=carlos"
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-[#0A0B0D] overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none"></div>
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-4">
            Comunidade
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">Aprovado pela Comunidade</h2>
          <div className="w-20 h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, scale: { duration: 0.2 }, y: { duration: 0.2 } }}
              className="p-8 rounded-[2rem] bg-[#14161B] border border-white/5 relative group hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all cursor-pointer"
            >
              <Quote className="absolute top-6 right-8 text-white/5 group-hover:text-emerald-500/10 transition-colors" size={48} />
              <div className="relative z-10">
                <p className="text-slate-400 italic mb-8 leading-relaxed">"{t.content}"</p>
                <div className="flex items-center gap-4">
                  <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full border border-white/10 shadow-sm" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{t.name}</h4>
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
