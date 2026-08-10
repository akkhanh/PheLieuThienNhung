-- Thiên Nhung - business integrity upgrade
-- IMPORTANT: review SCHEMA_CHANGES.md before running. This file is intentionally not executed by the app.
BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS nickname TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check CHECK (status IN ('completed','cancelled'));
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status, sold_at DESC);

-- Preserve the exact applied price/cost on each line, independent of later price edits.
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS price_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'manual';
UPDATE purchase_items SET price_snapshot = unit_price WHERE price_snapshot IS NULL;
ALTER TABLE purchase_items ALTER COLUMN price_snapshot SET NOT NULL;

ALTER TABLE sales_items
  ADD COLUMN IF NOT EXISTS price_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS cost_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'manual';
UPDATE sales_items SET price_snapshot = unit_price WHERE price_snapshot IS NULL;
ALTER TABLE sales_items ALTER COLUMN price_snapshot SET NOT NULL;

CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  material_id BIGINT NOT NULL REFERENCES materials(id),
  price_type TEXT NOT NULL CHECK (price_type IN ('purchase','sale','public')),
  price_per_kg INTEGER NOT NULL CHECK (price_per_kg >= 0),
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  changed_by BIGINT REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '',
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX IF NOT EXISTS idx_price_history_lookup
  ON price_history(material_id, price_type, effective_from DESC);

INSERT INTO price_history(material_id, price_type, price_per_kg, effective_from, note)
SELECT p.material_id, 'purchase', p.price_per_kg, p.effective_from, 'Backfill từ prices hiện tại'
FROM prices p
WHERE p.is_current = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM price_history h
    WHERE h.material_id = p.material_id
      AND h.price_type = 'purchase'
      AND h.effective_from = p.effective_from
  );

CREATE TABLE IF NOT EXISTS customer_price_rules (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  material_id BIGINT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('amount','percent')),
  adjustment_value NUMERIC(12,2) NOT NULL CHECK (adjustment_value >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (adjustment_type <> 'percent' OR adjustment_value <= 100)
);
CREATE INDEX IF NOT EXISTS idx_customer_price_rules_active
  ON customer_price_rules(customer_id, material_id, active);

-- Lots make inventory origin and FIFO/COGS auditable instead of inferred only from totals.
CREATE TABLE IF NOT EXISTS inventory_lots (
  id BIGSERIAL PRIMARY KEY,
  material_id BIGINT NOT NULL REFERENCES materials(id),
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id),
  purchase_item_id BIGINT NOT NULL UNIQUE REFERENCES purchase_items(id),
  qty_received NUMERIC(14,3) NOT NULL CHECK (qty_received > 0),
  qty_remaining NUMERIC(14,3) NOT NULL CHECK (qty_remaining >= 0 AND qty_remaining <= qty_received),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (purchase_order_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo
  ON inventory_lots(material_id, received_at, id);

CREATE TABLE IF NOT EXISTS inventory_lot_allocations (
  id BIGSERIAL PRIMARY KEY,
  lot_id BIGINT NOT NULL REFERENCES inventory_lots(id),
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
  sales_item_id BIGINT NOT NULL REFERENCES sales_items(id),
  qty_kg NUMERIC(14,3) NOT NULL CHECK (qty_kg > 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lot_id, sales_item_id)
);
CREATE INDEX IF NOT EXISTS idx_lot_allocations_sale
  ON inventory_lot_allocations(sales_order_id, sales_item_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_customer_status
  ON purchase_orders(customer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_sold_at
  ON sales_orders(sold_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_phone_real
  ON customers(phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

COMMIT;
