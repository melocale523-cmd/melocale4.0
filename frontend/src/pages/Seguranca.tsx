import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, CreditCard, Bell, KeyRound } from 'lucide-react';

export default function Seguranca() {
  return (
    <div className="min-h-screen bg-[#0E1C32] text-white py-12 px-4">
      <Helmet>
        <title>Segurança — MeloCalé</title>
        <meta name="description" content="Como o MeloCalé protege seus dados e transações." />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-8 text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para o início
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Segurança</h1>
        <p className="text-[#94A3B8] text-sm mb-10">Como protegemos sua conta e seus dados</p>

        <div className="space-y-8 text-[#94A3B8] leading-relaxed">

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400">
                <Lock size={18} />
              </div>
              <h2 className="text-lg font-semibold text-white">Banco de Dados e Autenticação</h2>
            </div>
            <p>
              O MeloCalé utiliza o <strong className="text-white">Supabase</strong> como
              infraestrutura de banco de dados e autenticação. Todos os dados são armazenados com
              criptografia em repouso (AES-256) e em trânsito (TLS 1.3).
            </p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li><strong className="text-white">Row-Level Security (RLS)</strong>: cada usuário acessa apenas seus próprios dados — nenhuma consulta pode vazar informações de outros perfis</li>
              <li><strong className="text-white">Senhas</strong>: nunca armazenadas em texto simples — hashing com bcrypt via Supabase Auth</li>
              <li><strong className="text-white">Tokens JWT</strong>: sessões autenticadas com expiração e rotação automática</li>
              <li><strong className="text-white">Infraestrutura AWS</strong>: servidores em regiões com certificação SOC 2 Type II</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
                <CreditCard size={18} />
              </div>
              <h2 className="text-lg font-semibold text-white">Pagamentos Seguros via Stripe</h2>
            </div>
            <p>
              Todos os pagamentos na plataforma são processados pelo{' '}
              <strong className="text-white">Stripe</strong>, líder mundial em processamento de
              pagamentos com certificação <strong className="text-white">PCI DSS Nível 1</strong> —
              o mais alto padrão de segurança do setor.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>O MeloCalé <strong className="text-white">nunca armazena</strong> dados de cartão de crédito</li>
              <li>Todos os dados financeiros trafegam diretamente entre você e o Stripe</li>
              <li>Webhooks assinados com secret exclusivo para validar autenticidade</li>
              <li>Proteção antifraude com Stripe Radar ativada</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-400">
                <Bell size={18} />
              </div>
              <h2 className="text-lg font-semibold text-white">Notificações Push com VAPID</h2>
            </div>
            <p>
              As notificações push são enviadas usando o protocolo{' '}
              <strong className="text-white">VAPID (Voluntary Application Server Identification)</strong>,
              que garante que apenas nossos servidores autorizados podem enviar notificações para
              o seu dispositivo.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>Par de chaves criptográficas exclusivo por servidor</li>
              <li>Notificações não podem ser interceptadas ou falsificadas por terceiros</li>
              <li>Permissão de notificações é totalmente opcional e pode ser revogada nas configurações do navegador</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400">
                <ShieldCheck size={18} />
              </div>
              <h2 className="text-lg font-semibold text-white">Monitoramento e Resposta a Incidentes</h2>
            </div>
            <p>
              Utilizamos o <strong className="text-white">Sentry</strong> para monitoramento de
              erros em tempo real. Dados de diagnóstico são anonimizados e usados exclusivamente
              para melhorar a estabilidade da plataforma.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>Alertas automáticos para anomalias e tentativas de acesso suspeito</li>
              <li>Rate limiting em endpoints sensíveis para prevenir ataques de força bruta</li>
              <li>Logs de auditoria para operações críticas</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400">
                <KeyRound size={18} />
              </div>
              <h2 className="text-lg font-semibold text-white">Boas Práticas para Você</h2>
            </div>
            <p>Para manter sua conta segura, recomendamos:</p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>Use uma <strong className="text-white">senha forte e única</strong> — mínimo de 8 caracteres com letras, números e símbolos</li>
              <li>Nunca compartilhe sua senha com ninguém, nem com a equipe MeloCalé</li>
              <li><strong className="text-white">Faça logout</strong> ao usar dispositivos compartilhados ou públicos</li>
              <li>Verifique se o endereço na barra do navegador é <strong className="text-white">melocale.com.br</strong> antes de inserir seus dados</li>
              <li>Desconfie de e-mails ou mensagens pedindo sua senha — o MeloCalé nunca solicitará isso</li>
              <li>Mantenha seu e-mail de cadastro seguro, pois é usado para recuperação de conta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Reportar uma Vulnerabilidade</h2>
            <p>
              Se você encontrou uma vulnerabilidade de segurança na plataforma, por favor entre em
              contato de forma responsável antes de divulgar publicamente:
            </p>
            <p className="mt-2">
              <a href="mailto:seguranca@melocale.com.br" className="text-emerald-400 hover:underline font-medium">
                seguranca@melocale.com.br
              </a>
            </p>
            <p className="mt-2">
              Descreva o problema com o máximo de detalhes possível. Investigamos todos os relatos
              com prioridade e agradecemos a colaboração da comunidade de segurança.
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
