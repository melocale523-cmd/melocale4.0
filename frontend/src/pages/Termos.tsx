import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Termos() {
  return (
    <div className="min-h-screen bg-[#0E1C32] text-white py-12 px-4">
      <Helmet>
        <title>Termos de Uso — MeloCalé</title>
        <meta name="description" content="Termos de Uso da plataforma MeloCalé." />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-8 text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para o início
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Termos de Uso</h1>
        <p className="text-[#94A3B8] text-sm mb-10">Última atualização: maio de 2026</p>

        <div className="space-y-8 text-[#94A3B8] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma MeloCalé, você declara ter lido, entendido e
              concordado com estes Termos de Uso. Caso não concorde com qualquer disposição, não
              utilize a plataforma. O uso continuado após alterações implica aceitação das novas
              condições.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Descrição do Serviço</h2>
            <p>
              O MeloCalé é uma plataforma digital de intermediação que conecta clientes que
              necessitam de serviços domésticos (elétrica, hidráulica, pintura, entre outros) a
              profissionais autônomos cadastrados. A plataforma não presta serviços diretamente nem
              é empregadora dos profissionais listados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Cadastro e Responsabilidades</h2>
            <p>Para usar o MeloCalé, você deve:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Ter no mínimo 18 anos de idade</li>
              <li>Fornecer informações verdadeiras e atualizadas no cadastro</li>
              <li>Manter a confidencialidade de sua senha e não compartilhá-la</li>
              <li>Notificar imediatamente qualquer uso não autorizado de sua conta</li>
              <li>Ser responsável por todas as atividades realizadas sob sua conta</li>
            </ul>
            <p className="mt-2">
              Profissionais devem ser autônomos legalmente habilitados e responsáveis pelas
              informações do perfil, qualidade dos serviços e cumprimento da legislação vigente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Regras de Uso da Plataforma</h2>
            <p>É expressamente proibido:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Criar perfis falsos ou usar identidade de terceiros</li>
              <li>Publicar informações falsas, enganosas ou difamatórias</li>
              <li>Usar a plataforma para atividades ilegais ou fraudulentas</li>
              <li>Enviar spam, conteúdo abusivo ou ofensivo</li>
              <li>Tentar comprometer a segurança ou integridade da plataforma</li>
              <li>Realizar negociações fora da plataforma para evitar pagamentos legítimos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Pagamentos e Moedas</h2>
            <p>
              Profissionais adquirem moedas virtuais (MeloCoins) para acessar leads de clientes.
              O custo de cada lead em moedas varia conforme a categoria do serviço solicitado —
              os valores atualizados são exibidos antes da confirmação. O profissional <strong className="text-white">só é
              debitado no momento em que aceita o lead</strong>; visualizar as informações básicas do
              pedido não consome moedas. Valores e pacotes estão descritos na página de planos e
              sujeitos a alteração com aviso prévio de 30 dias. Todos os pagamentos são processados
              com segurança via Stripe.
            </p>
            <p className="mt-2">
              Clientes não pagam pela plataforma em si — os custos de contratação do serviço são
              acordados diretamente com o profissional.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Cancelamentos e Reembolsos</h2>
            <p>
              Moedas adquiridas não são reembolsáveis, exceto em casos de cobrança indevida
              comprovada. Assinaturas de planos podem ser canceladas a qualquer momento, com acesso
              mantido até o fim do período pago. Não há reembolso proporcional por cancelamento
              antecipado de assinaturas.
            </p>
            <p className="mt-2">
              Para solicitar análise de reembolso por cobrança indevida ou abrir uma disputa de
              cobrança, entre em contato em até 7 dias pelo canal exclusivo de financeiro:{' '}
              <a href="mailto:financeiro@melocale.com.br" className="text-emerald-400 hover:underline">financeiro@melocale.com.br</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitação de Responsabilidade</h2>
            <p>
              O MeloCalé atua como intermediário e não se responsabiliza por:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Qualidade, prazo ou resultado dos serviços prestados pelos profissionais</li>
              <li>Danos causados por profissionais ou clientes durante a execução do serviço</li>
              <li>Disputas contratuais entre clientes e profissionais</li>
              <li>Indisponibilidade temporária da plataforma por manutenção ou falhas técnicas</li>
            </ul>
            <p className="mt-2">
              A responsabilidade máxima do MeloCalé fica limitada ao valor pago pelo usuário nos
              últimos 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma — marca, logotipo, design, código e textos — é de
              propriedade exclusiva do MeloCalé. É proibida a reprodução, distribuição ou uso
              comercial sem autorização prévia e por escrito.
            </p>
            <p className="mt-2">
              Ao publicar conteúdo na plataforma (fotos, descrições, avaliações), o usuário concede
              ao MeloCalé licença não exclusiva para exibição e promoção do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Encerramento de Conta</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento nas configurações da plataforma.
              O MeloCalé pode suspender ou encerrar contas que violem estes termos, com ou sem
              aviso prévio dependendo da gravidade da violação. Saldos de moedas não utilizados
              não são reembolsados em caso de encerramento por violação <strong className="text-white">nem em caso de
              encerramento voluntário</strong> — as moedas têm validade vinculada à conta ativa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contato</h2>
            <p>
              Dúvidas sobre estes Termos de Uso:{' '}
              <a href="mailto:contato@melocale.com.br" className="text-emerald-400 hover:underline">
                contato@melocale.com.br
              </a>
            </p>
            <p className="mt-2">
              Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de
              Jacobina/BA para dirimir quaisquer controvérsias.
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
