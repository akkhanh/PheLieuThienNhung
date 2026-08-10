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

test("guest order reuses customer by phone instead of creating duplicates", async () => {
  const suffix = uniqueSuffix();
  const phone = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`.slice(0, 10);
  const name = `Guest ${suffix}`;

  const material = await dbOne(
    `SELECT m.id
     FROM materials m
     WHERE m.active = true
     ORDER BY m.id
     LIMIT 1`,
  );
  assert.ok(material, "expected at least one active material");
  material.id = Number(material.id);

  const first = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_name: name,
      customer_phone: phone,
      note: `guest-merge-1-${suffix}`,
      items: [{ material_id: material.id, qty_kg: 1 }],
    },
  });
  assert.equal(first.res.status, 201);
  assert.ok(first.json.customer_id);

  const second = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_name: `${name} Updated`,
      customer_phone: phone,
      note: `guest-merge-2-${suffix}`,
      items: [{ material_id: material.id, qty_kg: 1 }],
    },
  });
  assert.equal(second.res.status, 201);
  assert.ok(second.json.customer_id);
  assert.equal(Number(second.json.customer_id), Number(first.json.customer_id));

  const customerRows = await pool.query("SELECT id, name, phone FROM customers WHERE phone=$1 ORDER BY id ASC", [phone]);
  assert.equal(customerRows.rowCount, 1);
  assert.equal(Number(customerRows.rows[0].id), Number(first.json.customer_id));
  assert.equal(customerRows.rows[0].phone, phone);

  await rememberSql("DELETE FROM purchase_items WHERE order_id IN ($1, $2)", [first.json.id, second.json.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id IN ($1, $2)", [first.json.id, second.json.id]);
  await rememberSql("DELETE FROM customers WHERE phone = $1", [phone]);
});
