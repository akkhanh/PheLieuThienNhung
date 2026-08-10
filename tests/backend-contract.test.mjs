import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSourceUrl = new URL("../backend/server.mjs", import.meta.url);

async function readServerSource() {
  return readFile(serverSourceUrl, "utf8");
}

function compact(source) {
  return source.replace(/\s+/g, " ");
}

test("backend keeps auth and RBAC guards in place", async () => {
  const source = await readServerSource();

  assert.match(source, /async function currentUser\(req,\s*client\s*=\s*pool\)/);
  assert.match(source, /route\s*===\s*["']\/api\/auth\/me["']\s*&&\s*req\.method\s*===\s*["']GET["']/);
  assert.match(source, /route\s*===\s*["']\/api\/customers["']\s*&&\s*req\.method\s*===\s*["']GET["'][\s\S]*?guard\(res,\s*user,\s*["']admin["']\)/);
  assert.match(source, /route\s*===\s*["']\/api\/orders["']\s*&&\s*req\.method\s*===\s*["']POST["'][\s\S]*?guard\(res,\s*user,\s*["']admin["']\)/);
  assert.match(source, /route\s*===\s*["']\/api\/customer\/orders["']\s*&&\s*req\.method\s*===\s*["']GET["'][\s\S]*?guard\(res,\s*user,\s*["']customer["']\)/);
  assert.match(source, /route\s*===\s*["']\/api\/customer\/reports["']\s*&&\s*req\.method\s*===\s*["']GET["'][\s\S]*?guard\(res,\s*user,\s*["']customer["']\)/);
  assert.match(source, /route\s*===\s*["']\/api\/reports\/summary["']\s*&&\s*req\.method\s*===\s*["']GET["'][\s\S]*?guard\(res,\s*user,\s*["']admin["']\)/);
});

test("customer endpoints stay scoped to the signed-in customer", async () => {
  const source = await readServerSource();

  assert.match(
    source,
    /SELECT\s+o\.code,\s*o\.status,\s*o\.total_amount,\s*o\.created_at,\s*o\.completed_at\s+FROM\s+purchase_orders\s+o\s+JOIN\s+customers\s+c\s+ON\s+c\.id=o\.customer_id\s+WHERE\s+c\.user_id=\$1\s+ORDER BY\s+o\.id\s+DESC/s,
  );
  assert.match(source, /o\.code=\$1\s+AND\s+c\.user_id=\$2/);
  assert.match(
    source,
    /COUNT\(\*\)::int\s+orders,\s*COALESCE\(SUM\(total_amount\),0\)::int\s+total_amount,\s*MAX\(completed_at\)\s+last_order_at\s+FROM\s+purchase_orders\s+o\s+JOIN\s+customers\s+c\s+ON\s+c\.id=o\.customer_id\s+WHERE\s+c\.user_id=\$1\s+AND\s+o\.status='completed'/,
  );
  assert.match(
    source,
    /SELECT\s+i\.material_name_snapshot\s+name,\s*SUM\(i\.qty_kg\)::float\s+qty_kg\s+FROM\s+purchase_items\s+i\s+JOIN\s+purchase_orders\s+o\s+ON\s+o\.id=i\.order_id\s+JOIN\s+customers\s+c\s+ON\s+c\.id=o\.customer_id\s+WHERE\s+c\.user_id=\$1\s+AND\s+o\.status='completed'\s+GROUP\s+BY\s+i\.material_id,\s*i\.material_name_snapshot\s+ORDER\s+BY\s+qty_kg\s+DESC\s+LIMIT\s+1/,
  );
});

test("input validation remains enforced on write endpoints", async () => {
  const source = compact(await readServerSource());

  assert.ok(source.includes('missing(d, ["name", "email", "password"]).length') || source.includes('missing(d,["name","email","password"]).length'));
  assert.ok(source.includes('String(d.password).length < 8'));
  assert.ok(
    source.includes('if (!name || !phone) return { ok: false, message: "Tên và số điện thoại là bắt buộc" };') ||
      source.includes('if (!name || !phone) return { ok: false, message: "Tên và số điện thoại là bắt buộc" }'),
  );
  assert.ok(source.includes('!d.material_id') && source.includes('!Number.isInteger(d.price_per_kg)') && source.includes('d.price_per_kg < 0'));
  assert.ok(source.includes('d.items || d.customer_id || d.note !== undefined || d.status === "draft" || d.status === "completed"'));
  assert.ok(source.includes('discount_amount') && source.includes('positiveQty(item?.qty_kg)'));
  assert.ok(source.includes('!Number.isInteger(material_id)') && source.includes('qty_kg === null') && source.includes('discount_amount === null'));
});

test("order creation stays transactional and writes stock movements", async () => {
  const source = await readServerSource();

  assert.match(source, /BEGIN/);
  assert.match(source, /COMMIT/);
  assert.match(source, /ROLLBACK/);
  assert.match(source, /SELECT\s+\*\s+FROM\s+customers\s+WHERE\s+id=\$1\s+FOR\s+UPDATE/);
  assert.match(
    source,
    /SELECT\s+m\.\*.*p\.price_per_kg.*FROM\s+materials\s+m.*JOIN\s+prices\s+p\s+ON\s+p\.material_id=m\.id\s+AND\s+p\.is_current=true.*WHERE\s+m\.id=\$1.*FOR\s+UPDATE/s,
  );
  assert.match(source, /INSERT\s+INTO\s+purchase_items\(order_id,material_id,material_name_snapshot,qty_kg,unit_price,line_amount\)/);
  assert.ok(source.includes('discount_amount') && source.includes('line_discount_amount'));
  assert.match(source, /UPDATE\s+inventory\s+SET\s+qty_kg=qty_kg\+\$1,\s*updated_at=now\(\)\s+WHERE\s+material_id=\$2/);
  assert.match(source, /INSERT\s+INTO\s+inventory_movements\(material_id,type,qty_kg,ref_type,ref_id,created_by\)\s+VALUES\(\$1,'in',\$2,'purchase_order',\$3,\$4\)/);
});

test("report endpoints keep completed-order scope", async () => {
  const source = compact(await readServerSource());

  assert.ok(source.includes('route === "/api/reports/summary" && req.method === "GET"'));
  assert.ok(source.includes('route === "/api/reports/profit" && req.method === "GET"'));
  assert.match(source, /WHERE\s+(?:status='completed'|o\.status='completed')/);
  assert.match(source, /FROM\s+purchase_items\s+i\s+JOIN\s+purchase_orders\s+o\s+ON\s+o\.id=i\.order_id\s+WHERE\s+o\.status='completed'/);
  assert.match(source, /FROM\s+purchase_orders\s+o\s+WHERE\s+o\.status='completed'/);
  assert.match(source, /FROM\s+sales_orders\s+so\s+WHERE\s+so\.sold_at\s+BETWEEN\s+\$1::timestamptz\s+AND\s+\$2::timestamptz/);
  assert.match(source, /GROUP\s+BY\s+material_id,\s*material_name_snapshot\s+ORDER\s+BY\s+qty_kg\s+DESC\s+LIMIT\s+1/);
  assert.ok(source.includes('route === "/api/customer/reports" && req.method === "GET"'));
  assert.match(source, /o\.status='completed'/);
});
