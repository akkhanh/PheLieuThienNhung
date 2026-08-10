-- Merge duplicate guest customer profiles by normalized phone.
-- Run only after 001_business_integrity_upgrade.sql and a database backup.
BEGIN;

CREATE TEMP TABLE guest_customer_merge_map ON COMMIT DROP AS
WITH candidates AS (
  SELECT c.id, c.phone,
         COUNT(o.id) FILTER (WHERE o.status <> 'cancelled') AS order_count,
         MAX(o.created_at) AS last_order_at
  FROM customers c
  LEFT JOIN purchase_orders o ON o.customer_id = c.id
  WHERE c.is_guest = TRUE AND btrim(c.phone) <> ''
  GROUP BY c.id, c.phone
), ranked AS (
  SELECT *, FIRST_VALUE(id) OVER (
    PARTITION BY regexp_replace(phone, '[^0-9+]', '', 'g')
    ORDER BY order_count DESC, last_order_at DESC NULLS LAST, id
  ) AS keep_id
  FROM candidates
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE id <> keep_id;

UPDATE purchase_orders po
SET customer_id = m.keep_id
FROM guest_customer_merge_map m
WHERE po.customer_id = m.duplicate_id;

UPDATE audit_logs a
SET metadata = a.metadata || jsonb_build_object('merged_into_customer_id', m.keep_id)
FROM guest_customer_merge_map m
WHERE a.entity = 'customer' AND a.entity_id = m.duplicate_id;

INSERT INTO audit_logs(action, entity, entity_id, metadata)
SELECT 'merge', 'customer', duplicate_id,
       jsonb_build_object('merged_into_customer_id', keep_id, 'reason', 'duplicate guest phone')
FROM guest_customer_merge_map;

DELETE FROM customers c
USING guest_customer_merge_map m
WHERE c.id = m.duplicate_id;

COMMIT;
