import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import ListingCard from './ListingCard';
import { PROFESSIONALS } from '@/src/constants';

export default function FeaturedProperties() {
  const featured = PROFESSIONALS.filter(p => p.featured);

  return (
    <section id="featured" className="py-24 bg-[#0E1C32] border-t border-[#1C3050]">
      <div className="container mx-auto px-11">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-11">
          <div className="max-w-2xl">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-bold text-white mb-9"
            >
              Nossos <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Top Ninjas.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-[#94A3B8] text-lg"
            >
              Profissionais verificados com as melhores avaliações do ecossistema.
            </motion.p>
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-7 px-11 py-8 bg-white/5 border border-[#243F6A] rounded-full text-white font-bold hover:bg-white/10 transition-colors shadow-sm text-sm"
          >
            Ver Todos Profissionais
            <ArrowRight size={18} />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featured.map((professional, idx) => (
             <ListingCard key={professional.id} professional={professional} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
