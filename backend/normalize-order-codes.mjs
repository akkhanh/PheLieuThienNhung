import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/phe_lieu" });

const sql = async (client, table, dateColumn, prefix) => {
  await client.query(`
    WITH numbered AS (
      SELECT id,
        to_char(${dateColumn}, 'DDMMYYYY') AS day_code,
        row_number() OVER (PARTITION BY date_trunc('day', ${dateColumn}) ORDER BY ${dateColumn}, id) AS sequence_no
      FROM ${table}
    )
    UPDATE ${table} target
    SET code = $1 || '_' || numbered.day_code || '_' || numbered.sequence_no
    FROM numbered
    WHERE target.id = numbered.id
  `, [prefix]);
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await sql(client, "purchase_orders", "created_at", "IN");
  await sql(client, "sales_orders", "sold_at", "OUT");
  await client.query("COMMIT");
  const result = await client.query(`
    SELECT 'purchase' AS type, code, created_at AS occurred_at FROM purchase_orders
    UNION ALL
    SELECT 'sale' AS type, code, sold_at AS occurred_at FROM sales_orders
    ORDER BY occurred_at, code
  `);
  console.table(result.rows);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
