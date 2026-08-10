BEGIN;
DROP VIEW IF EXISTS sales_margin_report;
DROP VIEW IF EXISTS inventory_flow_report;
DROP INDEX IF EXISTS idx_inventory_movements_material_created;
COMMIT;
