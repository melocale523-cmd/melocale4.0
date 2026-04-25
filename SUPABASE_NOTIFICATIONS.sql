-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- O sistema (Service Role) ou o remetente pode inserir
CREATE POLICY "Anyone authenticated can send notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Habilitar Realtime para esta tabela (MUITO IMPORTANTE)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
