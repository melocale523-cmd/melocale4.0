import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { supabaseAdmin } from '../config.js';
import { publishApprovedInstagramImage } from '../services/socialContentStudio.js';

const router = Router();

function authorized(value: unknown): boolean {
  const expected = process.env.MILOCALE_N8N_SOCIAL_TOKEN;
  if (!expected || expected.length < 32 || typeof value !== 'string') return false;
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

router.post('/publish-due', async (req, res) => {
  if (!process.env.MILOCALE_N8N_SOCIAL_TOKEN) return res.status(503).json({ error: 'social_publisher_not_configured' });
  if (!authorized(req.header('x-milocale-social-token'))) return res.status(401).json({ error: 'unauthorized' });
  if (!process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim() || !process.env.META_INSTAGRAM_ACCOUNT_ID?.trim()) {
    return res.status(503).json({ error: 'instagram_publisher_not_configured' });
  }

  const now = new Date().toISOString();
  const { data: candidates, error: readError } = await supabaseAdmin.from('social_content_items')
    .select('id').eq('status', 'approved').not('approved_at', 'is', null).eq('generation_status', 'ready').eq('format', 'feed')
    .not('image_storage_path', 'is', null).not('scheduled_for', 'is', null)
    .lte('scheduled_for', now).order('scheduled_for', { ascending: true }).limit(5);
  if (readError) return res.status(503).json({ error: 'social_queue_unavailable' });

  for (const candidate of candidates ?? []) {
    const { data: item, error: claimError } = await supabaseAdmin.from('social_content_items')
      .update({ status: 'publishing', publishing_started_at: now, updated_at: now })
      .eq('id', candidate.id).eq('status', 'approved').not('approved_at', 'is', null).eq('generation_status', 'ready')
      .eq('format', 'feed').lte('scheduled_for', now)
      .select('id,image_storage_path,content').maybeSingle();
    if (claimError) return res.status(503).json({ error: 'social_claim_unavailable' });
    if (!item) continue;

    try {
      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from('social-content').createSignedUrl(item.image_storage_path, 3_600);
      if (signedError || !signed?.signedUrl) throw new Error('image_url_unavailable');
      const content = (item.content ?? {}) as { caption?: unknown; cta?: unknown };
      const caption = [content.caption, content.cta]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .map((part) => part.trim()).join('\n\n');
      const published = await publishApprovedInstagramImage({ imageUrl: signed.signedUrl, caption });
      const { data: saved, error: saveError } = await supabaseAdmin.from('social_content_items')
        .update({ status: 'published', published_at: new Date().toISOString(),
          instagram_container_id: published.containerId, instagram_media_id: published.mediaId,
          publication_error: null, updated_at: new Date().toISOString() })
        .eq('id', item.id).eq('status', 'publishing').select('id').maybeSingle();
      if (saveError || !saved) throw new Error('published_but_state_unconfirmed');
      return res.json({ result: 'published', item_id: item.id, instagram_media_id: published.mediaId });
    } catch {
      await supabaseAdmin.from('social_content_items')
        .update({ publication_error: 'Publication outcome requires manual reconciliation', updated_at: new Date().toISOString() })
        .eq('id', item.id).eq('status', 'publishing');
      // Keep publishing: retry only after checking whether Instagram already received it.
      return res.status(502).json({ error: 'publication_requires_reconciliation', item_id: item.id });
    }
  }
  return res.json({ result: 'no_due_item' });
});

export default router;
