import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS admin_visible BOOLEAN NOT NULL DEFAULT TRUE");
  const top = await client.query(`
    SELECT c.id
    FROM customers c
    JOIN purchase_orders o ON o.customer_id=c.id
    GROUP BY c.id
    ORDER BY COUNT(o.id) DESC, c.id DESC
    LIMIT 20
  `);
  const ids = top.rows.map((row) => row.id);
  await client.query("UPDATE customers SET admin_visible=false");
  if (ids.length) {
    await client.query("UPDATE customers SET admin_visible=true, address=CASE WHEN NULLIF(TRIM(address),'') IS NULL THEN 'TP. Hồ Chí Minh' ELSE address END WHERE id = ANY($1::bigint[])", [ids]);
  }
  await client.query("DELETE FROM inventory_movements WHERE ref_type='purchase_order' AND ref_id IN (SELECT id FROM purchase_orders WHERE customer_id <> ALL($1::bigint[]))", [ids]);
  await client.query("DELETE FROM purchase_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE customer_id <> ALL($1::bigint[]))", [ids]);
  await client.query("DELETE FROM purchase_orders WHERE customer_id <> ALL($1::bigint[])", [ids]);
  await client.query("DELETE FROM customers WHERE id <> ALL($1::bigint[])", [ids]);
  await client.query("COMMIT");
  console.log(`Kept exactly ${ids.length} customers and deleted all others.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
