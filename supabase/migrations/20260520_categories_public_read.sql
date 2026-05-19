-- Allow unauthenticated (anon) users to read active categories.
-- Required so the signup form can populate the category select before the
-- user has an auth session.
CREATE POLICY "categories_public_read"
ON categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);
