-- Rollback for 001_business_integrity_upgrade.sql
-- Take a backup first. This removes any data written to the new tables/columns.
BEGIN;
DROP INDEX IF EXISTS uq_customer_phone_real;
DROP INDEX IF EXISTS idx_sales_orders_sold_at;
DROP INDEX IF EXISTS idx_purchase_orders_customer_status;
DROP INDEX IF EXISTS idx_lot_allocations_sale;
DROP TABLE IF EXISTS inventory_lot_allocations;
DROP INDEX IF EXISTS idx_inventory_lots_fifo;
DROP TABLE IF EXISTS inventory_lots;
DROP INDEX IF EXISTS idx_customer_price_rules_active;
DROP TABLE IF EXISTS customer_price_rules;
DROP INDEX IF EXISTS idx_price_history_lookup;
DROP TABLE IF EXISTS price_history;
ALTER TABLE sales_items DROP COLUMN IF EXISTS price_source, DROP COLUMN IF EXISTS cost_snapshot, DROP COLUMN IF EXISTS price_snapshot;
ALTER TABLE purchase_items DROP COLUMN IF EXISTS price_source, DROP COLUMN IF EXISTS price_snapshot;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS cancellation_reason, DROP COLUMN IF EXISTS cancelled_by, DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS cancellation_reason, DROP COLUMN IF EXISTS cancelled_by, DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE customers DROP COLUMN IF EXISTS is_guest, DROP COLUMN IF EXISTS nickname;
COMMIT;
