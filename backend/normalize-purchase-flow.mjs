import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    UPDATE purchase_orders o
    SET status='completed',
        completed_at=COALESCE(o.completed_at, o.created_at, now()),
        cancellation_reason='',
        customer_name_snapshot=c.name,
        customer_phone_snapshot=c.phone
    FROM customers c
    WHERE c.id=o.customer_id
  `);
  await client.query("DELETE FROM inventory_movements WHERE ref_type='purchase_order'");
  await client.query(`
    INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,note,created_by,created_at)
    SELECT i.material_id,'in',i.qty_kg,'purchase_order',o.id,'Nhập kho từ đơn ' || o.code,o.created_by,COALESCE(o.completed_at,o.created_at)
    FROM purchase_orders o
    JOIN purchase_items i ON i.order_id=o.id
  `);
  await client.query(`
    INSERT INTO inventory(material_id,qty_kg,warning_kg,updated_at)
    SELECT m.id,
           GREATEST(0,
             COALESCE((SELECT SUM(pi.qty_kg) FROM purchase_items pi JOIN purchase_orders po ON po.id=pi.order_id WHERE pi.material_id=m.id AND po.status='completed'),0)
             - COALESCE((SELECT SUM(si.qty_kg) FROM sales_items si JOIN sales_orders so ON so.id=si.sales_order_id WHERE si.material_id=m.id),0)
           ),
           COALESCE((SELECT warning_kg FROM inventory old_i WHERE old_i.material_id=m.id),1000),
           now()
    FROM materials m
    ON CONFLICT(material_id) DO UPDATE SET qty_kg=EXCLUDED.qty_kg,updated_at=now()
  `);
  await client.query("COMMIT");
  const counts = (await client.query("SELECT status,COUNT(*)::int total FROM purchase_orders GROUP BY status ORDER BY status")).rows;
  console.log(counts);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
