import { useState } from 'react';
import { Home, Mail, Instagram, Facebook, Twitter, Youtube, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialComingSoonModal from './SocialComingSoonModal';

const socialNetworks = [
  { name: 'Instagram', icon: Instagram },
  { name: 'Facebook', icon: Facebook },
  { name: 'Twitter / X', icon: Twitter },
  { name: 'YouTube', icon: Youtube },
  { name: 'LinkedIn', icon: Linkedin },
];

export default function Footer() {
  const [socialModal, setSocialModal] = useState<{ open: boolean; name: string }>({ open: false, name: '' });

  return (
    <>
      <SocialComingSoonModal
        open={socialModal.open}
        onClose={() => setSocialModal({ open: false, name: '' })}
        networkName={socialModal.name}
      />

      <footer id="main-footer" className="bg-[#0E1C32] text-[#4A6580] py-20 px-6 border-t border-[#1C3050]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Coluna 1 — Marca */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black">
                <Home size={24} />
              </div>
              <span className="text-2xl font-bold tracking-tight uppercase">MeloCalé</span>
            </div>
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              A plataforma para encontrar profissionais de confiança. Tecnologia a serviço de conexões reais e seguras.
            </p>
            <div className="flex gap-3">
              {socialNetworks.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  onClick={() => setSocialModal({ open: true, name })}
                  aria-label={name}
                  title={name}
                  className="p-2 bg-white/5 border border-[#1C3050] rounded-full hover:text-emerald-500 hover:border-emerald-500/40 transition-all cursor-pointer"
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Coluna 2 — Plataforma */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Plataforma</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium">
              <li>
                <Link to="/cliente/busca" className="hover:text-emerald-400 transition-colors">
                  Buscar Profissionais
                </Link>
              </li>
              <li>
                <Link to="/login?mode=signup&role=professional" className="hover:text-emerald-400 transition-colors">
                  Ser um Profissional
                </Link>
              </li>
              <li>
                <a href="/#como-funciona" className="hover:text-emerald-400 transition-colors">
                  Como Funciona
                </a>
              </li>
              <li>
                <a href="/#planos" className="hover:text-emerald-400 transition-colors">
                  Preços
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 3 — Legal & Segurança */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Legal & Segurança</h4>
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
              <li>
                <Link to="/seguranca" className="hover:text-emerald-400 transition-colors">
                  Segurança
                </Link>
              </li>
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 text-xs text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 rounded-full">
              🔒 LGPD Compliant
            </div>
          </div>

          {/* Coluna 4 — Suporte */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Suporte</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium">
              <li className="flex items-start gap-3">
                <Mail size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <a href="mailto:contato@melocale.com.br" className="hover:text-emerald-400 transition-colors">
                  contato@melocale.com.br
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <a href="mailto:privacidade@melocale.com.br" className="hover:text-emerald-400 transition-colors">
                  privacidade@melocale.com.br
                </a>
              </li>
              <li className="text-xs text-[#4A6580] mt-1">
                Atendimento 24h / 7 dias por semana
              </li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto border-t border-[#1C3050] mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A6580]">
          <span>© {new Date().getFullYear()} MeloCalé. Todos os direitos reservados.</span>
          <span>Feito com ❤️ no Brasil</span>
        </div>
      </footer>
    </>
  );
}
