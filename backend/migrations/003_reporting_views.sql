-- Reporting foundation. Requires migration 001.
BEGIN;

CREATE OR REPLACE VIEW inventory_flow_report AS
WITH bounds AS (
  SELECT m.id AS material_id, m.code, m.name, m.group_name
  FROM materials m
  WHERE m.active = TRUE
), movements AS (
  SELECT material_id,
         SUM(CASE WHEN type IN ('in','adjust') THEN qty_kg ELSE 0 END) AS total_in,
         SUM(CASE WHEN type = 'out' THEN qty_kg ELSE 0 END) AS total_out
  FROM inventory_movements
  GROUP BY material_id
)
SELECT b.material_id, b.code, b.name, b.group_name,
       COALESCE(m.total_in, 0)::numeric(14,3) AS total_in,
       COALESCE(m.total_out, 0)::numeric(14,3) AS total_out,
       (COALESCE(m.total_in, 0) - COALESCE(m.total_out, 0))::numeric(14,3) AS closing_qty,
       COALESCE(i.qty_kg, 0)::numeric(14,3) AS inventory_qty,
       ((COALESCE(m.total_in, 0) - COALESCE(m.total_out, 0)) - COALESCE(i.qty_kg, 0))::numeric(14,3) AS reconciliation_delta
FROM bounds b
LEFT JOIN movements m ON m.material_id = b.material_id
LEFT JOIN inventory i ON i.material_id = b.material_id;

CREATE OR REPLACE VIEW sales_margin_report AS
SELECT so.id AS sales_order_id,
       so.code AS sales_code,
       so.sold_at,
       si.id AS sales_item_id,
       si.material_id,
       si.material_name_snapshot,
       si.qty_kg,
       si.unit_price AS sale_unit_price,
       si.line_amount AS revenue,
       COALESCE(si.cost_snapshot, fifo.unit_cost, 0)::bigint AS cost_unit_price,
       ROUND(si.qty_kg * COALESCE(si.cost_snapshot, fifo.unit_cost, 0))::bigint AS cost_amount,
       (si.line_amount - ROUND(si.qty_kg * COALESCE(si.cost_snapshot, fifo.unit_cost, 0)))::bigint AS gross_profit
FROM sales_orders so
JOIN sales_items si ON si.sales_order_id = so.id
LEFT JOIN LATERAL (
  SELECT pi.unit_price AS unit_cost
  FROM purchase_items pi
  JOIN purchase_orders po ON po.id = pi.order_id
  WHERE pi.material_id = si.material_id
    AND po.status = 'completed'
    AND COALESCE(po.completed_at, po.created_at) <= so.sold_at
  ORDER BY COALESCE(po.completed_at, po.created_at) DESC, pi.id DESC
  LIMIT 1
) fifo ON TRUE;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_material_created
  ON inventory_movements(material_id, created_at, type);

COMMIT;
