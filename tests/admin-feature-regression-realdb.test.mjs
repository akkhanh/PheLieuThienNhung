import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createPool, createSessionForEmail, ensureBackendStarted, login, requestJson } from "./reports-realdb.helper.mjs";

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

async function registerCustomerAccount(label) {
  const suffix = uniqueSuffix();
  const phone = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`.slice(0, 10);
  const email = `${label}.${suffix}@example.com`.toLowerCase();
  const name = `${label} ${suffix}`;
  const password = "12345678";

  const registerResp = await requestJson("/api/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password,
      phone,
      address: `Address ${suffix}`,
    },
  });
  assert.equal(registerResp.res.status, 201);

  const user = await dbOne("SELECT id, email FROM users WHERE email=$1", [email]);
  const customer = await dbOne("SELECT id, user_id, name, phone FROM customers WHERE phone=$1", [phone]);
  assert.ok(user, "registered user should exist");
  assert.ok(customer, "registered customer should exist");

  await rememberSql("DELETE FROM sessions WHERE user_id=$1", [user.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [customer.id]);
  await rememberSql("DELETE FROM users WHERE id=$1", [user.id]);

  const session = await createSessionForEmail(email);
  return { email, phone, name, password, session, user, customer };
}

async function createCompletedGuestOrder({ qty = 2.5, customPrice } = {}) {
  const suffix = uniqueSuffix();
  const material = await dbOne(
    `SELECT m.id, m.name, p.price_per_kg, COALESCE(i.qty_kg,0)::float qty_kg
     FROM materials m
     JOIN prices p ON p.material_id=m.id AND p.is_current=true
     LEFT JOIN inventory i ON i.material_id=m.id
     WHERE m.active=true
     ORDER BY m.id
     LIMIT 1`,
  );
  assert.ok(material, "expected one active material");

  const orderResp = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_name: `Guest ${suffix}`,
      customer_phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`.slice(0, 10),
      status: "completed",
      note: `guest-${suffix}`,
      items: [
        {
          material_id: Number(material.id),
          qty_kg: qty,
          ...(customPrice === undefined ? {} : { price_per_kg: customPrice }),
        },
      ],
    },
  });
  assert.equal(orderResp.res.status, 201);
  const order = orderResp.json;

  await rememberSql("UPDATE inventory SET qty_kg=qty_kg-$1, updated_at=now() WHERE material_id=$2", [qty, material.id]);
  await rememberSql("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1", [order.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id=$1", [order.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [order.customer_id]);

  return { order, material };
}

async function createDraftGuestOrder({ qty = 2.5, customPrice, discountAmount = 0 } = {}) {
  const suffix = uniqueSuffix();
  const material = await dbOne(
    `SELECT m.id, m.name, p.price_per_kg, COALESCE(i.qty_kg,0)::float qty_kg
     FROM materials m
     JOIN prices p ON p.material_id=m.id AND p.is_current=true
     LEFT JOIN inventory i ON i.material_id=m.id
     WHERE m.active=true
     ORDER BY m.id
     LIMIT 1`,
  );
  assert.ok(material, "expected one active material");

  const orderResp = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_name: `Guest ${suffix}`,
      customer_phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`.slice(0, 10),
      status: "draft",
      note: `guest-${suffix}`,
      items: [
        {
          material_id: Number(material.id),
          qty_kg: qty,
          ...(customPrice === undefined ? {} : { price_per_kg: customPrice }),
          ...(discountAmount === 0 ? {} : { discount_amount: discountAmount }),
        },
      ],
    },
  });
  assert.equal(orderResp.res.status, 201);
  const order = orderResp.json;

  await rememberSql("DELETE FROM purchase_items WHERE order_id=$1", [order.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id=$1", [order.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [order.customer_id]);

  return { order, material };
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

test("inventory detail exposes source movements with order, customer, date, and price information", async () => {
  const { order, material } = await createCompletedGuestOrder({ qty: 1.75 });

  const detailResp = await requestJson(`/api/inventory/${material.id}`, {
    cookie: admin.cookie,
  });

  assert.equal(detailResp.res.status, 200);
  assert.equal(Number(detailResp.json.id), Number(material.id));
  assert.ok(Array.isArray(detailResp.json.movements));
  assert.ok(detailResp.json.movements.length > 0);

  const linkedMovement = detailResp.json.movements.find((movement) => Number(movement.ref_id) === Number(order.id));
  assert.ok(linkedMovement, "expected movement linked to the created order");
  assert.equal(linkedMovement.ref_type, "purchase_order");
  assert.equal(linkedMovement.order_code, order.code);
  assert.ok(linkedMovement.customer_name);
  assert.ok(linkedMovement.customer_phone);
  assert.ok(linkedMovement.created_at);
  assert.equal(typeof linkedMovement.unit_price, "number");
  assert.equal(typeof linkedMovement.line_amount, "number");
});

test("public material visibility can be updated and public endpoints only return visible materials", async () => {
  const material = await dbOne(
    `SELECT m.id, m.code, m.name, m.is_public
     FROM materials m
     JOIN prices p ON p.material_id=m.id AND p.is_current=true
     WHERE m.active=true
     ORDER BY m.id
     LIMIT 1`,
  );
  assert.ok(material, "expected one active public-priced material");
  await rememberSql("UPDATE materials SET is_public=$1 WHERE id=$2", [material.is_public, material.id]);

  const updateResp = await requestJson(`/api/materials/${material.id}`, {
    cookie: admin.cookie,
    method: "PATCH",
    body: {
      is_public: false,
    },
  });

  assert.equal(updateResp.res.status, 200);
  assert.equal(updateResp.json.is_public, false);

  const publicPrices = await requestJson("/api/prices");
  assert.equal(publicPrices.res.status, 200);
  assert.ok(!publicPrices.json.some((row) => Number(row.id) === Number(material.id)));

  const publicMaterials = await requestJson("/api/materials");
  assert.equal(publicMaterials.res.status, 200);
  assert.ok(!publicMaterials.json.some((row) => Number(row.id) === Number(material.id)));
});

test("customer order history and order detail stay scoped to the signed-in customer", async () => {
  const owner = await registerCustomerAccount("history-owner");
  const stranger = await registerCustomerAccount("history-stranger");

  const material = await dbOne(
    `SELECT m.id, p.price_per_kg
     FROM materials m
     JOIN prices p ON p.material_id=m.id AND p.is_current=true
     WHERE m.active=true
     ORDER BY m.id
     LIMIT 1`,
  );
  assert.ok(material, "expected one active material");

  const createOrder = await requestJson("/api/orders", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customer_id: Number(owner.customer.id),
      status: "completed",
      note: "history-order",
      items: [{ material_id: Number(material.id), qty_kg: 3 }],
    },
  });
  assert.equal(createOrder.res.status, 201);
  const order = createOrder.json;

  await rememberSql("UPDATE inventory SET qty_kg=qty_kg-$1, updated_at=now() WHERE material_id=$2", [3, material.id]);
  await rememberSql("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1", [order.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id=$1", [order.id]);

  const ownerHistory = await requestJson("/api/customer/orders", {
    cookie: owner.session.cookie,
  });
  assert.equal(ownerHistory.res.status, 200);
  assert.ok(ownerHistory.json.some((row) => row.code === order.code));

  const ownerDetail = await requestJson(`/api/customer/orders/${order.code}`, {
    cookie: owner.session.cookie,
  });
  assert.equal(ownerDetail.res.status, 200);
  assert.equal(ownerDetail.json.code, order.code);
  assert.ok(Array.isArray(ownerDetail.json.items));
  assert.ok(ownerDetail.json.items.length > 0);

  const strangerDetail = await requestJson(`/api/customer/orders/${order.code}`, {
    cookie: stranger.session.cookie,
  });
  assert.equal(strangerDetail.res.status, 404);
});

test("admin order detail returns full invoice information for a completed order", async () => {
  const { order, material } = await createCompletedGuestOrder({ qty: 4, customPrice: 9876 });

  const invoiceResp = await requestJson(`/api/invoices/${order.code}`, {
    cookie: admin.cookie,
  });

  assert.equal(invoiceResp.res.status, 200);
  assert.equal(invoiceResp.json.invoice_code, order.code);
  assert.equal(invoiceResp.json.status, "completed");
  assert.ok(invoiceResp.json.customer_name);
  assert.ok(invoiceResp.json.customer_phone);
  assert.ok(invoiceResp.json.customer_address !== undefined);
  assert.ok(Array.isArray(invoiceResp.json.items));
  assert.equal(invoiceResp.json.items[0].material_name, material.name);
  assert.equal(invoiceResp.json.items[0].unit_price, 9876);
  assert.equal(invoiceResp.json.items[0].line_amount, Math.round(4 * 9876));
});

test("completed orders are read-only for both update and delete flows", async () => {
  const { order, material } = await createCompletedGuestOrder({ qty: 2, customPrice: 7654 });

  const patchResp = await requestJson(`/api/orders/${order.id}`, {
    cookie: admin.cookie,
    method: "PATCH",
    body: {
      note: "should-not-update-completed-order",
      items: [{ material_id: Number(material.id), qty_kg: 5, price_per_kg: 7000 }],
      status: "completed",
    },
  });
  assert.equal(patchResp.res.status, 409);

  const deleteResp = await requestJson(`/api/orders/${order.id}`, {
    cookie: admin.cookie,
    method: "DELETE",
  });
  assert.equal(deleteResp.res.status, 409);
});

test("guest customer flow keeps custom item price on create, invoice snapshot, and inventory movement", async () => {
  const qty = 1.25;
  const customPrice = 5432;
  const { order, material } = await createCompletedGuestOrder({ qty, customPrice });

  assert.equal(order.status, "completed");
  assert.equal(order.items[0].unit_price, customPrice);
  assert.equal(order.items[0].line_amount, Math.round(qty * customPrice));
  assert.equal(order.total_amount, Math.round(qty * customPrice));

  const invoiceResp = await requestJson(`/api/invoices/${order.code}`, {
    cookie: admin.cookie,
  });
  assert.equal(invoiceResp.res.status, 200);
  assert.equal(invoiceResp.json.items[0].unit_price, customPrice);
  assert.equal(invoiceResp.json.items[0].material_name, material.name);

  const movement = await dbOne(
    `SELECT qty_kg::float qty_kg, ref_type, ref_id
     FROM inventory_movements
     WHERE ref_type='purchase_order' AND ref_id=$1
     ORDER BY id DESC
     LIMIT 1`,
    [order.id],
  );
  assert.ok(movement, "expected inventory movement for created order");
  assert.equal(movement.ref_type, "purchase_order");
  assert.equal(Number(movement.ref_id), Number(order.id));
  assert.equal(Number(movement.qty_kg), qty);

  const createdCustomer = await dbOne("SELECT id, name, phone FROM customers WHERE id=$1", [order.customer_id]);
  assert.ok(createdCustomer, "guest order should create or resolve a customer");
});

test("draft order update keeps line discounts and price overrides intact", async () => {
  const qty = 3;
  const customPrice = 8765;
  const discountAmount = 2345;
  const { order, material } = await createDraftGuestOrder({ qty, customPrice });

  const patchResp = await requestJson(`/api/orders/${order.id}`, {
    cookie: admin.cookie,
    method: "PATCH",
    body: {
      status: "completed",
      items: [
        {
          material_id: Number(material.id),
          qty_kg: qty,
          price_per_kg: customPrice,
          discount_amount: discountAmount,
        },
      ],
    },
  });

  assert.equal(patchResp.res.status, 200);
  assert.equal(patchResp.json.status, "completed");
  assert.equal(patchResp.json.items[0].unit_price, customPrice);
  assert.equal(patchResp.json.items[0].line_amount, Math.max(0, Math.round(qty * customPrice) - discountAmount));
  assert.equal(patchResp.json.total_amount, Math.max(0, Math.round(qty * customPrice) - discountAmount));
  if ("discount_amount" in patchResp.json.items[0]) {
    assert.equal(patchResp.json.items[0].discount_amount, discountAmount);
  }

  const invoiceResp = await requestJson(`/api/invoices/${patchResp.json.code}`, {
    cookie: admin.cookie,
  });
  assert.equal(invoiceResp.res.status, 200);
  assert.equal(invoiceResp.json.items[0].unit_price, customPrice);
  if ("discount_amount" in invoiceResp.json.items[0]) {
    assert.equal(invoiceResp.json.items[0].discount_amount, discountAmount);
  }

  await rememberSql("UPDATE inventory SET qty_kg=qty_kg-$1, updated_at=now() WHERE material_id=$2", [qty, material.id]);
  await rememberSql("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1", [order.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id=$1", [order.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [patchResp.json.customer_id]);
});

test("customer discount reduces the stored order total without losing line snapshots", async () => {
  const qty = 4;
  const discountAmount = 2500;
  const customerDiscountAmount = 1800;
  const { order, material } = await createDraftGuestOrder({ qty });

  const patchResp = await requestJson(`/api/orders/${order.id}`, {
    cookie: admin.cookie,
    method: "PATCH",
    body: {
      status: "completed",
      customer_discount_amount: customerDiscountAmount,
      items: [
        {
          material_id: Number(material.id),
          qty_kg: qty,
          discount_amount: discountAmount,
        },
      ],
    },
  });

  assert.equal(patchResp.res.status, 200);
  assert.equal(patchResp.json.status, "completed");
  assert.equal(patchResp.json.items[0].discount_amount, discountAmount);
  assert.equal(patchResp.json.items[0].unit_price, Number(material.price_per_kg));
  assert.equal(
    patchResp.json.items[0].line_amount,
    Math.max(0, Math.round(qty * Number(material.price_per_kg)) - discountAmount),
  );
  assert.equal(
    patchResp.json.total_amount,
    Math.max(0, Math.round(qty * Number(material.price_per_kg)) - discountAmount - customerDiscountAmount),
  );

  const orderColumns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_orders'",
  );
  const hasCustomerDiscountAmount = orderColumns.rows.some((row) => row.column_name === "customer_discount_amount");
  const hasCustomerDiscountPercent = orderColumns.rows.some((row) => row.column_name === "customer_discount_percent");
  const orderSelect = [
    "total_amount",
    ...(hasCustomerDiscountAmount ? ["customer_discount_amount"] : []),
    ...(hasCustomerDiscountPercent ? ["customer_discount_percent"] : []),
  ].join(", ");
  const orderRow = await dbOne(`SELECT ${orderSelect} FROM purchase_orders WHERE id=$1`, [order.id]);
  assert.ok(orderRow);
  assert.equal(Number(orderRow.total_amount), patchResp.json.total_amount);
  if (hasCustomerDiscountAmount) {
    assert.equal(Number(orderRow.customer_discount_amount ?? 0), customerDiscountAmount);
  }

  await rememberSql("UPDATE inventory SET qty_kg=qty_kg-$1, updated_at=now() WHERE material_id=$2", [qty, material.id]);
  await rememberSql("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id=$1", [order.id]);
  await rememberSql("DELETE FROM purchase_orders WHERE id=$1", [order.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [patchResp.json.customer_id]);
});

test("admin can create or link a customer login account without duplicating schema data", async () => {
  const suffix = uniqueSuffix();
  const phone = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`.slice(0, 10);
  const createCustomerResp = await requestJson("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      name: `Convert ${suffix}`,
      phone,
      address: `Account Address ${suffix}`,
      note: "convert-guest",
    },
  });
  assert.equal(createCustomerResp.res.status, 201);
  const customer = createCustomerResp.json;
  assert.ok(customer.id);
  assert.equal(customer.user_id ?? null, null);

  const accountResp = await requestJson(`/api/customers/${customer.id}/account`, {
    cookie: admin.cookie,
    method: "POST",
    body: {},
  });

  assert.equal(accountResp.res.status, 201);
  assert.ok(accountResp.json.created);
  assert.ok(accountResp.json.linked);
  assert.ok(accountResp.json.user?.email);
  assert.ok(accountResp.json.temp_password);

  const linkedCustomer = await dbOne("SELECT id, user_id, name, phone FROM customers WHERE id=$1", [customer.id]);
  assert.equal(Number(linkedCustomer.user_id), Number(accountResp.json.user.id));

  const duplicateAccountResp = await requestJson(`/api/customers/${customer.id}/account`, {
    cookie: admin.cookie,
    method: "POST",
    body: {},
  });

  assert.equal(duplicateAccountResp.res.status, 200);
  assert.equal(Number(duplicateAccountResp.json.user.id), Number(accountResp.json.user.id));

  const loginResp = await login("linked-customer", accountResp.json.user.email, accountResp.json.temp_password);
  assert.equal(loginResp.user.role, "customer");
  const meResp = await requestJson("/api/auth/me", {
    cookie: loginResp.cookie,
  });
  assert.equal(meResp.res.status, 200);
  assert.equal(meResp.json.user.email, accountResp.json.user.email);

  await rememberSql("DELETE FROM sessions WHERE user_id=$1", [accountResp.json.user.id]);
  await rememberSql("DELETE FROM customers WHERE id=$1", [customer.id]);
  await rememberSql("DELETE FROM users WHERE id=$1", [accountResp.json.user.id]);
});
