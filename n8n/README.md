# Milocale — publicação social (preparação)

`workflows/MILOCALE-SOCIAL-PUBLISH-PREFLIGHT.json` está importado **inativo** no n8n dedicado (`4RJZYFzmVUIrbbbY`). Consulta somente conteúdo `approved`, `ready`, `feed` e agendado, e emite IDs para revisão. Não possui nó de publicação nem altera o banco.

Antes de completar o fluxo:
1. Conectar o projeto Supabase da Milocale separadamente e configurar a URL correta e credencial n8n exclusiva. O texto `REPLACE_MILOCALE_SUPABASE_REF` bloqueia execução acidental.
2. Implementar reserva atômica e reconciliação no backend. A rota atual `/api/admin/social-content/:id/publish-instagram` verifica `approved`, mas não reserva o item antes da chamada ao Instagram. Ligá-la diretamente a um agendador pode duplicar postagens.
3. Validar credencial do Instagram e testar com imagem aprovada, sem disparos concorrentes; depois revisar a ativação.

O backend já publica imagens aprovadas manualmente. Não duplicar a lógica do Instagram no n8n sem integrar o histórico e as travas do produto.
