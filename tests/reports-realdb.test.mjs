import assert from "node:assert/strict";
import test from "node:test";
import { createPool, createSessionForEmail, ensureBackendStarted, requestJson } from "./reports-realdb.helper.mjs";

let backend;
let pool;

async function dbOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

test.before(async () => {
  backend = await ensureBackendStarted();
  pool = await createPool();
});

test.after(async () => {
  await pool?.end();
  backend?.process?.kill();
});

test("admin summary and dashboard match the real DB and expose the expected JSON shape", async () => {
  const admin = await createSessionForEmail("admin@thiennhung.local");
  const summaryResp = await requestJson("/api/reports/summary", { cookie: admin.cookie });
  const dashboardResp = await requestJson("/api/reports/dashboard", { cookie: admin.cookie });

  assert.equal(summaryResp.res.status, 200);
  assert.equal(dashboardResp.res.status, 200);

  const summary = summaryResp.json;
  const dashboard = dashboardResp.json;

  for (const payload of [summary, dashboard]) {
    assert.ok(payload && typeof payload === "object");
    assert.equal(typeof payload.orders, "number");
    assert.equal(typeof payload.total_amount, "number");
    assert.equal(typeof payload.revenue, "number");
    assert.equal(typeof payload.completed_orders, "number");
    assert.equal(typeof payload.draft_orders, "number");
    assert.equal(typeof payload.cancelled_orders, "number");
    assert.ok(payload.inventory && typeof payload.inventory === "object");
    assert.ok(Array.isArray(payload.orders_by_day));
    assert.ok(Array.isArray(payload.orders_by_month));
    assert.ok(Array.isArray(payload.revenue_by_month));
  }

  const expectedSummary = await dbOne(`
    SELECT
      COUNT(*)::int orders,
      COALESCE(SUM(total_amount), 0)::int total_amount,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int revenue,
      COUNT(*) FILTER (WHERE status = 'completed')::int completed_orders,
      COUNT(*) FILTER (WHERE status = 'draft')::int draft_orders,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int cancelled_orders
    FROM purchase_orders
  `);

  const expectedCompleted = await dbOne(`
    SELECT COUNT(*)::int orders, COALESCE(SUM(total_amount), 0)::int total_amount
    FROM purchase_orders
    WHERE status = 'completed'
  `);

  const expectedKg = await dbOne(`
    SELECT COALESCE(SUM(i.qty_kg),0)::float total_kg
    FROM purchase_items i
    JOIN purchase_orders o ON o.id=i.order_id
    WHERE o.status='completed'
  `);

  const expectedInventory = await dbOne(`
    SELECT
      COALESCE(SUM(qty_kg),0)::float total_kg,
      COUNT(*)::int materials,
      COUNT(*) FILTER (WHERE qty_kg <= warning_kg)::int low_stock
    FROM inventory
  `);

  const expectedCustomers = await dbOne(`
    SELECT COUNT(*)::int customers FROM users WHERE role='customer' AND active=true
  `);

  const expectedInventoryValue = await dbOne(`
    SELECT COALESCE(SUM(i.qty_kg * COALESCE(p.price_per_kg,0)),0)::int inventory_value
    FROM inventory i
    JOIN materials m ON m.id=i.material_id
    LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
    WHERE m.active=true
  `);

  const expectedTop = await dbOne(`
    SELECT material_name_snapshot name, SUM(qty_kg)::float qty_kg
    FROM purchase_items i
    JOIN purchase_orders o ON o.id=i.order_id
    WHERE o.status='completed'
    GROUP BY material_id, material_name_snapshot
    ORDER BY qty_kg DESC
    LIMIT 1
  `);

  assert.deepEqual(summary, {
    ...expectedSummary,
    completed_orders_total: expectedCompleted.orders,
    completed_total_amount: expectedCompleted.total_amount,
    ...expectedKg,
    inventory: expectedInventory,
    inventory_value: expectedInventoryValue.inventory_value,
    customers: expectedCustomers,
    cost: expectedInventoryValue.inventory_value,
    top_material: expectedTop,
    orders_by_day: dashboard.orders_by_day,
    orders_by_month: dashboard.orders_by_month,
    revenue_by_month: dashboard.revenue_by_month,
  });
  assert.deepEqual(dashboard, summary);
});

test("customer reports stay scoped to the logged-in customer and only count completed orders", async () => {
  const customer = await createSessionForEmail("customer@thiennhung.local");
  const reportResp = await requestJson("/api/customer/reports", { cookie: customer.cookie });

  assert.equal(reportResp.res.status, 200);
  const report = reportResp.json;
  assert.ok(report && typeof report === "object");
  assert.equal(typeof report.orders, "number");
  assert.equal(typeof report.total_amount, "number");
  assert.equal(typeof report.total_kg, "number");
  assert.ok(Array.isArray(report.by_day));
  assert.ok(Array.isArray(report.by_month));
  assert.ok("top_material" in report);

  const expected = await dbOne(`
    SELECT COUNT(*)::int orders, COALESCE(SUM(total_amount),0)::int total_amount, MAX(completed_at) last_order_at
    FROM purchase_orders o
    JOIN customers c ON c.id=o.customer_id
    WHERE c.user_id=$1 AND o.status='completed'
  `, [customer.user.id]);

  const expectedKg = await dbOne(`
    SELECT COALESCE(SUM(i.qty_kg),0)::float total_kg
    FROM purchase_orders o
    JOIN customers c ON c.id=o.customer_id
    JOIN purchase_items i ON i.order_id=o.id
    WHERE c.user_id=$1 AND o.status='completed'
  `, [customer.user.id]);

  const expectedTop = await dbOne(`
    SELECT i.material_name_snapshot name, SUM(i.qty_kg)::float qty_kg
    FROM purchase_items i
    JOIN purchase_orders o ON o.id=i.order_id
    JOIN customers c ON c.id=o.customer_id
    WHERE c.user_id=$1 AND o.status='completed'
    GROUP BY i.material_id, i.material_name_snapshot
    ORDER BY qty_kg DESC
    LIMIT 1
  `, [customer.user.id]);

  assert.deepEqual(report.orders, expected.orders);
  assert.deepEqual(report.total_amount, expected.total_amount);
  assert.deepEqual(report.total_kg, expectedKg.total_kg);
  assert.deepEqual(report.top_material, expectedTop);

  const allOrdersForUser = await dbOne(`
    SELECT COUNT(*)::int total_orders, COUNT(*) FILTER (WHERE status='completed')::int completed_orders
    FROM purchase_orders o
    JOIN customers c ON c.id=o.customer_id
    WHERE c.user_id=$1
  `, [customer.user.id]);

  assert.ok(allOrdersForUser.total_orders >= allOrdersForUser.completed_orders);
  assert.equal(report.orders, allOrdersForUser.completed_orders);
});

test("customer reports do not leak admin-only completed orders into another customer's scope", async () => {
  const customer = await createSessionForEmail("e2e_admin_customer_001@example.com");
  const reportResp = await requestJson("/api/customer/reports", { cookie: customer.cookie });
  assert.equal(reportResp.res.status, 200);
  assert.equal(reportResp.json.orders, 0);
  assert.equal(reportResp.json.total_amount, 0);
  assert.equal(reportResp.json.total_kg, 0);
  assert.equal(reportResp.json.top_material, null);
});

test("profit report only counts completed purchase orders and stays internally consistent", async () => {
  const admin = await createSessionForEmail("admin@thiennhung.local");
  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const to = utcToday.toISOString().slice(0, 10);
  const fromDate = new Date(utcToday);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  const from = fromDate.toISOString().slice(0, 10);

  const reportResp = await requestJson(`/api/reports/profit?from=${from}&to=${to}`, { cookie: admin.cookie });
  assert.equal(reportResp.res.status, 200);

  const report = reportResp.json;
  const expectedRangeFrom = new Date(`${from}T00:00:00`).toISOString().slice(0, 10);
  const expectedRangeTo = new Date(`${to}T23:59:59.999`).toISOString().slice(0, 10);
  assert.ok(report && typeof report === "object");
  assert.equal(report.range.from, expectedRangeFrom);
  assert.equal(report.range.to, expectedRangeTo);
  assert.equal(typeof report.sales_revenue, "number");
  assert.equal(typeof report.purchase_cost, "number");
  assert.equal(typeof report.gross_profit, "number");
  assert.equal(typeof report.purchase_kg, "number");
  assert.equal(typeof report.sales_kg, "number");
  assert.equal(typeof report.inventory_kg, "number");
  assert.equal(typeof report.inventory_value, "number");
  assert.equal(typeof report.purchase_orders, "number");
  assert.equal(typeof report.sales_orders, "number");
  assert.ok(Array.isArray(report.by_day));

  const expectedPurchase = await dbOne(`
    SELECT
      COUNT(DISTINCT o.id)::int purchase_orders,
      COALESCE(SUM(o.total_amount), 0)::int purchase_cost
    FROM purchase_orders o
    WHERE o.status = 'completed'
      AND COALESCE(o.completed_at, o.created_at) BETWEEN $1::timestamptz AND $2::timestamptz
  `, [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]);

  const expectedPurchaseKg = await dbOne(`
    SELECT COALESCE(SUM(i.qty_kg), 0)::float purchase_kg
    FROM purchase_orders o
    JOIN purchase_items i ON i.order_id = o.id
    WHERE o.status = 'completed'
      AND COALESCE(o.completed_at, o.created_at) BETWEEN $1::timestamptz AND $2::timestamptz
  `, [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]);

  const expectedSales = await dbOne(`
    SELECT
      COUNT(*)::int sales_orders,
      COALESCE(SUM(so.total_amount), 0)::int sales_revenue
    FROM sales_orders so
    WHERE so.sold_at BETWEEN $1::timestamptz AND $2::timestamptz
  `, [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]);

  const expectedSalesKg = await dbOne(`
    SELECT COALESCE(SUM(si.qty_kg), 0)::float sales_kg
    FROM sales_orders so
    JOIN sales_items si ON si.sales_order_id = so.id
    WHERE so.sold_at BETWEEN $1::timestamptz AND $2::timestamptz
  `, [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]);

  assert.equal(report.purchase_orders, expectedPurchase.purchase_orders);
  assert.equal(typeof report.purchase_cost, "number");
  assert.equal(report.purchase_kg, expectedPurchaseKg.purchase_kg);
  assert.equal(report.sales_orders, expectedSales.sales_orders);
  assert.equal(report.sales_revenue, expectedSales.sales_revenue);
  assert.equal(report.sales_kg, expectedSalesKg.sales_kg);
  assert.equal(typeof report.gross_profit, "number");
  assert.ok(report.by_day.length > 0);

  const completedOnly = await dbOne(`
    SELECT COUNT(*)::int completed_orders
    FROM purchase_orders
    WHERE status='completed'
      AND COALESCE(completed_at, created_at) BETWEEN $1::timestamptz AND $2::timestamptz
  `, [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]);
  assert.equal(report.purchase_orders, completedOnly.completed_orders);
});
