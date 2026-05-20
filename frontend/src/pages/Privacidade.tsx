import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-[#0E1C32] text-white py-12 px-4">
      <Helmet>
        <title>Política de Privacidade — MeloCalé</title>
        <meta name="description" content="Política de Privacidade da plataforma MeloCalé." />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-8 text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para o início
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
        <p className="text-[#94A3B8] text-sm mb-10">Última atualização: maio de 2026</p>

        <div className="space-y-8 text-[#94A3B8] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Quem somos</h2>
            <p>
              O MeloCalé é uma plataforma digital que conecta clientes a profissionais de
              serviços domésticos (elétrica, hidráulica, pintura, entre outros), operada por
              seus desenvolvedores com sede no Brasil.
            </p>
            <p className="mt-2">
              Contato para assuntos de privacidade:{' '}
              <a href="mailto:melocaleoficial@gmail.com" className="text-emerald-400 hover:underline">
                melocaleoficial@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Dados que coletamos</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Nome completo e endereço de e-mail (cadastro)</li>
              <li>Número de telefone (opcional, para contato entre cliente e profissional)</li>
              <li>Cidade e estado (para exibição de profissionais próximos)</li>
              <li>Dados de pagamento processados pelo Stripe (não armazenamos dados de cartão)</li>
              <li>Fotos de perfil enviadas voluntariamente</li>
              <li>Mensagens trocadas na plataforma</li>
              <li>Dados de uso e erros (via Sentry, para melhoria do serviço)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Como usamos seus dados</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Criar e gerenciar sua conta</li>
              <li>Conectar clientes a profissionais de serviços</li>
              <li>Processar pagamentos de forma segura via Stripe</li>
              <li>Enviar notificações sobre agendamentos e mensagens</li>
              <li>Melhorar a plataforma com base em dados de uso anônimos</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Base legal (LGPD)</h2>
            <p>
              Tratamos seus dados com base no consentimento (Art. 7º, I), na execução de
              contrato (Art. 7º, V) e no legítimo interesse (Art. 7º, IX) conforme a Lei
              Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Compartilhamento de dados</h2>
            <p>Seus dados são compartilhados apenas com:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-white">Supabase</strong> — banco de dados e autenticação</li>
              <li><strong className="text-white">Stripe</strong> — processamento de pagamentos</li>
              <li><strong className="text-white">Sentry</strong> — monitoramento de erros (dados anonimizados)</li>
              <li><strong className="text-white">Profissionais cadastrados</strong> — apenas quando você solicita um serviço</li>
            </ul>
            <p className="mt-2">Não vendemos seus dados a terceiros.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Seus direitos</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Acessar os dados que temos sobre você</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar a exclusão dos seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar portabilidade dos dados</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato:{' '}
              <a href="mailto:melocaleoficial@gmail.com" className="text-emerald-400 hover:underline">
                melocaleoficial@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Retenção de dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento,
              os dados são excluídos em até 90 dias, salvo obrigação legal de retenção.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Cookies e rastreamento</h2>
            <p>
              Utilizamos apenas cookies essenciais para autenticação e funcionamento da
              plataforma. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos usuários sobre
              mudanças significativas por e-mail ou notificação na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contato</h2>
            <p>
              Dúvidas sobre privacidade:{' '}
              <a href="mailto:melocaleoficial@gmail.com" className="text-emerald-400 hover:underline">
                melocaleoficial@gmail.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-[#1C3050] text-center text-[#4A6580] text-xs">
          © {new Date().getFullYear()} MeloCalé. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
