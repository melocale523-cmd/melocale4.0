import { Home, Instagram, Facebook, Twitter, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="main-footer" className="bg-[#0A0B0D] text-slate-500 py-20 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-white">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black">
              <Home size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight uppercase">MeloCalé</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            A plataforma líder para encontrar profissionais de confiança. Tecnologia a serviço de conexões reais e seguras.
          </p>
          <div className="flex gap-4">
            <a href="#" className="p-2 bg-white/5 border border-white/5 rounded-lg hover:text-emerald-500 hover:border-emerald-500/30 transition-all"><Instagram size={18} /></a>
            <a href="#" className="p-2 bg-white/5 border border-white/5 rounded-lg hover:text-emerald-500 hover:border-emerald-500/30 transition-all"><Facebook size={18} /></a>
            <a href="#" className="p-2 bg-white/5 border border-white/5 rounded-lg hover:text-emerald-500 hover:border-emerald-500/30 transition-all"><Twitter size={18} /></a>
            <a href="#" className="p-2 bg-white/5 border border-white/5 rounded-lg hover:text-emerald-500 hover:border-emerald-500/30 transition-all"><Linkedin size={18} /></a>
          </div>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Ecosistema</h4>
          <ul className="flex flex-col gap-4 text-sm font-medium">
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Portfólio</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Novos Lançamentos</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Governança</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Anunciar Imóvel</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Recursos</h4>
          <ul className="flex flex-col gap-4 text-sm font-medium">
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Whitepaper</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Privacidade</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Termos Legais</a></li>
            <li><a href="#" className="hover:text-emerald-400 transition-colors">Segurança</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Suporte</h4>
          <ul className="flex flex-col gap-4 text-sm font-medium">
            <li className="flex items-center gap-3">
              <Mail size={16} className="text-emerald-500" />
              <span>contato@melocale.com.br</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone size={16} className="text-emerald-500" />
              <span>+55 11 99999-9999</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto border-t border-white/5 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
        <span>© 2026 MeloCalé. Protocolo Ativo.</span>
        <div className="flex gap-8">
           <span>$MELO: $0.428</span>
        </div>
      </div>
    </footer>
  );
}
