import { useNavigate } from 'react-router-dom';
import { User, Briefcase, ChevronRight } from 'lucide-react';

interface RoleSelectorProps {
  mode: 'login' | 'signup';
  onSelect: (role: 'client' | 'professional') => void;
  onGoogleLogin: () => void;
}

export function RoleSelector({ mode, onSelect, onGoogleLogin }: RoleSelectorProps) {
  const navigate = useNavigate();

  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 mb-8">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Área de Acesso Seguro</span>
      </div>

      <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
        {mode === 'signup' ? 'Escolha como deseja se cadastrar' : 'Entre na sua conta'}
      </h1>
      <p className="text-[#7A9EBF] font-medium mb-12">
        {mode === 'signup' ? 'Selecione a opção que melhor se adequa ao seu perfil' : 'Escolha como deseja acessar seu painel'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Card */}
        <button
          onClick={() => onSelect('client')}
          className="group relative flex flex-col text-left p-8 rounded-[2rem] bg-[#132540] border border-[#1C3050] hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition-all duration-500 h-full"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform mb-8">
            <User size={32} />
          </div>
          <h3 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors mb-4">
            {mode === 'signup' ? 'Sou Cliente' : 'Área do Cliente'}
          </h3>
          <p className="text-[#7A9EBF] text-sm leading-relaxed mb-6">
            {mode === 'signup'
              ? 'Preciso contratar profissionais para serviços em minha casa'
              : 'Gerencie seus pedidos e contrate profissionais'}
          </p>
          {mode === 'signup' && (
            <ul className="space-y-3 mb-8">
              {['Solicite orçamentos grátis', 'Compare profissionais', 'Contrate com segurança'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-bold text-[#B0C4D8]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center gap-2 text-sm font-black text-[#7A9EBF] group-hover:text-blue-400 transition-all">
            <span>{mode === 'signup' ? 'Sou Cliente' : 'Acessar Minha Conta'}</span>
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Professional Card */}
        <button
          onClick={() => onSelect('professional')}
          className="group relative flex flex-col text-left p-8 rounded-[2rem] bg-[#132540] border border-[#1C3050] hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all duration-500 h-full"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform mb-8">
            <Briefcase size={32} />
          </div>
          <h3 className="text-2xl font-black text-white group-hover:text-emerald-400 transition-colors mb-4">
            {mode === 'signup' ? 'Sou Profissional' : 'Área do Profissional'}
          </h3>
          <p className="text-[#7A9EBF] text-sm leading-relaxed mb-6">
            {mode === 'signup'
              ? 'Quero oferecer meus serviços e receber solicitações de clientes'
              : 'Acesse seus leads e envie propostas agora'}
          </p>
          {mode === 'signup' && (
            <ul className="space-y-3 mb-8">
              {['Aumente sua receita mensal', 'Clientes prontos para contratar', 'Expanda seu negócio'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-bold text-[#B0C4D8]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center gap-2 text-sm font-black text-[#7A9EBF] group-hover:text-emerald-400 transition-all">
            <span>{mode === 'signup' ? 'Sou Profissional' : 'Acessar Painel Pro'}</span>
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      <div className="mt-12 pt-8 border-t border-[#1C3050]">
        <p className="text-[#7A9EBF] text-[10px] font-black uppercase tracking-widest mb-6">Ou conecte-se instantaneamente</p>
        <button
          onClick={onGoogleLogin}
          className="w-full h-16 bg-white hover:bg-slate-100 text-black rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-2xl group active:scale-95"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
          </svg>
          {mode === 'signup' ? 'Cadastrar com Google' : 'Entrar com Google'}
        </button>

        <button
          onClick={() => navigate('/login' + (mode === 'login' ? '?mode=signup' : ''))}
          className="mt-8 text-[#7A9EBF] text-sm font-medium hover:text-white transition-colors"
        >
          {mode === 'signup' ? 'Já tem conta? ' : 'Ainda não é cadastrado? '}
          <span className="text-blue-500 font-bold hover:underline">
            {mode === 'signup' ? 'Fazer login' : 'Comece agora'}
          </span>
        </button>
      </div>
    </div>
  );
}
