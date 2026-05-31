import { Link } from 'react-router-dom';

function isFlashOfferActive(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  const isWeekend = day === 0 || day === 6;
  const isPrimeTime = hour >= 18 && hour < 22;
  return isWeekend || isPrimeTime;
}

export default function FlashOffer() {
  if (!isFlashOfferActive()) return null;

  return (
    <div className="w-full flex items-center justify-center gap-7 md:gap-4 px-9 py-2.5 text-xs md:text-sm font-bold flex-wrap"
      style={{ background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #92400e 100%)' }}
    >
      <span>⚡ Oferta Relâmpago</span>
      <span className="hidden sm:inline text-amber-200">—</span>
      <span className="text-amber-100">Cadastre agora e ganhe <strong className="text-white">100 moedas extras!</strong></span>
      <Link
        to="/login?mode=signup"
        className="ml-1 bg-white/20 hover:bg-white/30 text-white rounded-lg px-8 py-6 text-xs font-black transition-colors whitespace-nowrap"
      >
        Aproveitar →
      </Link>
    </div>
  );
}
