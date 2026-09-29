# Milocale — publicação social (rascunhos desativados)

Dois workflows estão importados no n8n dedicado, ambos **inativos**:

- `MILOCALE-SOCIAL-PUBLISH-PREFLIGHT.json` (`4RJZYFzmVUIrbbbY`): prévia de conteúdo aprovado/ready/feed, sem publicação. A URL aponta para o projeto Supabase da Milocale `wfournowizclpiektwuv`, conforme o backend em execução; a credencial n8n exclusiva ainda falta.
- `MILOCALE-SOCIAL-PUBLISH-DISPATCHER.json` (`uVnkm0Onw8fy8i9t`): cron a cada cinco minutos que chamará o backend da Milocale para publicar **uma** imagem aprovada e agendada. A URL HTTPS real é `api.melocale.com.br`; o fluxo continua inativo. Configure uma credencial n8n Header Auth `x-milocale-social-token` exclusiva; não coloque o token no JSON.

O backend já usa o Supabase da Milocale. O despachante não recebe uma chave ampla do banco. A branch de preparação inclui `POST /api/internal/social/publish-due` com autenticação por `MILOCALE_N8N_SOCIAL_TOKEN`, claim condicional `approved -> publishing`, publicação pelo serviço Instagram existente e atualização `published` com ID externo. A rota manual usa o mesmo claim. Se o resultado externo for incerto, o item permanece `publishing` e exige reconciliação, sem repetição automática.

**Bloqueios antes da ativação:** aplicar a migração `social_publish_atomic_claim` no projeto certo, implantar o backend revisado, configurar token no backend e no cofre do n8n, confirmar a URL real no ambiente, confirmar a credencial do Instagram e homologar a publicação com uma imagem aprovada. Nenhuma dessas etapas de produção foi executada. Outras plataformas e formatos continuam fora do despachante.

## Estado operacional em 29/09/2026 UTC

- A alteração pontual `social_publish_atomic_claim` foi executada no projeto `wfournowizclpiektwuv` por `supabase db query`; a coluna `publishing_started_at` foi confirmada pela API. O histórico remoto de migrações diverge deste repositório: não usar `db push` nem `migration repair` em lote até reconciliar a origem das versões antigas.
- O backend `milocale-backend:social-700a72b` está em execução, com a versão anterior preservada em `milocale-backend-backup-social-20260929` e a anterior sem token em `milocale-backend-backup-tokenless-20260929`. Saúde local e via Caddy local: HTTP 200.
- `MILOCALE_N8N_SOCIAL_TOKEN` está configurado no container; o valor exclusivo está em `/home/hermesadmin/.local/state/hermes-milocale-social/token` (permissão 0600). Não copiar o segredo para o workflow JSON ou para o Git. Sem o cabeçalho correto, a rota retorna 401.
- O container n8n alcança `https://api.melocale.com.br/api/health` (HTTP 200). O dispatcher permanece inativo e sem credencial atribuída; ainda faltam a credencial Header Auth no cofre n8n, a validação da conta Instagram e a homologação de uma imagem aprovada.
