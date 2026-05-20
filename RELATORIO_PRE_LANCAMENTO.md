# RELATÓRIO PRÉ-LANÇAMENTO — MeloCalé 4.0
Data: 2026-05-20

---

## PONTUAÇÃO POR DIMENSÃO

| Dimensão           | Nota  | Status |
|--------------------|-------|--------|
| TypeScript/Build   | 7/10  | ⚠️     |
| Testes             | 9/10  | ✅     |
| Segurança          | 10/10 | ✅     |
| Qualidade código   | 6/10  | ⚠️     |
| Performance/PWA    | 8/10  | ✅     |
| SEO                | 8/10  | ✅     |
| Variáveis de Env   | 5/10  | ❌     |
| UX/Dados reais     | 5/10  | ❌     |
| **TOTAL**          | **58/80** | ⚠️ |

---

## ✅ PRONTO PARA LANÇAMENTO

- **Testes unitários**: 18/18 passando (purchaseLead, reschedule, ReviewModal, reviewService)
- **CI workflow**: jobs de unit-tests, e2e-tests e typecheck corretamente configurados com upload de artefatos de falha
- **Segurança**: zero secrets hardcoded no código-fonte (`sk_live`, `anon_key`, `service_role`, `password=`)
- **Segurança**: zero URLs de produção hardcodadas fora de `src/lib/api.ts`
- **Segurança**: zero `console.log` com dados sensíveis sem guard de ambiente
- **Segurança**: zero `window.alert()` ou `window.confirm()` no código de produção
- **TypeScript frontend**: zero erros reais (o único aviso pré-existente é `vite/client`, excluído do critério)
- **SEO base**: `<meta description>`, `og:title`, `og:description`, `og:type`, `og:url`, `twitter:card`, `viewport` e `theme-color` presentes no `index.html`
- **SEO dinâmico**: `HelmetProvider` instalado em `main.tsx`; `PerfilPublico.tsx` gera `<title>` e `<meta description>` dinâmicos por profissional (ótimo para indexação e compartilhamento)
- **PWA**: `VitePWA` configurado com estratégia `injectManifest`; `sw.ts` presente; ícones `icon-192.png` (3.4 KB) e `icon-512.png` (15 KB) existem; manifest embutido no `vite.config.ts` com `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `icons`
- **Bundle splitting**: `manualChunks` separa vendors críticos (`react`, `@tanstack`, `@supabase`, `lucide-react`, `recharts`, `framer-motion`) — builds em produção devem ter chunks controlados
- **Guard de build**: `vite.config.ts` rejeita build de produção sem `VITE_API_URL`, evitando Service Worker quebrado no Vercel

---

## ⚠️ RECOMENDADO CORRIGIR ANTES

### Backend TypeScript
- **Arquivo**: `backend/tsconfig.server.json`
- **Erro**: `TS2688: Cannot find type definition file for 'node'`
- **Causa provável**: `@types/node` ausente no `devDependencies` do backend
- **Correção**: `cd backend && npm install -D @types/node`

### `any` explícito em código de produção
Encontrados em 6 arquivos fora de testes:
| Arquivo | Linha | Uso |
|---------|-------|-----|
| `src/pages/Landing.tsx` | 311–335 | `CheckIcon`, `XIcon`, `BriefcaseIcon`, `UserIcon`, `CreditCardIcon` com `props: any` |
| `src/pages/auth/Login.tsx` | 123, 251 | `catch (err: any)` |
| `src/pages/auth/Login.tsx` | 218 | `setMode(selectedRole as any)` |
| `src/pages/professional/Assinatura.tsx` | 219 | `catch (err: any)` |
| `src/pages/professional/Compras.tsx` | 36, 49, 83, 108, 464 | parâmetros de função e cast |
| `src/pages/professional/Estatisticas.tsx` | 74 | `setRange(item.id as any)` |
| `src/components/auth/AuthInitializer.tsx` | 48 | `(profile as any)?.role` |

- **Risco**: baixo para lançamento, mas reduz rastreabilidade de bugs em produção
- **Prioridade**: P2 — corrigir após lançamento

### Componentes acima de 400 linhas
| Arquivo | Linhas |
|---------|--------|
| `Assinatura.tsx` | 764 |
| `RequestWizard.tsx` | 650 |
| `Login.tsx` | 613 |
| `Leads.tsx` | 585 |
| `Compras.tsx` | 524 |
| `Agenda.tsx` | 512 |
| `Perfil.tsx` (profissional) | 451 |
| `ChatLayout.tsx` | 415 |

- **Risco**: manutenção futura mais difícil; sem impacto imediato para usuários
- **Prioridade**: P3 — refatorar incrementalmente

### SEO — `og:image` ausente
- `index.html` não possui `<meta property="og:image">` nem `<meta name="twitter:image">`
- Resultado: links compartilhados nas redes sociais aparecem sem imagem de prévia
- **Correção**: adicionar uma imagem OG (1200×630px) em `public/` e referenciar no `index.html`
- **Prioridade**: P2

### `frontend/.env.example` incompleto
O arquivo existe mas está faltando variáveis críticas:
| Variável | Status no .env.example |
|----------|------------------------|
| `VITE_SUPABASE_URL` | ✅ documentada |
| `VITE_SUPABASE_ANON_KEY` | ✅ documentada |
| `VITE_SENTRY_DSN` | ✅ documentada (vazia) |
| `VITE_API_URL` | ❌ **AUSENTE** |
| `VITE_VAPID_PUBLIC_KEY` | ❌ **AUSENTE** |

- `VITE_API_URL` ausente no `.env.example` é especialmente crítico: o build de produção falha silenciosamente para quem clonar o repo sem conhecer essa variável
- **Prioridade**: P1

---

## ❌ CRÍTICO — BLOQUEIA LANÇAMENTO

### 1. `backend/.env.example` inexistente
- O backend usa 8 variáveis de ambiente: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `ANTHROPIC_API_KEY`
- **Não existe `backend/.env.example`**
- Qualquer deploy manual ou onboarding de novo colaborador resultará em servidor que não sobe (o código já lança exceção se `ANTHROPIC_API_KEY` faltar)
- **Correção**: criar `backend/.env.example` com todas as variáveis documentadas (sem valores reais)

### 2. Links mortos no `Footer.tsx`
- **7 links com `href="#"`** visíveis para todos os usuários:
  - Redes sociais: Instagram, Facebook, Twitter, LinkedIn (4 links)
  - Navegação: "Portfólio", "Novos Lançamentos", "Governança", "Anunciar Imóvel", "Whitepaper", "Privacidade" (6 links)
- Links de privacidade apontando para `#` pode configurar **violação de LGPD** (ausência de Política de Privacidade acessível)
- **Opções**:
  - a) Criar as páginas `/privacidade` e `/termos` antes do lançamento (obrigatório para LGPD)
  - b) Remover os links do footer até que as páginas existam
  - c) Ocultar seções do footer com conteúdo inexistente
- **Prioridade**: P0 — o link de Privacidade é especialmente crítico para conformidade legal

---

## PRÓXIMOS PASSOS

**Pré-lançamento (fazer agora):**
1. Criar `backend/.env.example` com todas as 8 variáveis e seus nomes documentados
2. Adicionar `VITE_API_URL` e `VITE_VAPID_PUBLIC_KEY` ao `frontend/.env.example`
3. Criar página `/privacidade` (mínima, com dados do responsável, finalidade do tratamento, contato DPO) — obrigatório LGPD
4. Corrigir `Footer.tsx`: substituir `href="#"` por links reais ou remover itens não implementados
5. Corrigir erro `TS2688` no backend: `cd backend && npm install -D @types/node`

**Pós-lançamento (primeira semana):**
6. Adicionar `og:image` (1200×630px) no `index.html`
7. Criar página `/termos` com Termos de Serviço básicos
8. Adicionar links reais de redes sociais quando perfis estiverem criados
9. Tipar os `any` mais críticos em `Compras.tsx` e `AuthInitializer.tsx`

**Médio prazo (primeiro mês):**
10. Refatorar os 8 componentes acima de 400 linhas (começar por `Assinatura.tsx` e `RequestWizard.tsx`)

---

## RESUMO EXECUTIVO

O MeloCalé 4.0 tem uma base técnica sólida: testes passando, segurança adequada, PWA configurado e SEO funcional. Os dois bloqueadores reais para lançamento são **documentação de ambiente incompleta** (risco operacional de deploy) e **links mortos no footer**, sendo o link de Privacidade um risco legal sob LGPD. Resolvidos esses dois pontos, o produto está em condições de receber usuários.
