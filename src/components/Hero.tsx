import { Search, MapPin, Building2, ChevronDown, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export default function Hero() {
  return (
    <section id="hero" className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=2000"
          alt="Modern House"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/40 backdrop-brightness-75" />
      </div>

      <div className="container mx-auto px-6 relative z-10 text-white">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6 w-fit"
          >
             <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Próximo Lançamento em 14:02:11
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight"
          >
            O profissional <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 underline decoration-white/10 underline-offset-8">
              Certo, na Hora.
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 mb-10 max-w-xl font-light leading-relaxed"
          >
            Encontre os melhores especialistas para qualquer serviço. Solicite orçamentos, compare perfis e contrate com segurança.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-[#14161B]/80 backdrop-blur-xl p-2 md:p-3 rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center gap-2 max-w-4xl"
          >
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer group">
                <Search className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">O que precisa?</span>
                  <span className="text-white font-medium whitespace-nowrap">Pintor, Designer...</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer group">
                <MapPin className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cidade</span>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-medium">São Paulo, SP</span>
                    <ChevronDown size={14} className="text-slate-500" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer group">
                <Zap className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Urgência</span>
                  <span className="text-white font-mono">Imediata</span>
                </div>
              </div>
            </div>
            <button className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-4 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
              <Search size={20} />
              <span>Orçar Agora</span>
            </button>
          </motion.div>

          {/* Quick Stats */}
          <div className="mt-12 grid grid-cols-3 gap-8 pt-8 border-t border-white/5 max-w-xl">
            <div>
              <div className="text-2xl font-bold">42.8k</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Serviços Realizados</div>
            </div>
            <div>
              <div className="text-2xl font-bold">156</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Categorias</div>
            </div>
            <div>
              <div className="text-2xl font-bold">12.5k</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Profissionais</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-white/50">
        <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Role para Mais</span>
        <motion.div
           animate={{ y: [0, 8, 0] }}
           transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
           className="w-5 h-8 border-2 border-white/20 rounded-full flex justify-center pt-1"
        >
          <div className="w-1 h-2 bg-white/40 rounded-full" />
        </motion.div>
      </div>
    </section>
  );
}
