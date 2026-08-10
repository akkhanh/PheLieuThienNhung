import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createPool, createSessionForEmail, ensureBackendStarted, requestJson } from "./reports-realdb.helper.mjs";

let backend;
let pool;
let admin;
const cleanup = [];

function uniqueSuffix() {
  return `${Date.now()}_${randomUUID().slice(0, 8)}`;
}

async function dbOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

async function rememberSql(sql, params = []) {
  cleanup.push([sql, params]);
}

test.before(async () => {
  backend = await ensureBackendStarted();
  pool = await createPool();
  admin = await createSessionForEmail("admin@thiennhung.local");
});

test.after(async () => {
  while (cleanup.length) {
    const [sql, params] = cleanup.pop();
    try {
      await pool.query(sql, params);
    } catch {}
  }
  await pool?.end();
  backend?.process?.kill();
});

test("guest customer order keeps price, inventory, and invoice snapshots stable", async () => {
  const suffix = uniqueSuffix();
  const phone = `091${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`.slice(0, 10);
  const customerName = `Guest ${suffix}`;
  const customerAddress = `Ward ${suffix}`;

  const material = await dbOne(
    `SELECT m.id, m.name, p.id AS price_id, p.price_per_kg, COALESCE(i.qty_kg, 0)::float qty_kg
     FROM materials m
     JOIN prices p ON p.material_id = m.id AND p.is_current = true
     LEFT JOIN inventory i ON i.material_id = m.id
     WHERE m.active = true
     ORDER BY m.id
     LIMIT 1`,
  );
  assert.ok(material, "expected at least one active material");
  material.id = Number(material.id);
  material.price_id = Number(material.price_id);

  const createCustomer = await requestJson("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: { name: customerName, phone, address: customerAddress, user_id: null },
  });
  assert.equal(createCustomer.res.status, 201);
  const customer = createCustomer.json;
  customer.id = Number(customer.id);
  assert.equal(customer.name, customerName);
  assert.equal(customer.phone, phone);

  const qty = 2.75;
  const orderCreate = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_id: customer.id,
      status: "draft",
      note: `guest-order-${suffix}`,
      items: [{ material_id: material.id, qty_kg: qty }],
    },
  });
  assert.equal(orderCreate.res.status, 201);
  const order = orderCreate.json;
  order.id = Number(order.id);
  assert.ok(order.id);
  assert.ok(order.code);
  assert.equal(order.status, "draft");

  const oldPrice = Number(material.price_per_kg);
  const newPrice = oldPrice + 137;
  const priceResp = await requestJson("/api/prices", {
    cookie: admin.cookie,
    method: "POST",
    body: { material_id: material.id, price_per_kg: newPrice, note: `override-${suffix}` },
  });
  assert.equal(priceResp.res.status, 201);
  const newPriceRow = priceResp.json;
  newPriceRow.id = Number(newPriceRow.id);
  assert.ok(newPriceRow.id);

  await rememberSql("DELETE FROM prices WHERE id=$1", [newPriceRow.id]);
  await rememberSql("UPDATE prices SET is_current = true, effective_to = NULL WHERE id=$1", [material.price_id]);

  const inventoryBefore = await dbOne("SELECT qty_kg::float qty_kg FROM inventory WHERE material_id=$1", [material.id]);

  const patchResp = await requestJson(`/api/orders/${order.id}`, {
    cookie: admin.cookie,
    method: "PATCH",
    body: {
      status: "completed",
      customer_id: customer.id,
      note: `final-${suffix}`,
      items: [{ material_id: material.id, qty_kg: qty }],
    },
  });
  assert.equal(patchResp.res.status, 200);
  const updated = patchResp.json;

  assert.equal(updated.status, "completed");
  assert.equal(Number(updated.customer_id), Number(customer.id));
  assert.equal(updated.customer_name_snapshot, customerName);
  assert.equal(updated.customer_phone_snapshot, phone);
  assert.equal(updated.items[0].material_name, material.name);
  assert.equal(updated.items[0].unit_price, newPrice);
  assert.equal(updated.items[0].line_amount, Math.round(qty * newPrice));
  assert.equal(updated.total_amount, Math.round(qty * newPrice));

  await rememberSql("UPDATE inventory SET qty_kg = qty_kg - $1, updated_at = now() WHERE material_id = $2", [qty, material.id]);
  await rememberSql("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1", [order.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id=$1", [order.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [customer.id]);

  const inventoryAfter = await dbOne("SELECT qty_kg::float qty_kg FROM inventory WHERE material_id=$1", [material.id]);
  assert.equal(Number(inventoryAfter.qty_kg), Number(inventoryBefore.qty_kg) + qty);

  const invoice = await requestJson(`/api/invoices/${updated.code}`, { cookie: admin.cookie });
  assert.equal(invoice.res.status, 200);
  assert.equal(invoice.json.invoice_code, updated.code);
  assert.equal(invoice.json.customer_name, customerName);
  assert.equal(invoice.json.customer_phone, phone);
  assert.equal(invoice.json.items[0].material_name, material.name);
  assert.equal(invoice.json.items[0].unit_price, newPrice);
  assert.equal(invoice.json.items[0].line_amount, Math.round(qty * newPrice));

  const movement = await dbOne(
    "SELECT type, qty_kg::float qty_kg, ref_type, ref_id FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1 ORDER BY id DESC LIMIT 1",
    [order.id],
  );
  assert.equal(movement.type, "in");
  assert.equal(Number(movement.qty_kg), qty);
  assert.equal(Number(movement.ref_id), order.id);
});
