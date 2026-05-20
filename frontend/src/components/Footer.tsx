import { Home, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer id="main-footer" className="bg-[#0E1C32] text-[#4A6580] py-20 px-6 border-t border-[#1C3050]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-white">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black">
              <Home size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight uppercase">MeloCalé</span>
          </div>
          <p className="text-sm leading-relaxed text-[#94A3B8]">
            A plataforma líder para encontrar profissionais de confiança. Tecnologia a serviço de conexões reais e seguras.
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Legal</h4>
          <ul className="flex flex-col gap-4 text-sm font-medium">
            <li>
              <Link to="/privacidade" className="hover:text-emerald-400 transition-colors">
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link to="/termos" className="hover:text-emerald-400 transition-colors">
                Termos de Uso
              </Link>
            </li>
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
      <div className="max-w-7xl mx-auto border-t border-[#1C3050] mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A6580]">
        <span>© {new Date().getFullYear()} MeloCalé. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}
