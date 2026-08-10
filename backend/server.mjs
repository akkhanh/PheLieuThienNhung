import { createServer } from "node:http";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/phe_lieu",
  max: 10,
  idleTimeoutMillis: 30000,
});

const now = () => new Date().toISOString();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const makePassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const verifyPassword = (password, stored) => {
  const [salt, key] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
};

const json = (res, status, data, extra = {}) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-csrf-token",
    "vary": "Origin",
    ...extra,
  });
  res.end(JSON.stringify(data));
};

const fail = (res, status, message, code = "BAD_REQUEST") => json(res, status, { error: { code, message } });
const readBody = async (req) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error("JSON không hợp lệ"), { status: 400 });
  }
};
const missing = (data, fields) => fields.filter((field) => data[field] === undefined || data[field] === null || data[field] === "");
const cookieToken = (req) => req.headers.cookie?.match(/session=([^;]+)/)?.[1];
const csrfTokenFromCookie = (req) => req.headers.cookie?.match(/csrf=([^;]+)/)?.[1];
const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
  .split(",")[0]
  .trim();
const originAllowed = (req) => {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, "");
  return !origin || origin === allowedOrigin;
};
const safeOrigin = (value) => {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};
const sameOriginAllowed = (req) => {
  const allowedOrigin = safeOrigin(process.env.FRONTEND_ORIGIN || "http://localhost:3000");
  const origin = safeOrigin(req.headers.origin);
  const refererOrigin = safeOrigin(req.headers.referer);
  if (!origin && !refererOrigin) return true;
  return origin === allowedOrigin || refererOrigin === allowedOrigin;
};
const readJsonBody = async (req) => {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw Object.assign(new Error("Payload quá lớn"), { status: 413 });
  }
  if (!raw) return {};
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw Object.assign(new Error("Content-Type phải là application/json"), { status: 415 });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("JSON không hợp lệ"), { status: 400 });
  }
};
const assertStateChangeAllowed = (req) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return true;
  if (!sameOriginAllowed(req)) return false;
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/register") return true;
  const csrfCookie = csrfTokenFromCookie(req);
  const csrfHeader = req.headers["x-csrf-token"];
  return Boolean(csrfCookie) && Boolean(csrfHeader) && csrfCookie === csrfHeader;
};
const attempts = new Map();
const tableColumnCache = new Map();
async function getTableColumns(client, table) {
  if (tableColumnCache.has(table)) return tableColumnCache.get(table);
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
    `,
    [table],
  );
  const columns = new Set(rows.map((row) => row.column_name));
  tableColumnCache.set(table, columns);
  return columns;
}
const allowed = (req, key, max = 8, windowMs = 60000) => {
  const id = `${key}:${clientIp(req)}`;
  const t = Date.now();
  const current = attempts.get(id);
  if (!current || t - current.started > windowMs) {
    attempts.set(id, { started: t, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= max;
};

async function currentUser(req,client=pool) {
  const token = cookieToken(req);
  if (!token) return null;
  const { rows } = await client.query(
    "SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
    [sha(token)],
  );
  return rows[0] || null;
}

const audit = (client, userId, action, entity, entityId, meta = {}) =>
  client.query("INSERT INTO audit_logs(user_id,action,entity,entity_id,ip,metadata) VALUES($1,$2,$3,$4,$5,$6)", [
    userId,
    action,
    entity,
    entityId || null,
    meta.ip || "",
    meta,
  ]);

const guard = (res, user, role) => {
  if (!user) {
    fail(res, 401, "Bạn cần đăng nhập", "UNAUTHENTICATED");
    return false;
  }
  if (role && user.role !== role) {
    fail(res, 403, "Bạn không có quyền thực hiện thao tác này", "FORBIDDEN");
    return false;
  }
  return true;
};

const norm = (value) => String(value ?? "").trim();
const normEmail = (value) => norm(value).toLowerCase();
const normPhone = (value) => norm(value).replace(/[^\d+]/g, "");
const capped = (value, max = 255) => norm(value).slice(0, max);
const positiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const positiveQty = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const nonEmpty = (value) => norm(value);
const makeCode = (prefix) => `${prefix}-${Date.now().toString().slice(-8)}-${randomBytes(2).toString("hex")}`.toUpperCase();
const toSqlTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const dmyCode = (value) => {
  const date = new Date(value);
  const dd = `${date.getDate()}`.padStart(2, "0");
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}${mm}${yyyy}`;
};
async function makeSequenceCode(client, table, column, at = new Date(), prefix = "") {
  const prefixDate = dmyCode(at);
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [table, prefixDate]);
  const count = (
    await client.query(
      `SELECT COUNT(*)::int count FROM ${table} WHERE ${column} >= date_trunc('day', $1::timestamptz) AND ${column} < date_trunc('day', $1::timestamptz) + interval '1 day'`,
      [at.toISOString()],
    )
  ).rows[0]?.count ?? 0;
  return `${prefix ? `${prefix}_` : ""}${prefixDate}_${count + 1}`;
}

function parseDateRange(url) {
  const fromRaw = norm(url.searchParams.get("from"));
  const toRaw = norm(url.searchParams.get("to"));
  const today = new Date();
  const defaultTo = new Date(today);
  defaultTo.setHours(23, 59, 59, 999);
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : defaultFrom;
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : defaultTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, message: "Khoảng ngày không hợp lệ" };
  }
  if (from > to) {
    return { ok: false, message: "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc" };
  }
  if (Math.ceil((to.getTime() - from.getTime()) / 86400000) > 366) {
    return { ok: false, message: "Khoảng ngày tối đa là 366 ngày" };
  }
  return {
    ok: true,
    value: {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    },
  };
}

async function buildProfitReport(client, range) {
  const params = [range.fromIso, range.toIso];
  const purchaseSummary = (
    await client.query(
      `
        SELECT
          COUNT(*)::int AS purchase_orders,
          COALESCE(SUM(o.total_amount),0)::int AS purchase_cost
        FROM purchase_orders o
        WHERE o.status='completed'
          AND COALESCE(o.completed_at, o.created_at) BETWEEN $1::timestamptz AND $2::timestamptz
      `,
      params,
    )
  ).rows[0];
  const salesSummary = (
    await client.query(
      `
        SELECT
          COUNT(*)::int AS sales_orders,
          COALESCE(SUM(so.total_amount),0)::int AS sales_revenue
        FROM sales_orders so
        WHERE so.sold_at BETWEEN $1::timestamptz AND $2::timestamptz
      `,
      params,
    )
  ).rows[0];
  // Cost of goods sold is based on the stock actually consumed by sales.
  // Purchases that remain in inventory are assets, not expenses.
  const cogs = await calculateFifoCogs(client, range);
  const quantitySummary = (
    await client.query(
      `
        SELECT
          COALESCE((
            SELECT SUM(pi.qty_kg)::numeric
            FROM purchase_items pi
            JOIN purchase_orders po ON po.id=pi.order_id
            WHERE po.status='completed'
              AND COALESCE(po.completed_at, po.created_at) BETWEEN $1::timestamptz AND $2::timestamptz
          ),0)::float AS purchase_kg,
          COALESCE((
            SELECT SUM(si.qty_kg)::numeric
            FROM sales_items si
            JOIN sales_orders so ON so.id=si.sales_order_id
            WHERE so.sold_at BETWEEN $1::timestamptz AND $2::timestamptz
          ),0)::float AS sales_kg
      `,
      params,
    )
  ).rows[0];
  const inventorySnapshot = (
    await client.query(
      `
        SELECT
          COALESCE(SUM(i.qty_kg),0)::float AS inventory_kg,
          COALESCE(SUM(i.qty_kg * COALESCE(p.price_per_kg,0)),0)::int AS inventory_value
        FROM inventory i
        JOIN materials m ON m.id=i.material_id
        LEFT JOIN prices p ON p.material_id=i.material_id AND p.is_current=true
        WHERE m.active=true
      `,
    )
  ).rows[0];
  const byDay = (
    await client.query(
      `
        WITH days AS (
          SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
        ),
        purchase_day AS (
          SELECT
            date_trunc('day', COALESCE(po.completed_at, po.created_at))::date AS day,
            COUNT(DISTINCT po.id)::int AS purchase_orders,
            COALESCE(SUM(po.total_amount),0)::int AS purchase_cost,
            COALESCE(SUM(pi.qty_kg),0)::float AS purchase_kg
          FROM purchase_orders po
          LEFT JOIN purchase_items pi ON pi.order_id=po.id
          WHERE po.status='completed'
            AND COALESCE(po.completed_at, po.created_at) BETWEEN $1::timestamptz AND $2::timestamptz
          GROUP BY 1
        ),
        sale_day AS (
          SELECT
            date_trunc('day', so.sold_at)::date AS day,
            COUNT(DISTINCT so.id)::int AS sales_orders,
            COALESCE(SUM(so.total_amount),0)::int AS sales_revenue,
            COALESCE(SUM(si.qty_kg),0)::float AS sales_kg
          FROM sales_orders so
          LEFT JOIN sales_items si ON si.sales_order_id=so.id
          WHERE so.sold_at BETWEEN $1::timestamptz AND $2::timestamptz
          GROUP BY 1
        )
        SELECT
          to_char(d.day, 'YYYY-MM-DD') AS day,
          COALESCE(s.sales_revenue,0)::int AS sales_revenue,
          COALESCE(p.purchase_cost,0)::int AS purchase_cost,
          (COALESCE(s.sales_revenue,0) - COALESCE(p.purchase_cost,0))::int AS gross_profit,
          COALESCE(p.purchase_kg,0)::float AS purchase_kg,
          COALESCE(s.sales_kg,0)::float AS sales_kg,
          COALESCE(p.purchase_orders,0)::int AS purchase_orders,
          COALESCE(s.sales_orders,0)::int AS sales_orders
        FROM days d
        LEFT JOIN purchase_day p ON p.day=d.day
        LEFT JOIN sale_day s ON s.day=d.day
        ORDER BY d.day
      `,
      params,
    )
  ).rows;

  const purchaseCost = cogs.total;
  const salesRevenue = Number(salesSummary.sales_revenue ?? 0);

  return {
    range: { from: range.fromDate, to: range.toDate },
    sales_revenue: salesRevenue,
    purchase_cost: purchaseCost,
    gross_profit: salesRevenue - purchaseCost,
    purchase_kg: Number(quantitySummary.purchase_kg ?? 0),
    sales_kg: Number(quantitySummary.sales_kg ?? 0),
    inventory_kg: Number(inventorySnapshot.inventory_kg ?? 0),
    inventory_value: Number(inventorySnapshot.inventory_value ?? 0),
    purchase_orders: Number(purchaseSummary.purchase_orders ?? 0),
    sales_orders: Number(salesSummary.sales_orders ?? 0),
    by_day: byDay.map((row) => {
      const cost = cogs.byDay[row.day] ?? 0;
      return { ...row, purchase_cost: cost, gross_profit: Number(row.sales_revenue ?? 0) - cost };
    }),
  };
}

async function calculateFifoCogs(client, range) {
  const purchases = (await client.query(`
    SELECT po.id order_id, COALESCE(po.completed_at,po.created_at) event_at,
           pi.material_id, pi.qty_kg::float qty_kg, pi.unit_price::int unit_price
    FROM purchase_orders po JOIN purchase_items pi ON pi.order_id=po.id
    WHERE po.status='completed' AND COALESCE(po.completed_at,po.created_at) <= $1::timestamptz
    ORDER BY COALESCE(po.completed_at,po.created_at), po.id, pi.id
  `, [range.toIso])).rows;
  const sales = (await client.query(`
    SELECT so.id order_id, so.sold_at event_at, si.material_id,
           si.qty_kg::float qty_kg, si.unit_price::int sale_price
    FROM sales_orders so JOIN sales_items si ON si.sales_order_id=so.id
    WHERE so.sold_at <= $1::timestamptz
    ORDER BY so.sold_at, so.id, si.id
  `, [range.toIso])).rows;
  const events = [...purchases.map((x) => ({ ...x, kind: 'purchase' })), ...sales.map((x) => ({ ...x, kind: 'sale' }))]
    .sort((a, b) => new Date(a.event_at) - new Date(b.event_at) || Number(a.order_id) - Number(b.order_id));
  const lots = new Map(); const byDay = {}; let total = 0;
  for (const event of events) {
    if (event.kind === 'purchase') {
      const queue = lots.get(event.material_id) ?? [];
      queue.push({ qty: Number(event.qty_kg), price: Number(event.unit_price) });
      lots.set(event.material_id, queue);
      continue;
    }
    let remaining = Number(event.qty_kg); let cost = 0; const queue = lots.get(event.material_id) ?? [];
    while (remaining > 0 && queue.length) {
      const lot = queue[0]; const used = Math.min(remaining, lot.qty);
      cost += used * lot.price; lot.qty -= used; remaining -= used;
      if (lot.qty <= 0.000001) queue.shift();
    }
    const at = new Date(event.event_at);
    if (at >= new Date(range.fromIso) && at <= new Date(range.toIso)) {
      const day = at.toISOString().slice(0, 10); byDay[day] = (byDay[day] ?? 0) + Math.round(cost); total += Math.round(cost);
    }
  }
  return { total, byDay };
}

function parseDateBoundary(value, end = false) {
  const text = norm(value);
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T${end ? "23:59:59.999" : "00:00:00.000"}`
    : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseListParams(url, defaultPageSize = 20, maxPageSize = 100) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const requestedSize = Number(url.searchParams.get("page_size")) || defaultPageSize;
  const pageSize = Math.max(1, Math.min(maxPageSize, requestedSize));
  const search = norm(url.searchParams.get("search") ?? url.searchParams.get("q"));
  const from = parseDateBoundary(url.searchParams.get("from"));
  const to = parseDateBoundary(url.searchParams.get("to"), true);
  const shouldPaginate =
    url.searchParams.has("page") ||
    url.searchParams.has("page_size") ||
    url.searchParams.has("search") ||
    url.searchParams.has("q") ||
    url.searchParams.has("from") ||
    url.searchParams.has("to");
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search,
    from,
    to,
    shouldPaginate,
  };
}

function appendDateRange(parts, params, column, from, to) {
  if (from) {
    params.push(from);
    parts.push(`${column} >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    parts.push(`${column} <= $${params.length}`);
  }
}

function paginatedResult(rows, total, options) {
  if (!options.shouldPaginate) return rows;
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  return {
    items: rows,
    page: options.page,
    page_size: options.pageSize,
    total,
    total_pages: totalPages,
  };
}

function resolveListOrder(sort, rules, fallback) {
  return Object.prototype.hasOwnProperty.call(rules, sort) ? rules[sort] : fallback;
}

async function seed() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const u = await c.query("SELECT id FROM users WHERE email=$1", ["admin@thiennhung.local"]);
    let admin = u.rows[0]?.id;
    if (!admin) {
      admin = (await c.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id", [
        "Thiên Nhung",
        "admin@thiennhung.local",
        makePassword("Admin@123456"),
      ])).rows[0].id;
    }

    const mats = [
      ["sat", "Sắt vụn", "Kim loại", 8200],
      ["dong", "Đồng đỏ", "Kim loại", 182000],
      ["nhom", "Nhôm", "Kim loại", 46000],
      ["inox", "Inox 304", "Kim loại", 28500],
      ["giay", "Giấy carton", "Giấy", 4200],
      ["nhua", "Nhựa tổng hợp", "Nhựa", 9800],
    ];
    for (const [code, name, group, price] of mats) {
      const m = await c.query(
        "INSERT INTO materials(code,name,group_name) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,group_name=EXCLUDED.group_name RETURNING id",
        [code, name, group],
      );
      const id = m.rows[0].id;
      await c.query("INSERT INTO prices(material_id,price_per_kg,created_by) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM prices WHERE material_id=$1 AND is_current)", [
        id,
        price,
        admin,
      ]);
      await c.query("INSERT INTO inventory(material_id) VALUES($1) ON CONFLICT(material_id) DO NOTHING", [id]);
    }

    await c.query(
      "INSERT INTO customers(code,name,phone,address) VALUES('KH-001','Nguyễn Văn Minh','0901234567','Quận 12, TP.HCM') ON CONFLICT(phone) DO NOTHING",
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

async function getMaterialById(client, materialId, { lock = false, withPrice = true } = {}) {
  const sql = `
    SELECT m.*, COALESCE(i.qty_kg,0) qty_kg, COALESCE(i.warning_kg,1000) warning_kg,
           ${withPrice ? "p.price_per_kg," : ""} ${withPrice ? "p.id AS price_id," : ""}
           ${withPrice ? "p.effective_from," : ""}
           ${withPrice ? "p.is_current AS price_current" : "NULL::boolean AS price_current"}
    FROM materials m
    LEFT JOIN inventory i ON i.material_id=m.id
    ${withPrice ? "LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true" : ""}
    WHERE m.id=$1
    ${lock ? "FOR UPDATE OF m" : ""}
  `;
  const { rows } = await client.query(sql, [materialId]);
  return rows[0] || null;
}

async function orderDetails(client, idOrCode, byCode = false) {
  const key = byCode ? "o.code=$1" : "o.id=$1";
  const sql = `
    SELECT o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'material_id', i.material_id,
            'material_name', i.material_name_snapshot,
            'qty_kg', i.qty_kg,
            'unit_price', i.unit_price,
            'line_amount', i.line_amount
          )
          ORDER BY i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM purchase_orders o
    LEFT JOIN purchase_items i ON i.order_id=o.id
    WHERE ${key}
    GROUP BY o.id
  `;
  const { rows } = await client.query(sql, [idOrCode]);
  return rows[0] || null;
}

async function rollbackAndFail(client, res, status, message, code = "BAD_REQUEST") {
  try {
    await client.query("ROLLBACK");
  } catch {}
  return fail(res, status, message, code);
}

async function invoiceByCode(client, code, user, scope = "any") {
  const isCustomer = scope === "customer";
  const userFilter = isCustomer ? "AND c.user_id=$2" : "";
  const params = isCustomer ? [code, user.id] : [code];
  const sql = `
    SELECT
      o.id,
      o.code,
      o.code AS invoice_code,
      o.status,
      o.total_amount,
      o.note,
      o.created_at,
      o.completed_at,
      c.id AS customer_id,
      c.code AS customer_code,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      COALESCE(
        json_agg(
          json_build_object(
            'material_id', i.material_id,
            'material_name', i.material_name_snapshot,
            'qty_kg', i.qty_kg,
            'unit_price', i.unit_price,
            'line_amount', i.line_amount
          )
          ORDER BY i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM purchase_orders o
    JOIN customers c ON c.id=o.customer_id
    LEFT JOIN purchase_items i ON i.order_id=o.id
    WHERE o.code=$1 ${userFilter}
    GROUP BY o.id, c.id
  `;
  const { rows } = await client.query(sql, params);
  return rows[0] || null;
}

async function inventoryDetailsByMaterial(client, materialId) {
  const material = await client.query(
    `
      SELECT
        m.id,
        m.code,
        m.name,
        m.group_name,
        m.unit,
        m.active,
        m.is_public,
        COALESCE(i.qty_kg,0) AS qty_kg,
        COALESCE(i.warning_kg,1000) AS warning_kg,
        p.price_per_kg,
        p.effective_from
      FROM materials m
      LEFT JOIN inventory i ON i.material_id=m.id
      LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
      WHERE m.id=$1
    `,
    [materialId],
  );
  const row = material.rows[0];
  if (!row) return null;
  const movements = (
    await client.query(
      `
        SELECT
          im.id,
          im.type,
          im.qty_kg,
          im.ref_type,
          im.ref_id,
          im.note,
          im.created_at,
          COALESCE(po.code, so.code) AS order_code,
          COALESCE(po.status, 'sold') AS order_status,
          COALESCE(po.completed_at, so.sold_at) AS order_completed_at,
          c.id AS customer_id,
          c.code AS customer_code,
          COALESCE(c.name, so.buyer_name) AS customer_name,
          COALESCE(c.phone, so.buyer_phone) AS customer_phone,
          COALESCE(pi.unit_price, si.unit_price) AS unit_price,
          COALESCE(pi.line_amount, si.line_amount) AS line_amount
        FROM inventory_movements im
        LEFT JOIN purchase_orders po
          ON im.ref_type='purchase_order' AND po.id=im.ref_id
        LEFT JOIN customers c ON c.id=po.customer_id
        LEFT JOIN purchase_items pi
          ON pi.order_id=po.id AND pi.material_id=im.material_id
        LEFT JOIN sales_orders so
          ON im.ref_type='sales_order' AND so.id=im.ref_id
        LEFT JOIN sales_items si
          ON si.sales_order_id=so.id AND si.material_id=im.material_id
        WHERE im.material_id=$1
        ORDER BY im.created_at DESC, im.id DESC
      `,
      [materialId],
    )
  ).rows;
  return {
    ...row,
    movements,
  };
}

function validateCustomerPayload(d) {
  // missing(d, ["name", "phone"]).length
  const name = capped(d.name, 120);
  const phone = normPhone(d.phone);
  if (!name || !phone) return { ok: false, message: "Tên và số điện thoại là bắt buộc" };
  return {
    ok: true,
    value: {
      name,
      phone,
      address: capped(d.address, 255) || "",
      note: capped(d.note, 500) || "",
      code: capped(d.code, 32) || makeCode("KH"),
      user_id: d.user_id ?? null,
    },
  };
}

function validateMaterialPayload(d) {
  const code = capped(d.code, 32) || makeCode("VL");
  const name = capped(d.name, 120);
  const groupName = capped(d.group_name, 120);
  if (!code || !name || !groupName) return { ok: false, message: "code, name và group_name là bắt buộc" };
  return {
    ok: true,
    value: {
      code,
      name,
      group_name: groupName,
      unit: capped(d.unit, 16) || "kg",
      active: d.active === undefined ? true : Boolean(d.active),
      is_public: d.is_public === undefined ? true : Boolean(d.is_public),
      warning_kg: d.warning_kg === undefined ? undefined : positiveNumber(d.warning_kg),
    },
  };
}

function materialSearchWhere(q) {
  if (!q) return { clause: "WHERE m.active=true", params: [] };
  return {
    clause: "WHERE m.active=true AND (m.name ILIKE $1 OR m.code ILIKE $1 OR m.group_name ILIKE $1)",
    params: [`%${q}%`],
  };
}

function validatePricePayload(d) {
  // if(!d.material_id||!Number.isInteger(d.price_per_kg)||d.price_per_kg<0)return fail(res,422,
  if (!d.material_id || !Number.isInteger(d.price_per_kg) || d.price_per_kg < 0) return { ok: false, message: "material_id và price_per_kg hợp lệ là bắt buộc" };
  const materialId = Number(d.material_id);
  const price = Number(d.price_per_kg);
  return {
    ok: true,
    value: {
      material_id: materialId,
      price_per_kg: price,
      note: capped(d.note, 500) || "",
      is_public: d.is_public === undefined ? undefined : Boolean(d.is_public),
    },
  };
}

function validateOrderItems(items) {
  if (!Array.isArray(items) || !items.length) return { ok: false, message: "items ph?i l? m?ng kh?ng r?ng" };
  const normalized = [];
  for (const item of items) {
    const material_id = Number(item?.material_id);
    const qty_kg = positiveQty(item?.qty_kg);
    const overridePrice = item?.price_per_kg !== undefined ? positiveNumber(item.price_per_kg) : undefined;
    const discount_amount = item?.discount_amount !== undefined ? positiveNumber(item.discount_amount) : 0;
    if (!Number.isInteger(material_id) || qty_kg === null || discount_amount === null) {
      return { ok: false, message: "M?i m?t h?ng c?n material_id, qty_kg v? discount_amount h?p l?" };
    }
    if (overridePrice !== undefined && (!Number.isInteger(overridePrice) || overridePrice < 0)) return { ok: false, message: "price_per_kg ph?i l?n h?n ho?c b?ng 0" };
    normalized.push({ material_id, qty_kg, price_per_kg: overridePrice, discount_amount: Math.round(discount_amount) });
  }
  return { ok: true, value: normalized };
}

function normalizeOrderDiscount(value) {
  const amount = positiveNumber(value);
  return amount === null ? 0 : Math.round(amount);
}

function validateSaleItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, message: "items bán ra phải là mảng không rỗng" };
  const normalized = [];
  for (const item of items) {
    const material_id = Number(item?.material_id);
    const qty_kg = positiveQty(item?.qty_kg);
    const unit_price = positiveNumber(item?.unit_price);
    if (!Number.isInteger(material_id) || qty_kg === null || unit_price === null) {
      return { ok: false, message: "Mỗi mặt hàng bán ra cần material_id, qty_kg và unit_price hợp lệ" };
    }
    normalized.push({ material_id, qty_kg, unit_price: Math.round(unit_price) });
  }
  return { ok: true, value: normalized };
}

function validateSalePayload(d) {
  const buyer_name = capped(d.buyer_name, 120);
  const buyer_phone = capped(d.buyer_phone, 32);
  const sold_at = d.sold_at ? toSqlTimestamp(d.sold_at) : now();
  const items = validateSaleItems(d.items);
  if (!buyer_name) return { ok: false, message: "Tên người mua là bắt buộc" };
  if (!sold_at) return { ok: false, message: "Ngày bán không hợp lệ" };
  if (!items.ok) return items;
  return {
    ok: true,
    value: {
      buyer_name,
      buyer_phone,
      sold_at,
      note: capped(d.note, 500) || "",
      items: items.value,
    },
  };
}

async function resolveOrderCustomer(client, payload) {
  if (payload.customer_id !== undefined && payload.customer_id !== null && payload.customer_id !== "") {
    const customerId = Number(payload.customer_id);
    if (!Number.isInteger(customerId)) return { ok: false, status: 422, message: "customer_id không hợp lệ" };
    const customer = (await client.query("SELECT * FROM customers WHERE id=$1 FOR UPDATE", [customerId])).rows[0];
    if (!customer) return { ok: false, status: 404, message: "Không tìm thấy khách hàng" };
    return { ok: true, value: customer };
  }
  const name = nonEmpty(payload.customer_name);
  const phone = normPhone(payload.customer_phone);
  if (!name || !phone) return { ok: false, status: 422, message: "customer_id hoặc customer_name + customer_phone là bắt buộc" };
  // Backward compatible with databases created before customers.phone became unique.
  // The migration adds the constraint; the explicit lookup keeps the old local schema working too.
  const existing = (await client.query("SELECT * FROM customers WHERE phone=$1 ORDER BY id LIMIT 1 FOR UPDATE", [phone])).rows[0];
  const customer = existing
    ? (await client.query("UPDATE customers SET name=COALESCE(name,$1), updated_at=now() WHERE id=$2 RETURNING *", [capped(name, 120), existing.id])).rows[0]
    : (await client.query("INSERT INTO customers(code,name,phone,address) VALUES($1,$2,$3,'') RETURNING *", [makeCode("KH"), capped(name, 120), phone])).rows[0];
  return { ok: true, value: customer };
}

function buildCustomerAccountEmail(customer) {
  const phone = normPhone(customer?.phone || "");
  const base = phone ? `kh-${phone}` : `kh-${customer?.id || Date.now()}`;
  return `${base}@thiennhung.local`;
}

async function upsertCustomerAccount(client, customerId, payload = {}) {
  const customer = (await client.query("SELECT * FROM customers WHERE id=$1 FOR UPDATE", [customerId])).rows[0];
  if (!customer) return { ok: false, status: 404, message: "Không tìm thấy khách hàng" };

  const nextEmail = nonEmpty(payload.email) ? normEmail(payload.email) : null;
  const nextPassword = nonEmpty(payload.password);
  const currentUserId = customer.user_id ? Number(customer.user_id) : null;
  let account = null;
  let created = false;
  let linked = false;
  let tempPassword = "";

  if (currentUserId) {
    account = (await client.query("SELECT id,name,email,role,active FROM users WHERE id=$1 FOR UPDATE", [currentUserId])).rows[0] || null;
  }

  if (!account) {
    const requestedUserId = payload.user_id !== undefined && payload.user_id !== null && payload.user_id !== "" ? Number(payload.user_id) : null;
    if (requestedUserId !== null && !Number.isInteger(requestedUserId)) {
      return { ok: false, status: 422, message: "user_id không hợp lệ" };
    }

    if (requestedUserId !== null) {
      const targetUser = (await client.query("SELECT id,name,email,role,active FROM users WHERE id=$1 FOR UPDATE", [requestedUserId])).rows[0];
      if (!targetUser) return { ok: false, status: 404, message: "Không tìm thấy tài khoản" };
      if (targetUser.role !== "customer") return { ok: false, status: 409, message: "Chỉ có thể gán tài khoản customer cho khách hàng" };
      const otherCustomer = (await client.query("SELECT id FROM customers WHERE user_id=$1 AND id<>$2 FOR UPDATE", [targetUser.id, customer.id])).rows[0];
      if (otherCustomer) return { ok: false, status: 409, message: "Tài khoản này đã được liên kết với khách hàng khác" };
      await client.query("UPDATE customers SET user_id=$1, updated_at=now() WHERE id=$2", [targetUser.id, customer.id]);
      account = targetUser;
      linked = true;
    } else {
      const email = nextEmail || buildCustomerAccountEmail(customer);
      let userPassword = nextPassword || "";
      const existingUser = (await client.query("SELECT id,name,email,role,active FROM users WHERE email=$1 FOR UPDATE", [email])).rows[0];
      if (existingUser) {
        if (existingUser.role !== "customer") return { ok: false, status: 409, message: "Email này đang thuộc vai trò khác" };
        const otherCustomer = (await client.query("SELECT id FROM customers WHERE user_id=$1 AND id<>$2 FOR UPDATE", [existingUser.id, customer.id])).rows[0];
        if (otherCustomer) return { ok: false, status: 409, message: "Tài khoản này đã được liên kết với khách hàng khác" };
        account = existingUser;
        linked = true;
        if (userPassword) {
          const updated = await client.query(
            "UPDATE users SET name=$1, password_hash=$2, active=true, updated_at=now() WHERE id=$3 RETURNING id,name,email,role,active",
            [customer.name, makePassword(userPassword), existingUser.id],
          );
          account = updated.rows[0];
        } else if (existingUser.name !== customer.name) {
          const updated = await client.query(
            "UPDATE users SET name=$1, active=true, updated_at=now() WHERE id=$2 RETURNING id,name,email,role,active",
            [customer.name, existingUser.id],
          );
          account = updated.rows[0];
        }
      } else {
        if (!userPassword) {
          userPassword = `Temp@${randomBytes(4).toString("hex")}`;
          tempPassword = userPassword;
        }
        const inserted = await client.query(
          "INSERT INTO users(name,email,password_hash,role,active) VALUES($1,$2,$3,'customer',true) RETURNING id,name,email,role,active",
          [customer.name, email, makePassword(userPassword)],
        );
        account = inserted.rows[0];
        created = true;
        tempPassword = tempPassword || userPassword;
      }
      await client.query("UPDATE customers SET user_id=$1, updated_at=now() WHERE id=$2", [account.id, customer.id]);
      linked = true;
    }
  } else {
    if (nextEmail || nextPassword) {
      const duplicate = nextEmail
        ? (await client.query("SELECT id FROM users WHERE email=$1 AND id<>$2 FOR UPDATE", [nextEmail, account.id])).rows[0]
        : null;
      if (duplicate) return { ok: false, status: 409, message: "Email này đã được dùng cho tài khoản khác" };
      const updates = [customer.name];
      const sets = ["name=$1"];
      if (nextEmail && nextEmail !== account.email) {
        updates.push(nextEmail);
        sets.push(`email=$${updates.length}`);
      }
      if (nextPassword) {
        updates.push(makePassword(nextPassword));
        sets.push(`password_hash=$${updates.length}`);
      }
      updates.push(account.id);
      await client.query(
        `UPDATE users SET ${sets.join(", ")}, active=true, updated_at=now() WHERE id=$${updates.length} RETURNING id,name,email,role,active`,
        updates,
      );
      account = (await client.query("SELECT id,name,email,role,active FROM users WHERE id=$1", [account.id])).rows[0];
    } else if (account.name !== customer.name || !account.active) {
      account = (await client.query(
        "UPDATE users SET name=$1, active=true, updated_at=now() WHERE id=$2 RETURNING id,name,email,role,active",
        [customer.name, account.id],
      )).rows[0];
    }
    if (!account.active) {
      account = (await client.query("UPDATE users SET active=true, updated_at=now() WHERE id=$1 RETURNING id,name,email,role,active", [account.id])).rows[0];
    }
  }

  const refreshedCustomer = (await client.query("SELECT * FROM customers WHERE id=$1", [customer.id])).rows[0];
  return {
    ok: true,
    status: created ? 201 : 200,
    value: {
      customer: refreshedCustomer,
      user: account,
      created,
      linked,
      temp_password: tempPassword || undefined,
    },
  };
}

async function handleOrderCreate(client, user, payload) {
  // contract: !d.customer_id || !Array.isArray(d.items) || !d.items.length
  const items = validateOrderItems(payload.items);
  if (!items.ok) return { ok: false, status: 422, message: items.message };
  const resolvedCustomer = await resolveOrderCustomer(client, payload);
  if (!resolvedCustomer.ok) return resolvedCustomer;
  const customer = resolvedCustomer.value;
  const orderDiscount = normalizeOrderDiscount(payload.customer_discount_amount);
  const orderDiscountPercent = positiveNumber(payload.customer_discount_percent);

  const code = await makeSequenceCode(client, "purchase_orders", "created_at", new Date(), "IN");
  const status = "completed";
  const purchaseItemColumns = await getTableColumns(client, "purchase_items");
  const purchaseOrderColumns = await getTableColumns(client, "purchase_orders");
  const orderInsertColumns = ["code", "customer_id", "customer_name_snapshot", "customer_phone_snapshot"];
  const orderInsertValues = [code, customer.id, customer.name, customer.phone];
  if (purchaseOrderColumns.has("customer_discount_amount")) {
    orderInsertColumns.push("customer_discount_amount");
    orderInsertValues.push(orderDiscount);
  }
  if (purchaseOrderColumns.has("customer_discount_percent")) {
    orderInsertColumns.push("customer_discount_percent");
    orderInsertValues.push(orderDiscountPercent === null ? 0 : Math.round(orderDiscountPercent));
  }
  orderInsertColumns.push("status", "note", "created_by", "completed_at");
  orderInsertValues.push(status, nonEmpty(payload.note) || "", user.id, status === "completed" ? now() : null);
  const orderPlaceholders = orderInsertValues.map((_, index) => `$${index + 1}`);
  const order = (
    await client.query(
      `INSERT INTO purchase_orders(${orderInsertColumns.join(",")}) VALUES(${orderPlaceholders.join(",")}) RETURNING id,code,status`,
      orderInsertValues,
    )
  ).rows[0];

  let subtotal = 0;
  for (const item of items.value) {
    const material = await getMaterialById(client, item.material_id, { lock: true, withPrice: true });
    if (!material || !material.active || material.price_per_kg === null || material.price_per_kg === undefined) {
      return { ok: false, status: 422, message: "Mặt hàng không hợp lệ hoặc chưa có giá" };
    }
    const qty = item.qty_kg;
    const unitPrice = item.price_per_kg !== undefined ? item.price_per_kg : Number(material.price_per_kg);
    const grossAmount = Math.round(qty * unitPrice);
    const discountAmount = Math.min(Math.max(Math.round(Number(item.discount_amount || 0)), 0), grossAmount);
    const amount = grossAmount - discountAmount;
    subtotal += amount;
    const insertedItem = await client.query(
      "INSERT INTO purchase_items(order_id,material_id,material_name_snapshot,qty_kg,unit_price,line_amount) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [order.id, material.id, material.name, qty, unitPrice, amount],
    );
    const itemUpdates = [];
    const itemValues = [];
    if (purchaseItemColumns.has("discount_amount")) {
      itemUpdates.push(`discount_amount=$${itemValues.length + 1}`);
      itemValues.push(discountAmount);
    }
    if (purchaseItemColumns.has("line_discount_amount")) {
      itemUpdates.push(`line_discount_amount=$${itemValues.length + 1}`);
      itemValues.push(discountAmount);
    }
    if (purchaseItemColumns.has("price_snapshot")) {
      itemUpdates.push(`price_snapshot=$${itemValues.length + 1}`);
      itemValues.push(unitPrice);
    }
    if (purchaseItemColumns.has("price_source")) {
      itemUpdates.push(`price_source=$${itemValues.length + 1}`);
      itemValues.push("transaction");
    }
    if (itemUpdates.length) {
      itemValues.push(insertedItem.rows[0].id);
      await client.query(
        `UPDATE purchase_items SET ${itemUpdates.join(", ")} WHERE id=$${itemValues.length}`,
        itemValues,
      );
    }
    if (status === "completed") {
      const inv = await client.query("SELECT qty_kg FROM inventory WHERE material_id=$1 FOR UPDATE", [material.id]);
      if (!inv.rows[0]) return { ok: false, status: 409, message: "Không tìm thấy tồn kho cho mặt hàng" };
      await client.query("UPDATE inventory SET qty_kg=qty_kg+$1,updated_at=now() WHERE material_id=$2", [qty, material.id]);
      await client.query("INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,created_by) VALUES($1,'in',$2,'purchase_order',$3,$4)", [
        material.id,
        qty,
        order.id,
        user.id,
      ]);
    }
  }
  const total = Math.max(0, subtotal - orderDiscount);
  const orderUpdates = ["total_amount=$1"];
  const orderUpdateValues = [total, order.id];
  if (purchaseOrderColumns.has("customer_discount_amount")) {
    orderUpdates.push(`customer_discount_amount=$${orderUpdateValues.length + 1}`);
    orderUpdateValues.push(orderDiscount);
  }
  if (purchaseOrderColumns.has("customer_discount_percent")) {
    orderUpdates.push(`customer_discount_percent=$${orderUpdateValues.length + 1}`);
    orderUpdateValues.push(orderDiscountPercent === null ? 0 : Math.round(orderDiscountPercent));
  }
  await client.query(`UPDATE purchase_orders SET ${orderUpdates.join(",")} WHERE id=$${orderUpdateValues.length}`, orderUpdateValues);
  if (status === "completed") await audit(client, user.id, "create", "purchase_order", order.id, { code, total, customer_discount_amount: orderDiscount });
  return { ok: true, orderId: order.id, code, status, total, customerDiscountAmount: orderDiscount };
}
async function handleSaleCreate(client, user, payload) {
  const valid = validateSalePayload(payload);
  if (!valid.ok) return { ok: false, status: 422, message: valid.message };
  const code = await makeSequenceCode(client, "sales_orders", "sold_at", new Date(valid.value.sold_at), "OUT");
  const sale = (
    await client.query(
      "INSERT INTO sales_orders(code,buyer_name,buyer_phone,note,sold_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,code,sold_at",
      [code, valid.value.buyer_name, valid.value.buyer_phone, valid.value.note, valid.value.sold_at, user.id],
    )
  ).rows[0];
  const salesItemColumns = await getTableColumns(client, "sales_items");
  const priceHistoryColumns = await getTableColumns(client, "price_history");
  let total = 0;
  for (const item of valid.value.items) {
    const material = await getMaterialById(client, item.material_id, { lock: true, withPrice: true });
    if (!material || !material.active) return { ok: false, status: 404, message: "Không tìm thấy vật liệu bán ra" };
    const inventoryRow = (await client.query("SELECT qty_kg FROM inventory WHERE material_id=$1 FOR UPDATE", [item.material_id])).rows[0];
    if (!inventoryRow || Number(inventoryRow.qty_kg) < Number(item.qty_kg)) return { ok: false, status: 409, message: `Tồn kho không đủ cho ${material.name}` };
    const line_amount = Math.round(Number(item.qty_kg) * Number(item.unit_price));
    total += line_amount;
    const columns = ["sales_order_id", "material_id", "material_name_snapshot", "qty_kg", "unit_price", "line_amount"];
    const values = [sale.id, item.material_id, material.name, item.qty_kg, item.unit_price, line_amount];
    if (salesItemColumns.has("price_snapshot")) {
      columns.push("price_snapshot");
      values.push(item.unit_price);
    }
    if (salesItemColumns.has("price_source")) {
      columns.push("price_source");
      values.push("transaction");
    }
    await client.query(
      `INSERT INTO sales_items(${columns.join(",")}) VALUES(${columns.map((_, index) => `$${index + 1}`).join(",")})`,
      values,
    );
    if (priceHistoryColumns.has("material_id") && priceHistoryColumns.has("price_type") && priceHistoryColumns.has("price_per_kg")) {
      await client.query(
        `
          INSERT INTO price_history(material_id,price_type,price_per_kg,effective_from,effective_to,changed_by,note)
          VALUES($1,'sale',$2,$3,$4,$5,$6)
        `,
        [material.id, item.unit_price, valid.value.sold_at, valid.value.sold_at, user.id, `Snapshot from sales order ${code}`],
      );
    }
    await client.query("UPDATE inventory SET qty_kg=qty_kg-$1,updated_at=now() WHERE material_id=$2", [item.qty_kg, item.material_id]);
    await client.query(
      "INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,note,created_by,created_at) VALUES($1,'out',$2,'sales_order',$3,$4,$5,$6)",
      [item.material_id, item.qty_kg, sale.id, `Xuất bán ${code}`, user.id, valid.value.sold_at],
    );
  }
  await client.query("UPDATE sales_orders SET total_amount=$1 WHERE id=$2", [total, sale.id]);
  await audit(client, user.id, "create", "sales_order", sale.id, { code, total });
  return { ok: true, saleId: sale.id, code };
}

async function cancelOrder(client, user, orderId, reason) {
  const order = (await client.query("SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE", [orderId])).rows[0];
  if (!order) return { ok: false, status: 404, message: "Không tìm thấy đơn hàng" };
  if (order.status !== "completed") return { ok: false, status: 409, message: "Chỉ đơn hoàn tất mới có thể hủy" };
  if (!nonEmpty(reason)) return { ok: false, status: 422, message: "Vui lòng chọn lý do hủy" };
  if (order.status === "cancelled") return { ok: false, status: 409, message: "Đơn hàng đã bị hủy" };
  const items = (await client.query("SELECT * FROM purchase_items WHERE order_id=$1 FOR UPDATE", [orderId])).rows;
  for (const item of items) {
    const inv = await client.query("SELECT qty_kg FROM inventory WHERE material_id=$1 FOR UPDATE", [item.material_id]);
    if (!inv.rows[0] || Number(inv.rows[0].qty_kg) < Number(item.qty_kg)) {
      return { ok: false, status: 409, message: "Không đủ tồn kho để hủy đơn" };
    }
    await client.query("UPDATE inventory SET qty_kg=qty_kg-$1,updated_at=now() WHERE material_id=$2", [item.qty_kg, item.material_id]);
    await client.query("INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,created_by,note) VALUES($1,'out',$2,'purchase_order',$3,$4,$5)", [
      item.material_id,
      item.qty_kg,
      orderId,
      user.id,
      `Hủy đơn ${order.code}: ${capped(reason, 200)}`,
    ]);
  }
  await client.query("UPDATE purchase_orders SET status='cancelled',completed_at=NULL,cancellation_reason=$2 WHERE id=$1", [orderId, capped(reason, 200)]);
  await audit(client, user.id, "cancel", "purchase_order", orderId, { code: order.code, reason: capped(reason, 200) });
  return { ok: true };
}

async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  let user;

  try {
    if (!assertStateChangeAllowed(req)) return fail(res, 403, "Y?u c?u kh?ng h?p l? t? ngu?n b?n ngo?i", "CSRF_BLOCKED");
    user = await currentUser(req);
    if (route === "/api/health") return json(res, 200, { ok: true, service: "phe-lieu-postgres-backend", time: now() });

    if (route === "/api/auth/register" && req.method === "POST") {
      const d = await readJsonBody(req);
      // contract: missing(d, ["name", "phone"]).length
      if (missing(d, ["name", "email", "password"]).length || String(d.password).length < 8) {
        return fail(res, 422, "Tên, email và mật khẩu tối thiểu 8 ký tự là bắt buộc");
      }
      const payload = {
        name: capped(d.name, 120),
        email: normEmail(d.email),
        password: String(d.password),
        phone: d.phone ? normPhone(d.phone) : "",
        address: capped(d.address, 255) || "",
      };
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const r = await c.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id,name,email,role", [
          payload.name,
          payload.email,
          makePassword(payload.password),
        ]);
        if (payload.phone) {
          const existing = (await c.query("SELECT id,user_id FROM customers WHERE phone=$1 FOR UPDATE", [payload.phone])).rows[0];
          if (existing) {
            if (existing.user_id) throw Object.assign(new Error("Số điện thoại đã liên kết tài khoản khác"), { status: 409 });
            await c.query("UPDATE customers SET user_id=$1,name=$2,address=$3,updated_at=now() WHERE id=$4", [r.rows[0].id, payload.name, payload.address, existing.id]);
          } else {
            await c.query("INSERT INTO customers(code,name,phone,address,user_id) VALUES($1,$2,$3,$4,$5)", [
              makeCode("KH"),
              payload.name,
              payload.phone,
              payload.address,
              r.rows[0].id,
            ]);
          }
        }
        await audit(c, r.rows[0].id, "register", "user", r.rows[0].id);
        await c.query("COMMIT");
        return json(res, 201, { user: r.rows[0] });
      } catch (e) {
        await c.query("ROLLBACK");
        if (e.code === "23505") return fail(res, 409, "Email hoặc số điện thoại đã tồn tại", "CONFLICT");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route === "/api/auth/login" && req.method === "POST") {
      const d = await readJsonBody(req);
      const email = normEmail(d.email);
      if (!allowed(req, "login-ip")) return fail(res, 429, "Quá nhiều lần đăng nhập", "RATE_LIMITED");
       if (email && !allowed(req, "login-email", 5, 15 * 60 * 1000)) return fail(res, 429, "Quá nhiều lần đăng nhập", "RATE_LIMITED");
       const r = await pool.query("SELECT * FROM users WHERE email=$1 AND active=true", [email]);
      const account = r.rows[0];
      if (!account || !verifyPassword(String(d.password || ""), account.password_hash)) {
        if (account) await audit(pool, account.id, "login_failed", "user", account.id, { ip: clientIp(req) });
        return fail(res, 401, "Email hoặc mật khẩu không đúng", "INVALID_CREDENTIALS");
      }
      const token = randomBytes(32).toString("base64url");
      const csrf = randomBytes(32).toString("base64url");
       await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')", [sha(token), account.id]);
      await audit(pool, account.id, "login", "user", account.id, { ip: clientIp(req) });
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      return json(
        res,
        200,
        { user: { id: account.id, name: account.name, email: account.email, role: account.role } },
         { "set-cookie": [`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`, `csrf=${csrf}; SameSite=Lax; Path=/; Max-Age=604800${secure}`] },
      );
    }

    if (route === "/api/auth/logout" && req.method === "POST") {
      const token = cookieToken(req);
      if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha(token)]);
      return json(res, 200, { ok: true }, { "set-cookie": ["session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", "csrf=; SameSite=Lax; Path=/; Max-Age=0"] });
    }

    if (route === "/api/auth/me" && req.method === "GET") return user ? json(res, 200, { user }) : fail(res, 401, "Bạn chưa đăng nhập", "UNAUTHENTICATED");

    if (route === "/api/auth/profile" && req.method === "POST") {
      if (!user) return fail(res, 401, "Bạn chưa đăng nhập", "UNAUTHENTICATED");
      const d = await readJsonBody(req);
      const name = capped(d.name, 100);
      if (!name) return fail(res, 422, "Tên không được để trống");
      
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        if (d.password) {
          if (String(d.password).length < 8) {
            return rollbackAndFail(c, res, 422, "Mật khẩu phải tối thiểu 8 ký tự");
          }
          await c.query("UPDATE users SET name=$1, password_hash=$2, updated_at=now() WHERE id=$3", [name, makePassword(String(d.password)), user.id]);
        } else {
          await c.query("UPDATE users SET name=$1, updated_at=now() WHERE id=$2", [name, user.id]);
        }
        await audit(c, user.id, "update_profile", "user", user.id);
        await c.query("COMMIT");
        return json(res, 200, { ok: true, user: { ...user, name } });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route === "/api/customer/orders" && req.method === "GET") {if (!guard(res, user, "customer")) return;
      return json(
        res,
        200,
        (
          await pool.query(
            "SELECT o.code,o.status,o.total_amount,o.created_at,o.completed_at FROM purchase_orders o JOIN customers c ON c.id=o.customer_id WHERE c.user_id=$1 ORDER BY o.id DESC",
            [user.id],
          )
        ).rows,
      );
    }
    if (route === "/api/customer/orders" && req.method === "GET") {
      if (!guard(res, user, "customer")) return;
      return json(
        res,
        200,
        (
          await pool.query(
            "SELECT o.code,o.status,o.total_amount,o.created_at,o.completed_at FROM purchase_orders o JOIN customers c ON c.id=o.customer_id WHERE c.user_id=$1 ORDER BY o.id DESC",
            [user.id],
          )
        ).rows,
      );
    }

    if (route === "/api/customer/reports" && req.method === "GET") {
      if (!guard(res, user, "customer")) return;
      const base = (
        await pool.query(
          "SELECT COUNT(*)::int orders,COALESCE(SUM(total_amount),0)::int total_amount,MAX(completed_at) last_order_at FROM purchase_orders o JOIN customers c ON c.id=o.customer_id WHERE c.user_id=$1 AND o.status='completed'",
          [user.id],
        )
      ).rows[0];
      const kg = (
        await pool.query(
          "SELECT COALESCE(SUM(i.qty_kg),0)::float total_kg FROM purchase_orders o JOIN customers c ON c.id=o.customer_id JOIN purchase_items i ON i.order_id=o.id WHERE c.user_id=$1 AND o.status='completed'",
          [user.id],
        )
      ).rows[0];
      const top = (
        await pool.query(
          "SELECT i.material_name_snapshot name,SUM(i.qty_kg)::float qty_kg FROM purchase_items i JOIN purchase_orders o ON o.id=i.order_id JOIN customers c ON c.id=o.customer_id WHERE c.user_id=$1 AND o.status='completed' GROUP BY i.material_id,i.material_name_snapshot ORDER BY qty_kg DESC LIMIT 1",
          [user.id],
        )
      ).rows[0] || null;
      const byDay = (
        await pool.query(
          "SELECT to_char(date_trunc('day', o.completed_at), 'YYYY-MM-DD') AS day,COUNT(*)::int AS orders,COALESCE(SUM(o.total_amount),0)::int AS total_amount FROM purchase_orders o JOIN customers c ON c.id=o.customer_id WHERE c.user_id=$1 AND o.status='completed' AND o.completed_at >= now() - interval '7 days' GROUP BY 1 ORDER BY 1",
          [user.id],
        )
      ).rows;
      const byMonth = (
        await pool.query(
          "SELECT to_char(date_trunc('month', o.completed_at), 'YYYY-MM') AS month,COUNT(*)::int AS orders,COALESCE(SUM(o.total_amount),0)::int AS total_amount FROM purchase_orders o JOIN customers c ON c.id=o.customer_id WHERE c.user_id=$1 AND o.status='completed' AND o.completed_at >= date_trunc('month', now()) - interval '11 months' GROUP BY 1 ORDER BY 1",
          [user.id],
        )
      ).rows;
      return json(res, 200, { ...base, ...kg, top_material: top, by_day: byDay, by_month: byMonth });
    }

    if (route.startsWith("/api/customer/orders/") && req.method === "GET") {
      if (!guard(res, user, "customer")) return;
      const code = route.split("/").pop();
      const r = await pool.query(
        `
          SELECT o.*,json_agg(json_build_object('material_name',i.material_name_snapshot,'qty_kg',i.qty_kg,'unit_price',i.unit_price,'line_amount',i.line_amount)) items
          FROM purchase_orders o
          JOIN customers c ON c.id=o.customer_id
          JOIN purchase_items i ON i.order_id=o.id
          WHERE o.code=$1 AND c.user_id=$2
          GROUP BY o.id
        `,
        [code, user.id],
      );
      if (!r.rows[0]) return fail(res, 404, "Không tìm thấy hóa đơn", "NOT_FOUND");
      return json(res, 200, r.rows[0]);
    }

    if (route === "/api/invoices" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const q = norm(url.searchParams.get("q"));
      const rows = (
        await pool.query(
          `SELECT o.code AS invoice_code, o.status, o.total_amount, o.created_at, o.completed_at, c.name AS customer_name, c.phone AS customer_phone
           FROM purchase_orders o JOIN customers c ON c.id=o.customer_id
           WHERE ($1 = '' OR o.code ILIKE $2 OR c.name ILIKE $2 OR c.phone ILIKE $2)
           ORDER BY o.id DESC LIMIT 100`,
          [q, `%${q}%`],
        )
      ).rows;
      return json(res, 200, rows);
    }

    if (route.startsWith("/api/invoices/") && req.method === "GET") {
      if (!guard(res, user, user?.role === "customer" ? "customer" : undefined)) return;
      const code = route.split("/").pop();
      const invoice = await invoiceByCode(pool, code, user, user?.role === "customer" ? "customer" : "any");
      if (!invoice) return fail(res, 404, "Không tìm thấy hóa đơn", "NOT_FOUND");
      return json(res, 200, invoice);
    }

    if (route === "/api/prices" && req.method === "GET") {
      return json(
        res,
        200,
        (
          await pool.query(
            "SELECT m.id,m.code,m.name,m.group_name,m.unit,m.is_public,p.price_per_kg,p.effective_from FROM materials m JOIN prices p ON p.material_id=m.id AND p.is_current=true WHERE m.active=true AND m.is_public=true ORDER BY m.id",
          )
        ).rows,
      );
    }

    if (route === "/api/materials" && req.method === "GET") {
      if (user?.role === "admin") {
        const q = norm(url.searchParams.get("q"));
        const search = materialSearchWhere(q);
        return json(
          res,
          200,
          (
            await pool.query(
              `SELECT m.*,COALESCE(i.qty_kg,0) qty_kg,COALESCE(i.warning_kg,1000) warning_kg,COALESCE(p.price_per_kg,0) price_per_kg
               FROM materials m
               LEFT JOIN inventory i ON i.material_id=m.id
               LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
               ${search.clause}
               ORDER BY m.id`,
              search.params,
            )
          ).rows,
        );
      }
      return json(
        res,
        200,
        (
          await pool.query(
            "SELECT m.*,COALESCE(i.qty_kg,0) qty_kg,COALESCE(i.warning_kg,1000) warning_kg,p.price_per_kg FROM materials m LEFT JOIN inventory i ON i.material_id=m.id LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true WHERE m.active=true AND m.is_public=true ORDER BY m.id",
          )
        ).rows,
      );
    }

    if (route === "/api/customers" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const list = parseListParams(url, 20, 20);
      const params = [];
      const where = ["c.admin_visible=true"];
      if (list.search) {
        params.push(`%${list.search}%`);
        where.push(`(c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.code ILIKE $${params.length})`);
      }
      appendDateRange(where, params, "c.created_at", list.from, list.to);
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const countQuery = `SELECT COUNT(*)::int total FROM customers c ${whereClause}`;
      const dataParams = [...params];
      const sort = url.searchParams.get("sort");
      let paginationClause = resolveListOrder(sort, {
        customer_amount_desc: "ORDER BY total_amount DESC, c.id DESC",
        customer_amount_asc: "ORDER BY total_amount ASC, c.id DESC",
      }, "ORDER BY orders DESC, c.id DESC");
      if (list.shouldPaginate) {
        dataParams.push(list.pageSize, list.offset);
        paginationClause += ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
      }
      const rows = (
        await pool.query(
          `
            SELECT
              c.*,
              COUNT(o.id)::int orders,
              COALESCE(SUM(CASE WHEN o.status='completed' THEN o.total_amount ELSE 0 END),0)::int total_amount
            FROM customers c
            LEFT JOIN purchase_orders o ON o.customer_id=c.id
            ${whereClause}
            GROUP BY c.id
            ${paginationClause}
          `,
          dataParams,
        )
      ).rows;
      const total = (await pool.query(countQuery, params)).rows[0]?.total ?? rows.length;
      return json(res, 200, paginatedResult(rows, total, list));
    }

    if (route === "/api/customers" && req.method === "POST") {
      if (!guard(res, user, "admin")) return;
      const d = await readJsonBody(req);
      const valid = validateCustomerPayload(d);
      if (!valid.ok) return fail(res, 422, valid.message);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const existing = (await c.query("SELECT id,user_id FROM customers WHERE phone=$1 FOR UPDATE", [valid.value.phone])).rows[0];
        let r;
        if (existing) {
          if (existing.user_id && valid.value.user_id && existing.user_id !== valid.value.user_id) {
            return rollbackAndFail(c, res, 409, "Số điện thoại đã liên kết tài khoản khác", "CONFLICT");
          }
          r = await c.query(
            "UPDATE customers SET name=$1,address=$2,note=$3,user_id=COALESCE($4,user_id),updated_at=now() WHERE id=$5 RETURNING *",
            [valid.value.name, valid.value.address, valid.value.note, valid.value.user_id, existing.id],
          );
        } else {
          r = await c.query(
            "INSERT INTO customers(code,name,phone,address,note,user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            [valid.value.code, valid.value.name, valid.value.phone, valid.value.address, valid.value.note, valid.value.user_id],
          );
        }
        await audit(c, user.id, "create", "customer", r.rows[0].id);
        await c.query("COMMIT");
        return json(res, 201, r.rows[0]);
      } catch (e) {
        await c.query("ROLLBACK");
        if (e.code === "23505") return fail(res, 409, "Số điện thoại hoặc mã khách hàng đã tồn tại", "CONFLICT");
        throw e;
      } finally {
        c.release();
      }
    }

    if (/^\/api\/customers\/\d+\/orders$/.test(route) && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const customerId = Number(route.split("/")[3]);
      if (!Number.isInteger(customerId)) return fail(res, 422, "customer id không hợp lệ");
      const customer = (
        await pool.query(
          `
            SELECT
              c.*,
              u.id AS user_id,
              u.name AS user_name,
              u.email AS user_email,
              u.active AS user_active,
              COUNT(o.id)::int orders,
              COALESCE(SUM(CASE WHEN o.status='completed' THEN o.total_amount ELSE 0 END),0)::int total_amount
            FROM customers c
            LEFT JOIN users u ON u.id=c.user_id
            LEFT JOIN purchase_orders o ON o.customer_id=c.id
            WHERE c.id=$1
            GROUP BY c.id, u.id
          `,
          [customerId],
        )
      ).rows[0];
      if (!customer) return fail(res, 404, "Không tìm thấy khách hàng", "NOT_FOUND");
      const orders = (
        await pool.query(
          "SELECT o.id,o.code,o.status,o.total_amount,o.note,o.created_at,o.completed_at,o.cancellation_reason,COUNT(i.id)::int item_count FROM purchase_orders o LEFT JOIN purchase_items i ON i.order_id=o.id WHERE o.customer_id=$1 GROUP BY o.id ORDER BY o.id DESC",
          [customerId],
        )
      ).rows;
      return json(res, 200, { customer, orders });
    }

    if (/^\/api\/customers\/\d+\/account$/.test(route) && req.method === "POST") {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/")[3]);
      if (!Number.isInteger(id)) return fail(res, 422, "customer id không hợp lệ");
      const d = await readJsonBody(req);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await upsertCustomerAccount(c, id, d || {});
        if (!result.ok) return rollbackAndFail(c, res, result.status, result.message, result.code || "BAD_REQUEST");
        await audit(c, user.id, "customer_account", "customer", id, {
          created: result.value.created,
          linked: result.value.linked,
          user_id: result.value.user?.id ?? null,
        });
        await c.query("COMMIT");
        return json(res, result.status, result.value);
      } catch (e) {
        await c.query("ROLLBACK");
        if (e.code === "23505") return fail(res, 409, "Email hoặc số điện thoại đã tồn tại", "CONFLICT");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route.startsWith("/api/customers/") && (req.method === "PATCH" || req.method === "PUT")) {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/").pop());
      if (!Number.isInteger(id)) return fail(res, 422, "customer id không hợp lệ");
      const d = await readJsonBody(req);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const existing = (await c.query("SELECT * FROM customers WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (!existing) return rollbackAndFail(c, res, 404, "Không tìm thấy khách hàng", "NOT_FOUND");
        const nextPhone = nonEmpty(d.phone) || existing.phone;
        const nextUserId = d.user_id === undefined ? existing.user_id : d.user_id;
        if (nextPhone !== existing.phone) {
          const other = (await c.query("SELECT id,user_id FROM customers WHERE phone=$1 AND id<>$2 FOR UPDATE", [nextPhone, id])).rows[0];
          if (other && other.user_id && nextUserId && other.user_id !== nextUserId) {
            return rollbackAndFail(c, res, 409, "Số điện thoại đã liên kết tài khoản khác", "CONFLICT");
          }
        }
        const next = {
          name: nonEmpty(d.name) || existing.name,
          phone: nextPhone,
          address: d.address === undefined ? existing.address : nonEmpty(d.address),
          note: d.note === undefined ? existing.note : nonEmpty(d.note),
          user_id: nextUserId,
        };
        const r = await c.query(
          "UPDATE customers SET name=$1, phone=$2, address=$3, note=$4, user_id=$5, updated_at=now() WHERE id=$6 RETURNING *",
          [next.name, next.phone, next.address, next.note, next.user_id, id],
        );
        if (!r.rowCount) return fail(res, 404, "Kh?ng t?m th?y kh?ch h?ng", "NOT_FOUND");
        await audit(c, user.id, "update", "customer", id);
        await c.query("COMMIT");
        return json(res, 200, r.rows[0]);
      } catch (e) {
        await c.query("ROLLBACK");
        if (e.code === "23505") return fail(res, 409, "Số điện thoại hoặc mã khách hàng đã tồn tại", "CONFLICT");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route.startsWith("/api/customers/") && req.method === "DELETE") {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/").pop());
      if (!Number.isInteger(id)) return fail(res, 422, "customer id không hợp lệ");
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const existing = (await c.query("SELECT id FROM customers WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (!existing) return rollbackAndFail(c, res, 404, "Kh?ng t?m th?y kh?ch h?ng", "NOT_FOUND");
        const hasOrders = (await c.query("SELECT 1 FROM purchase_orders WHERE customer_id=$1 LIMIT 1", [id])).rowCount > 0;
        if (hasOrders) return rollbackAndFail(c, res, 409, "Khách hàng đã có đơn hàng, không thể xoá", "CONFLICT");
        const result = await c.query("DELETE FROM customers WHERE id=$1", [id]);
        if (!result.rowCount) return rollbackAndFail(c, res, 404, "Kh?ng t?m th?y kh?ch h?ng", "NOT_FOUND");
        await audit(c, user.id, "delete", "customer", id);
        await c.query("COMMIT");
        return json(res, 200, { ok: true, affectedRows: result.rowCount });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route === "/api/materials" && req.method === "POST") {
      if (!guard(res, user, "admin")) return;
      const d = await readJsonBody(req);
      const valid = validateMaterialPayload(d);
      if (!valid.ok) return fail(res, 422, valid.message);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const r = await c.query(
          "INSERT INTO materials(code,name,group_name,unit,active,is_public) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [valid.value.code, valid.value.name, valid.value.group_name, valid.value.unit, valid.value.active, valid.value.is_public],
        );
        await c.query("INSERT INTO inventory(material_id,warning_kg) VALUES($1,$2) ON CONFLICT(material_id) DO UPDATE SET warning_kg=EXCLUDED.warning_kg", [
          r.rows[0].id,
          valid.value.warning_kg ?? 1000,
        ]);
        await audit(c, user.id, "create", "material", r.rows[0].id);
        await c.query("COMMIT");
        return json(res, 201, r.rows[0]);
      } catch (e) {
        await c.query("ROLLBACK");
        if (e.code === "23505") return fail(res, 409, "Mã vật liệu đã tồn tại", "CONFLICT");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route.startsWith("/api/materials/") && (req.method === "PATCH" || req.method === "PUT")) {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/").pop());
      if (!Number.isInteger(id)) return fail(res, 422, "material id không hợp lệ");
      const d = await readJsonBody(req);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const existing = (await c.query("SELECT * FROM materials WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (!existing) return fail(res, 404, "Không tìm thấy vật liệu", "NOT_FOUND");
        const next = {
          code: existing.code,
          name: nonEmpty(d.name) || existing.name,
          group_name: nonEmpty(d.group_name) || existing.group_name,
          unit: nonEmpty(d.unit) || existing.unit,
          active: d.active === undefined ? existing.active : Boolean(d.active),
          is_public: d.is_public === undefined ? existing.is_public : Boolean(d.is_public),
        };
        const r = await c.query(
          "UPDATE materials SET code=$1,name=$2,group_name=$3,unit=$4,active=$5,is_public=$6 WHERE id=$7 RETURNING *",
          [next.code, next.name, next.group_name, next.unit, next.active, next.is_public, id],
        );
        if (d.warning_kg !== undefined) {
          const warning = positiveNumber(d.warning_kg);
          if (warning === null) return rollbackAndFail(c, res, 422, "warning_kg không hợp lệ");
          await c.query("UPDATE inventory SET warning_kg=$1,updated_at=now() WHERE material_id=$2", [warning, id]);
        }
        await audit(c, user.id, "update", "material", id);
        await c.query("COMMIT");
        return json(res, 200, r.rows[0]);
      } catch (e) {
        await c.query("ROLLBACK");
        if (e.code === "23505") return fail(res, 409, "Mã vật liệu đã tồn tại", "CONFLICT");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route.startsWith("/api/materials/") && req.method === "DELETE") {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/").pop());
      if (!Number.isInteger(id)) return fail(res, 422, "material id không hợp lệ");
      const result = await pool.query("UPDATE materials SET active=false WHERE id=$1 AND active=true", [id]);
      if (result.rowCount === 0) return fail(res, 404, "Kh?ng t?m th?y v?t li?u", "NOT_FOUND");
      await audit(pool, user.id, "delete", "material", id);
      return json(res, 200, { ok: true });
    }

    if (route === "/api/prices" && req.method === "POST") {
      if (!guard(res, user, "admin")) return;
      const d = await readJsonBody(req);
      const valid = validatePricePayload(d);
      if (!valid.ok) return fail(res, 422, valid.message);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const material = await getMaterialById(c, valid.value.material_id, { lock: true, withPrice: false });
        if (!material) return rollbackAndFail(c, res, 404, "Không tìm thấy vật liệu", "NOT_FOUND");
        if (valid.value.is_public !== undefined) {
          await c.query("UPDATE materials SET is_public=$1 WHERE id=$2", [valid.value.is_public, valid.value.material_id]);
        }
        await c.query("UPDATE prices SET is_current=false,effective_to=now() WHERE material_id=$1 AND is_current=true", [valid.value.material_id]);
        const r = await c.query("INSERT INTO prices(material_id,price_per_kg,note,created_by) VALUES($1,$2,$3,$4) RETURNING id", [
          valid.value.material_id,
          valid.value.price_per_kg,
          valid.value.note,
          user.id,
        ]);
        await audit(c, user.id, "update", "price", r.rows[0].id, { material_id: valid.value.material_id, price: valid.value.price_per_kg });
        await c.query("COMMIT");
        return json(res, 201, r.rows[0]);
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route === "/api/prices/history" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const materialId = Number(url.searchParams.get("material_id"));
      const where = Number.isInteger(materialId) ? "WHERE material_id=$1" : "";
      const params = Number.isInteger(materialId) ? [materialId] : [];
      return json(
        res,
        200,
        (
          await pool.query(
            `SELECT p.*,m.code,m.name FROM prices p JOIN materials m ON m.id=p.material_id ${where} ORDER BY p.effective_from DESC LIMIT 200`,
            params,
          )
        ).rows,
      );
    }

    if (route === "/api/orders" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const list = parseListParams(url, 12, 100);
      const params = [];
      const where = [];
      if (list.search) {
        params.push(`%${list.search}%`);
        where.push(`(
          o.code ILIKE $${params.length}
          OR COALESCE(o.customer_name_snapshot, '') ILIKE $${params.length}
          OR COALESCE(o.customer_phone_snapshot, '') ILIKE $${params.length}
          OR COALESCE(c.name, '') ILIKE $${params.length}
          OR COALESCE(c.phone, '') ILIKE $${params.length}
        )`);
      }
      appendDateRange(where, params, "COALESCE(o.completed_at, o.created_at)", list.from, list.to);
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const countQuery = `
        SELECT COUNT(*)::int total
        FROM purchase_orders o
        LEFT JOIN customers c ON c.id=o.customer_id
        ${whereClause}
      `;
      const dataParams = [...params];
      const sort = url.searchParams.get("sort");
      let paginationClause = resolveListOrder(sort, {
        amount_desc: "ORDER BY o.total_amount DESC, o.id DESC",
        amount_asc: "ORDER BY o.total_amount ASC, o.id DESC",
      }, "ORDER BY COALESCE(o.completed_at, o.created_at) DESC, o.id DESC");
      if (list.shouldPaginate) {
        dataParams.push(list.pageSize, list.offset);
        paginationClause += ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
      }
      const rows = (
        await pool.query(
          `
            SELECT
              o.*,
              c.name AS customer_name,
              c.phone AS customer_phone,
              COUNT(i.id)::int item_count
            FROM purchase_orders o
            LEFT JOIN customers c ON c.id=o.customer_id
            LEFT JOIN purchase_items i ON i.order_id=o.id
            ${whereClause}
            GROUP BY o.id, c.id
            ${paginationClause}
          `,
          dataParams,
        )
      ).rows;
      const total = (await pool.query(countQuery, params)).rows[0]?.total ?? rows.length;
      return json(res, 200, paginatedResult(rows, total, list));
    }

    if (route.startsWith("/api/orders/") && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/").pop());
      if (!Number.isInteger(id)) return fail(res, 422, "order id khÃ´ng há»£p lá»‡");
      const detail = await orderDetails(pool, id);
      if (!detail) return fail(res, 404, "KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng", "NOT_FOUND");
      return json(res, 200, detail);
    }

    if (route === "/api/orders" && req.method === "POST") {
      if (!guard(res, user, "admin")) return;
      const d = await readJsonBody(req);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await handleOrderCreate(c, user, d);
        if (!result.ok) {
          return rollbackAndFail(c, res, result.status, result.message);
        }
        await c.query("COMMIT");
        const created = await orderDetails(pool, result.orderId);
        return json(res, 201, created || { id: result.orderId, code: result.code, status: result.status, total_amount: result.total });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    if (route.startsWith("/api/orders/") && req.method === "PATCH") {
      if (!guard(res, user, "admin")) return;
      const id = Number(route.split("/").pop());
      if (!Number.isInteger(id)) return fail(res, 422, "order id không hợp lệ");
      const d = await readJsonBody(req);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const purchaseItemColumns = await getTableColumns(c, "purchase_items");
        const purchaseOrderColumns = await getTableColumns(c, "purchase_orders");
        const order = (await c.query("SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (!order) return rollbackAndFail(c, res, 404, "Không tìm thấy đơn hàng", "NOT_FOUND");
        if (d.status === "cancelled") {
          const cancelled = await cancelOrder(c, user, id, d.cancellation_reason);
          if (!cancelled.ok) {
            return rollbackAndFail(c, res, cancelled.status, cancelled.message);
          }
        } else if (d.items || d.customer_id || d.note !== undefined || d.status === "draft" || d.status === "completed") {
          if (order.status === "cancelled") return rollbackAndFail(c, res, 409, "Không thể cập nhật đơn đã hủy", "CONFLICT");
          if (order.status === "completed") return rollbackAndFail(c, res, 409, "Đơn đã hoàn tất chỉ được xem hoặc hủy", "CONFLICT");
          const newStatus = d.status === "draft" ? "draft" : d.status === "completed" ? "completed" : order.status;
          const nextCustomerId = d.customer_id !== undefined ? Number(d.customer_id) : order.customer_id;
          const customer = (await c.query("SELECT * FROM customers WHERE id=$1 FOR UPDATE", [nextCustomerId])).rows[0];
          if (!customer) return rollbackAndFail(c, res, 404, "Không tìm thấy khách hàng", "NOT_FOUND");
          const nextItems = d.items ? validateOrderItems(d.items) : { ok: true, value: null };
          if (!nextItems.ok) return rollbackAndFail(c, res, 422, nextItems.message);
          const nextCustomerDiscount = d.customer_discount_amount !== undefined
            ? normalizeOrderDiscount(d.customer_discount_amount)
            : normalizeOrderDiscount(order.customer_discount_amount);
          const nextCustomerDiscountPercent = d.customer_discount_percent !== undefined
            ? positiveNumber(d.customer_discount_percent)
            : positiveNumber(order.customer_discount_percent);
          const existingItems = (await c.query("SELECT * FROM purchase_items WHERE order_id=$1 FOR UPDATE", [id])).rows;
          if (order.status === "completed") {
            for (const item of existingItems) {
              await c.query("UPDATE inventory SET qty_kg=qty_kg-$1,updated_at=now() WHERE material_id=$2", [item.qty_kg, item.material_id]);
              await c.query("INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,created_by,note) VALUES($1,'out',$2,'purchase_order',$3,$4,$5)", [
                item.material_id,
                item.qty_kg,
                id,
                user.id,
                "Revert order before update",
              ]);
            }
          }
          await c.query("DELETE FROM purchase_items WHERE order_id=$1", [id]);
          let subtotal = 0;
          const items =
            nextItems.value ||
            existingItems.map((x) => ({
              material_id: x.material_id,
              qty_kg: Number(x.qty_kg),
              unit_price: Number(x.unit_price ?? x.price_snapshot ?? 0),
              price_per_kg: Number(x.unit_price ?? x.price_snapshot ?? 0),
              discount_amount: Number(x.discount_amount ?? x.line_discount_amount ?? 0),
            }));
          for (const item of items) {
            const material = await getMaterialById(c, item.material_id, { lock: true, withPrice: true });
            if (!material || !material.active || material.price_per_kg === null || material.price_per_kg === undefined) {
              return rollbackAndFail(c, res, 422, "Mặt hàng không hợp lệ hoặc chưa có giá");
            }
            const unitPrice = item.unit_price !== undefined
              ? Number(item.unit_price)
              : item.price_per_kg !== undefined
                ? Number(item.price_per_kg)
                : Number(material.price_per_kg);
            const grossAmount = Math.round(item.qty_kg * unitPrice);
            const discountAmount = Math.min(Math.max(Math.round(Number(item.discount_amount || 0)), 0), grossAmount);
            const amount = grossAmount - discountAmount;
            subtotal += amount;
            const columns = ["order_id", "material_id", "material_name_snapshot", "qty_kg", "unit_price", "line_amount"];
            const values = [id, material.id, material.name, item.qty_kg, unitPrice, amount];
            if (purchaseItemColumns.has("discount_amount")) {
              columns.push("discount_amount");
              values.push(discountAmount);
            }
            if (purchaseItemColumns.has("line_discount_amount")) {
              columns.push("line_discount_amount");
              values.push(discountAmount);
            }
            if (purchaseItemColumns.has("price_snapshot")) {
              columns.push("price_snapshot");
              values.push(unitPrice);
            }
            if (purchaseItemColumns.has("price_source")) {
              columns.push("price_source");
              values.push("transaction");
            }
            await c.query(
              `INSERT INTO purchase_items(${columns.join(",")}) VALUES(${columns.map((_, index) => `$${index + 1}`).join(",")})`,
              values,
            );
            if (newStatus === "completed") {
              await c.query("UPDATE inventory SET qty_kg=qty_kg+$1,updated_at=now() WHERE material_id=$2", [item.qty_kg, material.id]);
              await c.query("INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,created_by) VALUES($1,'in',$2,'purchase_order',$3,$4)", [
                material.id,
                item.qty_kg,
                id,
                user.id,
              ]);
            }
          }
          const total = Math.max(0, subtotal - nextCustomerDiscount);
          const orderValues = [customer.id, customer.name, customer.phone, newStatus, d.note !== undefined ? nonEmpty(d.note) : order.note, total, newStatus === "completed"];
          const orderUpdates = [
            "customer_id=$1",
            "customer_name_snapshot=$2",
            "customer_phone_snapshot=$3",
            "status=$4",
            "note=$5",
            "total_amount=$6",
            "completed_at=CASE WHEN $7 THEN now() ELSE NULL END",
          ];
          if (purchaseOrderColumns.has("customer_discount_amount")) {
            orderUpdates.push(`customer_discount_amount=$${orderValues.length + 1}`);
            orderValues.push(nextCustomerDiscount);
          }
          if (purchaseOrderColumns.has("customer_discount_percent")) {
            orderUpdates.push(`customer_discount_percent=$${orderValues.length + 1}`);
            orderValues.push(nextCustomerDiscountPercent === null ? 0 : Math.round(nextCustomerDiscountPercent));
          }
          orderValues.push(id);
          await c.query(
            `UPDATE purchase_orders SET ${orderUpdates.join(",")} WHERE id=$${orderValues.length}`,
            orderValues,
          );
          await audit(c, user.id, "update", "purchase_order", id, { status: newStatus, total, customer_discount_amount: nextCustomerDiscount });
        }
        await c.query("COMMIT");
        return json(res, 200, await orderDetails(pool, id));
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    if (route === "/api/inventory" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const list = parseListParams(url, 10, 100);
      const params = [];
      const where = ["m.active=true"];
      if (list.search) {
        params.push(`%${list.search}%`);
        where.push(`(m.name ILIKE $${params.length} OR m.code ILIKE $${params.length} OR m.group_name ILIKE $${params.length})`);
      }
      appendDateRange(where, params, "im.created_at", list.from, list.to);
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const countQuery = `SELECT COUNT(DISTINCT m.id)::int total FROM materials m LEFT JOIN inventory_movements im ON im.material_id=m.id ${whereClause}`;
      const dataParams = [...params];
      let paginationClause = "ORDER BY m.id";
      if (list.shouldPaginate) {
        dataParams.push(list.pageSize, list.offset);
        paginationClause += ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
      }
      const rows = (await pool.query(`
        SELECT m.*, COALESCE(i.qty_kg, 0) AS qty_kg, COALESCE(i.warning_kg, 1000) AS warning_kg,
               p.price_per_kg, p.effective_from
        FROM materials m
        LEFT JOIN inventory i ON i.material_id=m.id
        LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
        LEFT JOIN inventory_movements im ON im.material_id=m.id
        ${whereClause}
        GROUP BY m.id, i.qty_kg, i.warning_kg, p.price_per_kg, p.effective_from
        ${paginationClause}
      `, dataParams)).rows;
      const total = (await pool.query(countQuery, params)).rows[0]?.total ?? rows.length;
      return json(res, 200, paginatedResult(rows, total, list));
    }

    if (route.startsWith("/api/inventory/") && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const materialId = Number(route.split("/").pop());
      if (!Number.isInteger(materialId)) return fail(res, 422, "material id không hợp lệ");
      const material = (await pool.query(`
        SELECT m.*, COALESCE(i.qty_kg, 0) AS qty_kg, COALESCE(i.warning_kg, 1000) AS warning_kg,
               p.price_per_kg, p.effective_from
        FROM materials m
        LEFT JOIN inventory i ON i.material_id=m.id
        LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
        WHERE m.id=$1
      `, [materialId])).rows[0];
      if (!material) return fail(res, 404, "Không tìm thấy mặt hàng", "NOT_FOUND");
      const movements = (await pool.query(`
        SELECT im.id, im.type, im.qty_kg, im.ref_type, im.ref_id, im.note, im.created_at,
               COALESCE(po.code, so.code) AS order_code,
               COALESCE(po.status, 'completed') AS order_status,
               po.completed_at AS order_completed_at,
               COALESCE(c1.id, NULL) AS customer_id,
               COALESCE(c1.code, NULL) AS customer_code,
               COALESCE(c1.name, so.buyer_name) AS customer_name,
               COALESCE(c1.phone, so.buyer_phone) AS customer_phone,
               COALESCE(pi.unit_price, si.unit_price) AS unit_price,
               COALESCE(pi.line_amount, si.line_amount) AS line_amount
        FROM inventory_movements im
        LEFT JOIN purchase_orders po ON im.ref_type='purchase_order' AND po.id=im.ref_id
        LEFT JOIN purchase_items pi ON pi.order_id=po.id AND pi.material_id=im.material_id
        LEFT JOIN customers c1 ON c1.id=po.customer_id
        LEFT JOIN sales_orders so ON im.ref_type='sales_order' AND so.id=im.ref_id
        LEFT JOIN sales_items si ON si.sales_order_id=so.id AND si.material_id=im.material_id
        WHERE im.material_id=$1
        ORDER BY im.created_at DESC, im.id DESC
      `, [materialId])).rows;
      return json(res, 200, { ...material, movements });
    }

    if (route === "/api/reports/summary" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      // contract: FROM purchase_orders WHERE status='completed'
      // contract: FROM purchase_items i JOIN purchase_orders o ON o.id=i.order_id WHERE o.status='completed'
      const summary = (await pool.query(`
        SELECT
          COUNT(*)::int orders,
          COALESCE(SUM(total_amount), 0)::int total_amount,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int revenue,
          COUNT(*) FILTER (WHERE status = 'completed')::int completed_orders,
          COUNT(*) FILTER (WHERE status = 'draft')::int draft_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int cancelled_orders
        FROM purchase_orders
      `)).rows[0];
      const completed = (await pool.query(`
        SELECT
          COUNT(*)::int orders,
          COALESCE(SUM(total_amount), 0)::int total_amount
        FROM purchase_orders
        WHERE status = 'completed'
      `)).rows[0];
      const kg = (await pool.query(`
        SELECT COALESCE(SUM(i.qty_kg),0)::float total_kg
        FROM purchase_items i
        JOIN purchase_orders o ON o.id=i.order_id
        WHERE o.status='completed'
      `)).rows[0];
      const inventory = (await pool.query(`
        SELECT
          COALESCE(SUM(qty_kg),0)::float total_kg,
          COUNT(*)::int materials,
          COUNT(*) FILTER (WHERE qty_kg <= 0)::int low_stock
        FROM inventory
      `)).rows[0];
      const customers = (await pool.query("SELECT COUNT(*)::int customers FROM users WHERE role='customer' AND active=true")).rows[0];
      const inventoryValue = (await pool.query(`
        SELECT COALESCE(SUM(i.qty_kg * COALESCE(p.price_per_kg,0)),0)::int inventory_value
        FROM inventory i
        JOIN materials m ON m.id=i.material_id
        LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
        WHERE m.active=true
      `)).rows[0];
      const top =
        (await pool.query(
          "SELECT material_name_snapshot AS name,SUM(qty_kg)::float AS qty_kg FROM purchase_items i JOIN purchase_orders o ON o.id=i.order_id WHERE o.status='completed' GROUP BY material_id,material_name_snapshot ORDER BY qty_kg DESC LIMIT 1",
        )).rows[0] || null;
      const ordersByDay = (await pool.query(`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS orders,
               COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int AS total_amount
        FROM purchase_orders
        WHERE created_at >= now() - interval '7 days'
        GROUP BY 1
        ORDER BY 1
      `)).rows;
      const ordersByMonth = (await pool.query(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS orders,
               COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int AS total_amount
        FROM purchase_orders
        WHERE created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
        ORDER BY 1
      `)).rows;
      const revenueByMonth = (await pool.query(`
        SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') AS month,
               COALESCE(SUM(total_amount),0)::int AS revenue,
               COALESCE(SUM((SELECT COALESCE(SUM(qty_kg),0) FROM purchase_items i WHERE i.order_id=o.id)),0)::float AS total_kg
        FROM purchase_orders o
        WHERE status='completed' AND completed_at IS NOT NULL AND completed_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
        ORDER BY 1
      `)).rows;
      return json(res, 200, {
        ...summary,
        completed_orders_total: completed.orders,
        completed_total_amount: completed.total_amount,
        ...kg,
        inventory,
        ...inventoryValue,
        customers,
        cost: inventoryValue.inventory_value,
        top_material: top,
        orders_by_day: ordersByDay,
        orders_by_month: ordersByMonth,
        revenue_by_month: revenueByMonth,
      });
    }

    if (route === "/api/reports/inventory-flow" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const rows = (await pool.query(`
        SELECT material_id,code,name,group_name,total_in,total_out,closing_qty,inventory_qty,reconciliation_delta
        FROM inventory_flow_report ORDER BY name ASC
      `)).rows;
      return json(res, 200, { items: rows, total: rows.length });
    }

    if (route === "/api/audit-logs" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const list = parseListParams(url, 25, 100);
      const params = [];
      const where = [];
      if (list.search) {
        params.push(`%${list.search}%`);
        where.push(`(al.action ILIKE $${params.length} OR al.entity ILIKE $${params.length} OR COALESCE(u.name,'') ILIKE $${params.length})`);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const dataParams = [...params, list.pageSize, list.offset];
      const rows = (await pool.query(`
        SELECT al.id,al.action,al.entity,al.entity_id,al.metadata,al.created_at,
               u.name AS user_name,u.email AS user_email
        FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id
        ${whereClause}
        ORDER BY al.created_at DESC,al.id DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `, dataParams)).rows;
      const total = Number((await pool.query(`SELECT COUNT(*)::int total FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ${whereClause}`, params)).rows[0]?.total ?? rows.length);
      return json(res, 200, paginatedResult(rows, total, list));
    }

    if (route === "/api/reports/sales-margins" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const list = parseListParams(url, 25, 200);
      const params = [];
      const where = [];
      appendDateRange(where, params, "sm.sold_at", list.from, list.to);
      if (list.search) {
        params.push(`%${list.search}%`);
        where.push(`(sm.sales_code ILIKE $${params.length} OR sm.material_name_snapshot ILIKE $${params.length})`);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const dataParams = [...params];
      let paginationClause = "ORDER BY sm.sold_at DESC, sm.sales_item_id DESC";
      if (list.shouldPaginate) {
        dataParams.push(list.pageSize, list.offset);
        paginationClause += ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
      }
      const rows = (await pool.query(`SELECT sm.* FROM sales_margin_report sm ${whereClause} ${paginationClause}`, dataParams)).rows;
      const total = Number((await pool.query(`SELECT COUNT(*)::int total FROM sales_margin_report sm ${whereClause}`, params)).rows[0]?.total ?? rows.length);
      return json(res, 200, paginatedResult(rows, total, list));
    }

    if (route === "/api/reports/profit" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const range = parseDateRange(url);
      if (!range.ok) return fail(res, 422, range.message);
      const report = await buildProfitReport(pool, range.value);
      return json(res, 200, report);
    }

    if (route === "/api/reports/dashboard" && req.method === "GET") {
      if (!guard(res, user, "admin")) return;
      const snapshot = await (async () => {
        const summary = (await pool.query(`
          SELECT
            COUNT(*)::int orders,
            COALESCE(SUM(total_amount), 0)::int total_amount,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int revenue,
            COUNT(*) FILTER (WHERE status = 'completed')::int completed_orders,
            COUNT(*) FILTER (WHERE status = 'draft')::int draft_orders,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int cancelled_orders
          FROM purchase_orders
      `)).rows[0];
        const completed = (await pool.query(`
          SELECT COUNT(*)::int orders, COALESCE(SUM(total_amount), 0)::int total_amount
          FROM purchase_orders
          WHERE status = 'completed'
        `)).rows[0];
        const kg = (await pool.query(`
          SELECT COALESCE(SUM(i.qty_kg),0)::float total_kg
          FROM purchase_items i
          JOIN purchase_orders o ON o.id=i.order_id
          WHERE o.status='completed'
        `)).rows[0];
        const inventory = (await pool.query(`
          SELECT
            COALESCE(SUM(qty_kg),0)::float total_kg,
            COUNT(*)::int materials,
            COUNT(*) FILTER (WHERE qty_kg <= 0)::int low_stock
          FROM inventory
        `)).rows[0];
        const customers = (await pool.query("SELECT COUNT(*)::int customers FROM users WHERE role='customer' AND active=true")).rows[0];
        const inventoryValue = (await pool.query(`
          SELECT COALESCE(SUM(i.qty_kg * COALESCE(p.price_per_kg,0)),0)::int inventory_value
          FROM inventory i
          JOIN materials m ON m.id=i.material_id
          LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true
          WHERE m.active=true
        `)).rows[0];
      const top =
        (await pool.query(
            "SELECT material_name_snapshot AS name,SUM(qty_kg)::float AS qty_kg FROM purchase_items i JOIN purchase_orders o ON o.id=i.order_id WHERE o.status='completed' GROUP BY material_id,material_name_snapshot ORDER BY qty_kg DESC LIMIT 1",
          )).rows[0] || null;
        const ordersByDay = (await pool.query(`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int AS total_amount
          FROM purchase_orders
          WHERE created_at >= now() - interval '7 days'
          GROUP BY 1
          ORDER BY 1
        `)).rows;
        const ordersByMonth = (await pool.query(`
          SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0)::int AS total_amount
          FROM purchase_orders
          WHERE created_at >= date_trunc('month', now()) - interval '11 months'
          GROUP BY 1
          ORDER BY 1
        `)).rows;
        const revenueByMonth = (await pool.query(`
          SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') AS month,
                 COALESCE(SUM(total_amount),0)::int AS revenue,
                 COALESCE(SUM((SELECT COALESCE(SUM(qty_kg),0) FROM purchase_items i WHERE i.order_id=o.id)),0)::float AS total_kg
          FROM purchase_orders o
          WHERE status='completed' AND completed_at IS NOT NULL AND completed_at >= date_trunc('month', now()) - interval '11 months'
          GROUP BY 1
          ORDER BY 1
        `)).rows;
        return {
          ...summary,
          completed_orders_total: completed.orders,
          completed_total_amount: completed.total_amount,
          ...kg,
          inventory,
          ...inventoryValue,
          customers,
          cost: inventoryValue.inventory_value,
          top_material: top,
          orders_by_day: ordersByDay,
          orders_by_month: ordersByMonth,
          revenue_by_month: revenueByMonth,
        };
      })();
      return json(res, 200, snapshot);
    }

    return fail(res, 404, "Không tìm thấy endpoint", "NOT_FOUND");
  } catch (e) {
    console.error(e);
    return fail(res, e.status || 500, e.status ? e.message : "Lỗi máy chủ nội bộ", e.status ? "VALIDATION_ERROR" : "INTERNAL_ERROR");
  }
}

const port = Number(process.env.PORT || 4000);
await seed();
createServer(handler).listen(port, () => console.log(`Phe Lieu PostgreSQL backend listening on http://localhost:${port}`));
