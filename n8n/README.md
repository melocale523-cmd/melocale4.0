# Milocale — publicação social (rascunhos desativados)

Dois workflows estão importados no n8n dedicado, ambos **inativos**:

- `MILOCALE-SOCIAL-PUBLISH-PREFLIGHT.json` (`4RJZYFzmVUIrbbbY`): prévia de conteúdo aprovado/ready/feed, sem publicação. O domínio `REPLACE_MILOCALE_SUPABASE_REF` é propositalmente inválido até vincular o projeto Supabase correto e sua credencial exclusiva.
- `MILOCALE-SOCIAL-PUBLISH-DISPATCHER.json` (`uVnkm0Onw8fy8i9t`): cron a cada cinco minutos que chamará o backend da Milocale para publicar **uma** imagem aprovada e agendada. O domínio `milocale-backend.example.invalid` impede execução acidental. Configure a URL HTTPS real e uma credencial n8n Header Auth `x-milocale-social-token` exclusiva; não coloque o token no JSON.

O backend já usa o Supabase da Milocale. O despachante não recebe uma chave ampla do banco. A branch de preparação inclui `POST /api/internal/social/publish-due` com autenticação por `MILOCALE_N8N_SOCIAL_TOKEN`, claim condicional `approved -> publishing`, publicação pelo serviço Instagram existente e atualização `published` com ID externo. A rota manual usa o mesmo claim. Se o resultado externo for incerto, o item permanece `publishing` e exige reconciliação, sem repetição automática.

**Bloqueios antes da ativação:** aplicar a migração `social_publish_atomic_claim` no projeto certo, implantar o backend revisado, configurar token no backend e no cofre do n8n, trocar domínio inválido, confirmar a credencial do Instagram e homologar a publicação com uma imagem aprovada. Nenhuma dessas etapas de produção foi executada. Outras plataformas e formatos continuam fora do despachante.
