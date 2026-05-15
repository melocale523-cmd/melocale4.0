export default function Privacidade() {
  return (
    <div className="min-h-screen bg-[#0E1C32] text-white p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-black mb-8">Política de Privacidade</h1>
      <div className="space-y-6 text-[#94A3B8] leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">1. Dados Coletados</h2>
          <p>Coletamos nome, e-mail, telefone e localização para funcionamento da plataforma. Não vendemos seus dados a terceiros.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">2. Uso dos Dados</h2>
          <p>Seus dados são usados para conectar clientes e profissionais, processar pagamentos e enviar notificações relevantes.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">3. Armazenamento</h2>
          <p>Dados são armazenados com segurança via Supabase com criptografia. Senhas nunca são armazenadas em texto simples.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">4. Seus Direitos</h2>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail contato@melocale.com.br.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">5. Cookies</h2>
          <p>Usamos cookies para manter sua sessão ativa e melhorar a experiência. Você pode desativar cookies nas configurações do navegador.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white mb-3">6. Contato</h2>
          <p>Dúvidas sobre privacidade: contato@melocale.com.br</p>
        </section>
      </div>
      <a href="/" className="inline-block mt-10 text-emerald-400 hover:text-emerald-300 font-bold">← Voltar</a>
    </div>
  );
}
