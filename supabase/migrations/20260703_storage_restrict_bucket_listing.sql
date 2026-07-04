-- Advisor public_bucket_allows_listing (2 WARN): as policies de SELECT amplas
-- em storage.objects permitiam ENUMERAR todos os arquivos dos buckets —
-- avatars por qualquer pessoa (role public) e chat-files por qualquer
-- autenticado, inclusive arquivos de conversas alheias.
--
-- A exibição de avatar/foto de chat NÃO depende dessas policies: os buckets
-- são public=true e a leitura por URL direta (/object/public/...) bypassa
-- RLS. SELECT em storage.objects só governa list()/download()/upsert — e
-- nenhum código do app usa list()/download() nesses buckets.
--
-- Mantido SELECT escopado ao dono:
--  - avatars: pasta do próprio usuário (o upload de perfil usa upsert:true,
--    que precisa de SELECT+UPDATE do objeto existente).
--  - chat-files: objetos do próprio uploader (owner).

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY avatars_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "chat-files: leitura autenticada" ON storage.objects;
CREATE POLICY chat_files_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND owner = auth.uid());
