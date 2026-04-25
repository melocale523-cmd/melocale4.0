import { useState } from 'react';
import { Heart, Star, MapPin, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Professional } from '@/src/types';
import { cn } from '../lib/utils';

interface ListingCardProps {
  professional: Professional;
  index: number;
}

export default function ListingCard({ professional, index }: ListingCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <motion.div
        id={`prof-${professional.id}`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -4 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ 
          duration: 0.6, 
          delay: index * 0.1,
          ease: [0.21, 0.47, 0.32, 0.98],
          scale: { duration: 0.2 },
          y: { duration: 0.2 }
        }}
        onClick={() => setIsExpanded(true)}
        className="group bg-[#14161B] rounded-3xl overflow-hidden border border-white/5 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300 relative flex flex-col cursor-pointer"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={professional.imageUrl}
          alt={professional.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100"
        />
        <div className="absolute top-4 left-4 flex flex-col gap-2">
           {professional.featured && (
             <div className="bg-blue-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold border border-blue-400 shadow-lg shadow-blue-500/20 flex items-center gap-1.5 animate-pulse">
               <Star size={10} fill="currentColor" />
               DESTAQUE
             </div>
           )}
           <div className="flex gap-2">
            <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 size={10} />
              VERIFICADO
            </div>
            <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full border border-white/10">
              {professional.category}
            </span>
           </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
          className={cn(
            "absolute top-4 right-4 p-2 backdrop-blur-md rounded-full transition-all duration-300 shadow-sm border",
            isFavorite 
              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" 
              : "bg-black/40 text-white border-white/10 hover:bg-emerald-500 hover:text-black"
          )}
        >
          <motion.div
            animate={isFavorite ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
          </motion.div>
        </button>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="relative group/rating flex items-center gap-1 text-emerald-400 cursor-help">
            <Star size={14} fill="currentColor" />
            <span className="text-sm font-bold font-mono">{professional.rating}</span>
            <span className="text-xs text-slate-500 font-medium">({professional.reviewsCount} avaliações)</span>
            
            <div className="absolute left-0 -top-10 bg-[#14161B] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 opacity-0 group-hover/rating:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
              Avaliação baseada em {professional.reviewsCount} reviews
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <MapPin size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{professional.location.split(',')[0]}</span>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
          {professional.name}
        </h3>
        
        <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed flex-1">
          {professional.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {professional.specialties.map(s => (
            <span key={s} className="text-[9px] uppercase font-bold px-2 py-0.5 bg-white/5 text-slate-400 rounded border border-white/5 whitespace-normal leading-tight text-center max-w-full">
              {s}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">A partir de</span>
              <span className="text-xl font-bold text-white font-mono">
                R$ {professional.priceStarting}
              </span>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Link 
                to={`/profissional/${professional.id}`} 
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest border border-white/10 flex items-center justify-center text-center"
              >
                Ver Detalhes
              </Link>
              <motion.button 
                whileHover={{ y: -5, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/10 text-xs uppercase tracking-widest flex items-center justify-center text-center"
              >
                 Contratar
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-[#14161B] border border-white/10 shadow-2xl rounded-3xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                className="absolute top-4 right-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-red-500 hover:text-white transition-all shadow-sm border border-white/10"
              >
                <X size={20} />
              </button>
              
              <div className="relative h-64 md:h-72 shrink-0">
                <img src={professional.imageUrl} alt={professional.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#14161B] via-[#14161B]/40 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex flex-col items-start gap-2">
                   <div className="flex gap-2 mb-1">
                     <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border border-emerald-500/20 flex items-center gap-1.5">
                        <CheckCircle2 size={12} />
                        VERIFICADO
                     </span>
                     <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full border border-white/10">
                        {professional.category}
                     </span>
                   </div>
                   <h2 className="text-3xl md:text-4xl font-bold text-white">{professional.name}</h2>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avaliação</span>
                    <div className="flex items-center gap-1 text-emerald-400">
                      <Star size={16} fill="currentColor" />
                      <span className="font-bold font-mono">{professional.rating}</span>
                      <span className="text-sm text-slate-400 ml-1">({professional.reviewsCount} reviews)</span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Localização</span>
                    <div className="flex items-center gap-1 text-slate-300">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="text-sm font-bold uppercase tracking-widest">{professional.location}</span>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sobre o Profissional</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-8">
                  {professional.description}
                </p>

                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Especialidades</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {professional.specialties.map(s => (
                    <span key={s} className="text-xs uppercase font-bold px-3 py-1.5 bg-white/5 text-slate-300 rounded-lg border border-white/10">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-white/10 bg-[#0A0B0D] flex items-center justify-between shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">A partir de</span>
                  <span className="text-2xl font-bold text-emerald-400 font-mono">
                    R$ {professional.priceStarting}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
                    className={cn(
                      "p-4 rounded-xl shadow-lg border transition-all active:scale-95 duration-300",
                      isFavorite 
                        ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" 
                        : "bg-white/5 hover:bg-white/10 text-white border-white/10"
                    )}
                  >
                    <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                  <button className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 active:scale-95 text-black font-bold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/20 text-sm uppercase tracking-widest hover:-translate-y-1">
                     Contratar Agora
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
