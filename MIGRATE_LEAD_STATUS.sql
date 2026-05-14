UPDATE leads SET status = 'orçando'
WHERE id IN (
  SELECT DISTINCT lead_id FROM lead_purchases
  WHERE lead_id IS NOT NULL
)
AND status = 'open';
