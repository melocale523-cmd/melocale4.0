export default function Termos() {
  return (
    <div className="min-h-screen bg-[#0E1C32] text-white p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-black mb-8">Termos de Uso</h1>
      <div className="space-y-6 text-[#94A3B8] leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">1. Aceitação dos Termos</h2>
          <p>Ao acessar e usar o MeloCalé, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">2. Descrição do Serviço</h2>
          <p>O MeloCalé é uma plataforma que conecta clientes que precisam de serviços domésticos a profissionais qualificados.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">3. Responsabilidades do Usuário</h2>
          <p>Você é responsável por manter a confidencialidade de sua conta e senha, e por todas as atividades realizadas sob sua conta.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">4. Pagamentos</h2>
          <p>Profissionais adquirem moedas para acessar leads. Valores e condições estão descritos na página de planos. Pagamentos são processados via Stripe.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">5. Alterações</h2>
          <p>Reservamos o direito de modificar estes termos a qualquer momento. Alterações serão comunicadas via e-mail ou notificação na plataforma.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">6. Contato</h2>
          <p>Dúvidas sobre os termos: contato@melocale.com.br</p>
        </section>
      </div>
      <a href="/" className="inline-block mt-10 text-emerald-400 hover:text-emerald-300 font-bold">← Voltar</a>
    </div>
  );
}
