# Integração Seguro do Stripe (SaaS Melocale)

Este documento detalha o fluxo implementado para garantir **tolerância zero** a falhas financeiras relacionadas ao envio de saldo via Stripe.

## 1. Regras de Ouro
- O frontend **nunca** diz ao backend quanto saldo o usuário tem. O frontend apenas pede para gerar um _Checkout_.
- O backend **nunca** adiciona um saldo sem antes passar e validar pelo Stripe Webhook.
- A atualização do ledger não atualiza direto a tabela `professional_coins` de forma burra: ela trava a linha via `FOR UPDATE`, soma o saldo, e salva um log indelével e idempontente na tabela `wallet_transactions`.

## 2. API: \`create_checkout_session\`
O arquivo \`server.ts\` expõe um \`POST /api/create-checkout-session\`.  
**Como funciona**:
1. O backend em Node.js valida o request.
2. Aciona a biblioteca oficial do \`stripe\`.
3. Injeta no \`metadata\` a assinatura digital: \`userId\` e \`coinsAmount\` (quantidade de moedas para este plano).
4. Retorna a URL do Checkout pro cliente seguir. O fluxo do browser fica no ambiente seguro da _Stripe_.

## 3. Webhook: Evento de Pagamento Aprovado
Na rota \`POST /api/stripe-webhook\`, o servidor ignora o _body parser_ JSON tradicional para forçar Buffer (`express.raw`), o que é **obrigatório** para que o \`constructEvent\` do Stripe valide a criptografia a partir do cabeçalho da requisição (\`STRIPE_WEBHOOK_SECRET\`). 

**Idempotência e Segurança**:  
1. Somente a Stripe detém o segredo para forjar esta requisição com sucesso.  
2. Uma vez validado, os metadados (garantidos inalteráveis pelo frontend) revelam o UUID do profissional.
3. Node invoca (Backend -> DB) através de RPC protegido (\`/stripe_wallet.sql\`), executando tudo sob a alçada de "Service Role" (\`SUPABASE_SERVICE_ROLE_KEY\`). O usuário final da API Supabase (anon ou authenticated) **não** tem nenhum método ou restrição liberada para essa tabela e RPC.

## 4. O Sistema de Ledger (RPC: \`credit_wallet\`)
Arquivos vitais gerados:
- \`stripe_wallet.sql\`: Define a tabela \`wallet_transactions\` e a \`plpgsql\` function chamada restritamente (\`SECURITY DEFINER\`).

**Por que a RPC criada é segura?**
- Bloqueia leitura duplicada durante inserts simultâneos (\`FOR UPDATE\`). Se dois webhooks chegarem juntos em milisegundos, eles fikarão na fila na mesma transaction do Postgres. 
- Contém _constraints UNIQUE_ para \`stripe_session_id\` e \`stripe_event_id\`.
- O webhook Node engole silenciosamente o erro de chave duplicada ("duplicate key value violates unique constraint") para responder \`200 OK\` pro Stripe e estancar tentativas de repetição.

## 5. Como Testar
Aqui estão testes que você pode fazer usando a **Stripe CLI** \`stripe listen --forward-to localhost:3000/api/stripe-webhook\`:

### Teste 1: Pagamento Aberto Bem-Sucedido
1. Crie uma sessão a partir da sua interface de Assinatura.
2. Na aba que vai abrir (modo de teste Stripe), preencha o cartão universal "4242 4242..." 
3. Confirme e veja a requisição retornar para o seu _success_url_ (URL parametrizada).
4. Cheque \`wallet_transactions\` no DB, você verá o UUID e o incremento.

### Teste 2: Webhook Duplicado (Replay Attack)
Para prevenir ataques de "estresse", re-envie o último evento Stripe (via Stripe Dashboard > Developers > Webhooks > Resend).
- **Expectativa:** O evento baterá no Express, chamará o Supabase que fará \`INSERT\` na logística \`wallet_transactions\`. 
- **Resultado:** A _Unique Constraint Violation_ rechaça passivamente e ignora. Nenhuma quantia será adicionada fora da regra.

### Teste 3: Webhook Falso ou Inválido (Fraude)
Desative momentaneamente a chave \`STRIPE_WEBHOOK_SECRET\` do ambiente \`.env\` ou troque uma letra. 
- Dispare o trigger Stripe via código externo simulado pelo CLI ou app como Postman. 
- **Resultado:** O evento baterá com um Hash divergente no cabeçalho \`stripe-signature\` perante ao raw hash construído pela lib \`stripe.webhooks.constructEvent\`. Retornará _HTTP 400_. Fraude impedida sem acessar o DB.

## 6. Implementação Obrigatória
O único passo que você deve seguir agora fora deste app é copiar e executar o código contido no arquivo que eu adicionei no disco: \`stripe_wallet.sql\` dentro do ambiente Supabase Editor, e as variáveis configuradas em \`.env.example\` deverão estar refletidas com chaves reais da sua plataforma Supabase e Stripe.
