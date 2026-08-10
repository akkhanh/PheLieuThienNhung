import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../backend/migrations/001_business_integrity_upgrade.sql", import.meta.url);
const serverUrl = new URL("../backend/server.mjs", import.meta.url);

async function readText(url) {
  return readFile(url, "utf8");
}

function compact(source) {
  return source.replace(/\s+/g, " ");
}

test("migration only allows completed and cancelled order status", async () => {
  const source = compact(await readText(migrationUrl));

  assert.ok(source.includes("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'"));
  assert.ok(source.includes("ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check CHECK (status IN ('completed','cancelled'))"));
  assert.match(source, /ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS cancelled_by BIGINT REFERENCES users\(id\), ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT ''/);
});

test("cancel order reverses inventory and writes an outbound movement", async () => {
  const source = compact(await readText(serverUrl));

  assert.match(source, /async\s+function\s+cancelOrder\(client,\s*user,\s*orderId\)/);
  assert.match(source, /if\s*\(!inv\.rows\[0\]\s*\|\|\s*Number\(inv\.rows\[0\]\.qty_kg\)\s*<\s*Number\(item\.qty_kg\)\)\s*\{/);
  assert.match(source, /UPDATE\s+inventory\s+SET\s+qty_kg=qty_kg-\$1,\s*updated_at=now\(\)\s+WHERE\s+material_id=\$2/);
  assert.match(source, /INSERT\s+INTO\s+inventory_movements\(material_id,type,qty_kg,ref_type,ref_id,created_by,note\)\s+VALUES\(\$1,'out',\$2,'purchase_order',\$3,\$4,\$5\)/);
  assert.match(source, /UPDATE\s+purchase_orders\s+SET\s+status='cancelled',completed_at=NULL\s+WHERE\s+id=\$1/);
});

test("sales order creation blocks outbound quantities above on-hand stock", async () => {
  const source = compact(await readText(serverUrl));

  assert.match(source, /if\s*\(!inventoryRow\s*\|\|\s*Number\(inventoryRow\.qty_kg\)\s*<\s*Number\(item\.qty_kg\)\)\s*return\s*\{\s*ok:\s*false,\s*status:\s*409,\s*message:\s*`Tồn kho không đủ[^`]*`\s*\};/);
});

test("inventory flow report exposes in out closing and reconciliation fields", async () => {
  const source = compact(await readText(serverUrl));

  assert.ok(source.includes('route === "/api/reports/inventory-flow" && req.method === "GET"'));
  assert.match(source, /SELECT\s+material_id,code,name,group_name,total_in,total_out,closing_qty,inventory_qty,reconciliation_delta\s+FROM\s+inventory_flow_report\s+ORDER\s+BY\s+name\s+ASC/);
});
