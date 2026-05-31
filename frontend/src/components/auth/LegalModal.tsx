import { X } from 'lucide-react';

interface LegalModalProps {
  type: 'termos' | 'privacidade';
  onClose: () => void;
}

export function LegalModal({ type, onClose }: LegalModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-9">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0E1C32] border border-[#1C3050] rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-11 py-9 border-b border-[#1C3050] shrink-0">
          <h3 className="text-white font-black text-lg">
            {type === 'termos' ? 'Termos de Uso' : 'Políticas de Privacidade'}
          </h3>
          <button type="button" onClick={onClose} className="p-7 rounded-xl hover:bg-white/5 text-[#7A9EBF] hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-11 text-[#94A3B8] text-sm leading-relaxed space-y-9">
          {type === 'termos' ? (
            <>
              <section><h4 className="text-white font-bold mb-7">1. Aceitação dos Termos</h4><p>Ao acessar e usar o MeloCalé, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.</p></section>
              <section><h4 className="text-white font-bold mb-7">2. Descrição do Serviço</h4><p>O MeloCalé é uma plataforma que conecta clientes que precisam de serviços domésticos a profissionais qualificados.</p></section>
              <section><h4 className="text-white font-bold mb-7">3. Responsabilidades do Usuário</h4><p>Você é responsável por manter a confidencialidade de sua conta e senha, e por todas as atividades realizadas sob sua conta.</p></section>
              <section><h4 className="text-white font-bold mb-7">4. Pagamentos</h4><p>Profissionais adquirem moedas para acessar leads. Valores e condições estão descritos na página de planos. Pagamentos são processados via Stripe.</p></section>
              <section><h4 className="text-white font-bold mb-7">5. Alterações</h4><p>Reservamos o direito de modificar estes termos a qualquer momento. Alterações serão comunicadas via e-mail ou notificação na plataforma.</p></section>
              <section><h4 className="text-white font-bold mb-7">6. Contato</h4><p>Dúvidas sobre os termos: contato@melocale.com.br</p></section>
            </>
          ) : (
            <>
              <section><h4 className="text-white font-bold mb-7">1. Dados Coletados</h4><p>Coletamos nome, e-mail, telefone, localização e dados de uso para operar a plataforma e conectar clientes a profissionais.</p></section>
              <section><h4 className="text-white font-bold mb-7">2. Uso dos Dados</h4><p>Seus dados são usados exclusivamente para prestação do serviço, comunicações relacionadas à plataforma e melhorias do produto.</p></section>
              <section><h4 className="text-white font-bold mb-7">3. Compartilhamento</h4><p>Não vendemos seus dados. Compartilhamos apenas com parceiros essenciais para operação (processador de pagamento, provedor de e-mail).</p></section>
              <section><h4 className="text-white font-bold mb-7">4. Segurança</h4><p>Utilizamos criptografia e boas práticas de segurança para proteger seus dados. Autenticação gerenciada pelo Supabase Auth.</p></section>
              <section><h4 className="text-white font-bold mb-7">5. Seus Direitos</h4><p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail: contato@melocale.com.br</p></section>
            </>
          )}
        </div>

        <div className="px-11 py-9 border-t border-[#1C3050] shrink-0">
          <button type="button" onClick={onClose} className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-2xl transition-all">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
