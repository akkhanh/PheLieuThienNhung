import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { baseUrl, createPool, createSessionForEmail, ensureBackendStarted, requestJson } from "../reports-realdb.helper.mjs";

let backend;
let pool;
let admin;
const cleanup = [];

function unique(tag) {
  return `${tag}_${Date.now()}_${randomUUID().slice(0, 6)}`;
}

async function remember(sql, params = []) {
  cleanup.push([sql, params]);
}

async function one(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

async function registerCustomer({ name, email, password, phone, address }) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ name, email, password, phone, address }),
  });
  const json = await res.json();
  return { res, json };
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

test("admin/customer access, ownership, csrf and input validation stay enforced", async () => {
  const a = {
    name: unique("Customer A"),
    email: `${unique("customera")}@local.test`,
    password: "Password@123",
    phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    address: "HCM",
  };
  const b = {
    name: unique("Customer B"),
    email: `${unique("customerb")}@local.test`,
    password: "Password@123",
    phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    address: "HCM",
  };

  const regA = await registerCustomer(a);
  const regB = await registerCustomer(b);
  assert.equal(regA.res.status, 201);
  assert.equal(regB.res.status, 201);

  await remember("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1 OR email = $2)", [a.email, b.email]);
  await remember("DELETE FROM customers WHERE phone = $1 OR phone = $2", [a.phone, b.phone]);
  await remember("DELETE FROM users WHERE email = $1 OR email = $2", [a.email, b.email]);

  const customerUserA = await one("SELECT id FROM users WHERE email=$1", [a.email]);
  const customerUserB = await one("SELECT id FROM users WHERE email=$1", [b.email]);
  const customerA = await one("SELECT id FROM customers WHERE phone=$1", [a.phone]);
  const customerB = await one("SELECT id FROM customers WHERE phone=$1", [b.phone]);
  assert.ok(customerUserA && customerUserB && customerA && customerB);

  const loginA = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email: a.email, password: a.password }),
  });
  const loginB = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email: b.email, password: b.password }),
  });
  assert.equal(loginA.status, 200);
  assert.equal(loginB.status, 200);
  const cookieA = loginA.headers.get("set-cookie")?.match(/session=([^;]+).*csrf=([^;]+)/s);
  const cookieB = loginB.headers.get("set-cookie")?.match(/session=([^;]+).*csrf=([^;]+)/s);
  assert.ok(cookieA && cookieB);
  const customerCookieA = `session=${cookieA[1]}; csrf=${cookieA[2]}`;
  const customerCookieB = `session=${cookieB[1]}; csrf=${cookieB[2]}`;

  const adminCustomers = await requestJson("/api/customers", { cookie: admin.cookie });
  assert.equal(adminCustomers.res.status, 200);

  const customerBlocked = await requestJson("/api/customers", { cookie: customerCookieA });
  assert.equal(customerBlocked.res.status, 403);

  const invalidCustomer = await requestJson("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: { name: "", phone: "" },
  });
  assert.equal(invalidCustomer.res.status, 422);

  const csrfBlocked = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      cookie: admin.cookie,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ name: unique("NoCsrf"), phone: "0912340000" }),
  });
  assert.equal(csrfBlocked.status, 403);

  const crossOriginBlocked = await fetch(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: {
      cookie: admin.cookie,
      "content-type": "application/json",
      "x-csrf-token": admin.cookie.match(/csrf=([^;]+)/)?.[1] || "",
      origin: "http://evil.local",
    },
    body: JSON.stringify({ name: unique("BadOrigin"), phone: "0912349999" }),
  });
  assert.equal(crossOriginBlocked.status, 403);

  const orderResp = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_id: Number(customerA.id),
      status: "completed",
      note: unique("security-order"),
      items: [{ material_id: 1, qty_kg: 1, price_per_kg: 8200 }],
    },
  });
  assert.equal(orderResp.res.status, 201);
  const orderCode = orderResp.json.code;
  const orderId = Number(orderResp.json.id);
  assert.ok(orderCode && orderId);

  await remember("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1", [orderId]);
  await remember("DELETE FROM purchase_items WHERE order_id=$1", [orderId]);
  await remember("DELETE FROM purchase_orders WHERE id=$1", [orderId]);
  await remember("UPDATE inventory SET qty_kg = qty_kg - 1, updated_at = now() WHERE material_id = 1", []);

  const ownInvoice = await requestJson(`/api/invoices/${orderCode}`, { cookie: customerCookieA });
  assert.equal(ownInvoice.res.status, 200);

  const foreignInvoice = await requestJson(`/api/invoices/${orderCode}`, { cookie: customerCookieB });
  assert.equal(foreignInvoice.res.status, 404);

  const customerReportBlocked = await requestJson("/api/reports/summary", { cookie: customerCookieA });
  assert.equal(customerReportBlocked.res.status, 403);

  const customerOwnOrders = await requestJson("/api/customer/orders", { cookie: customerCookieA });
  assert.equal(customerOwnOrders.res.status, 200);
  assert.ok(Array.isArray(customerOwnOrders.json));
  assert.ok(customerOwnOrders.json.some((item) => item.code === orderCode));

  const customerOtherOrders = await requestJson("/api/customer/orders", { cookie: customerCookieB });
  assert.equal(customerOtherOrders.res.status, 200);
  assert.ok(Array.isArray(customerOtherOrders.json));
  assert.ok(customerOtherOrders.json.every((item) => item.code !== orderCode));
});
