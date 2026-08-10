import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/phe_lieu" });

const people = [
  ["Nguyễn Thị Cúc", "0903123456", "48 Nguyễn Văn Quá, Đông Hưng Thuận, Quận 12, TP.HCM"],
  ["Trần Quốc Bảo", "0933456789", "125 Lê Văn Khương, Hiệp Thành, Quận 12, TP.HCM"],
  ["Lê Thị Hương", "0912345678", "22 Phan Văn Trị, Phường 10, Gò Vấp, TP.HCM"],
  ["Phạm Minh Tuấn", "0987654321", "17 Kha Vạn Cân, Linh Tây, Thủ Đức, TP.HCM"],
  ["Võ Thị Thanh", "0908765432", "63 Tô Ký, Tân Chánh Hiệp, Quận 12, TP.HCM"],
  ["Đỗ Hoàng Nam", "0978123456", "91 Trường Chinh, Tân Thới Nhất, Quận 12, TP.HCM"],
  ["Nguyễn Văn Hòa", "0923456789", "6A Nguyễn Ảnh Thủ, Trung Mỹ Tây, Quận 12, TP.HCM"],
  ["Bùi Thị Mai", "0965432109", "38 Nguyễn Oanh, Phường 17, Gò Vấp, TP.HCM"],
  ["Huỳnh Gia Khang", "0909988776", "14 Quốc lộ 13, Hiệp Bình Phước, Thủ Đức, TP.HCM"],
  ["Phan Thị Ngọc", "0945678123", "75 Hà Huy Giáp, Thạnh Lộc, Quận 12, TP.HCM"],
];

const buyers = [
  ["Công ty TNHH Tái Chế Sài Gòn", "02838224567"],
  ["Cơ sở Thu Mua Kim Loại Minh Phát", "0904556677"],
  ["Nhà máy Nhựa Xanh Việt", "0917888999"],
  ["Công ty Giấy Bao Bì Thành Công", "0938112233"],
];

const pad = (n) => String(n).padStart(2, "0");
const codeFor = async (c, table, column, date, prefix) => {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${column} >= $1 AND ${column} < $2`, [
    new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
  ]);
  return `${prefix}_${day}_${Number(r.rows[0].n) + 1}`;
};

const main = async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const admin = (await c.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")).rows[0];
    if (!admin) throw new Error("Chưa có tài khoản admin");

    const customerIds = [];
    for (let i = 0; i < people.length; i++) {
      const [name, phone, address] = people[i];
      const code = `DEMO-KH-${String(i + 1).padStart(3, "0")}`;
      const r = await c.query(
        `INSERT INTO customers(code,name,phone,address,note) VALUES($1,$2,$3,$4,'Khách hàng demo')
         ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address RETURNING id`,
        [code, name, phone, address],
      );
      customerIds.push(r.rows[0].id);
    }

    const materials = (await c.query("SELECT m.id,m.name,COALESCE(p.price_per_kg,0)::int AS buy_price FROM materials m LEFT JOIN prices p ON p.material_id=m.id AND p.is_current=true WHERE m.active=true ORDER BY m.id")).rows;
    if (materials.length < 3) throw new Error("Cần ít nhất 3 mặt hàng để seed");

    for (let i = 0; i < 18; i++) {
      const date = new Date(); date.setDate(date.getDate() - (i * 3 + 1)); date.setHours(9 + (i % 8), (i * 7) % 60, 0, 0);
      const customerId = customerIds[i % customerIds.length];
      const customer = (await c.query("SELECT name,phone FROM customers WHERE id=$1", [customerId])).rows[0];
      const code = await codeFor(c, "purchase_orders", "created_at", date, "IN");
      const order = (await c.query(`INSERT INTO purchase_orders(code,customer_id,customer_name_snapshot,customer_phone_snapshot,status,note,created_by,created_at,completed_at)
        VALUES($1,$2,$3,$4,'completed','Đơn demo nhập kho', $5,$6,$6) RETURNING id`, [code, customerId, customer.name, customer.phone, admin.id, date])).rows[0];
      let total = 0;
      for (let j = 0; j < 2 + (i % 2); j++) {
        const m = materials[(i + j) % materials.length];
        const qty = 20 + ((i * 13 + j * 17) % 90);
        const price = m.buy_price || 5000;
        const amount = qty * price; total += amount;
        await c.query("INSERT INTO purchase_items(order_id,material_id,material_name_snapshot,qty_kg,unit_price,line_amount) VALUES($1,$2,$3,$4,$5,$6)", [order.id, m.id, m.name, qty, price, amount]);
        await c.query("INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,created_by,created_at,note) VALUES($1,'in',$2,'purchase_order',$3,$4,$5,'Seed demo')", [m.id, qty, order.id, admin.id, date]);
        await c.query("UPDATE inventory SET qty_kg=qty_kg+$1 WHERE material_id=$2", [qty, m.id]);
      }
      await c.query("UPDATE purchase_orders SET total_amount=$1 WHERE id=$2", [total, order.id]);
    }

    for (let i = 0; i < 10; i++) {
      const date = new Date(); date.setDate(date.getDate() - (i * 4 + 2)); date.setHours(14 + (i % 5), (i * 11) % 60, 0, 0);
      const code = await codeFor(c, "sales_orders", "sold_at", date, "OUT");
      const buyer = buyers[i % buyers.length];
      const order = (await c.query("INSERT INTO sales_orders(code,buyer_name,buyer_phone,note,total_amount,sold_at,created_by,created_at) VALUES($1,$2,$3,'Giao dịch demo bán ra',0,$4,$5,$4) RETURNING id", [code, buyer[0], buyer[1], date, admin.id])).rows[0];
      let total = 0;
      for (let j = 0; j < 2; j++) {
        const m = materials[(i + j + 1) % materials.length];
        const qty = 8 + ((i * 5 + j * 9) % 28);
        const price = Math.round(Number(m.buy_price || 5000) * (1.25 + (i % 3) * 0.08));
        const amount = qty * price; total += amount;
        await c.query("INSERT INTO sales_items(sales_order_id,material_id,material_name_snapshot,qty_kg,unit_price,line_amount) VALUES($1,$2,$3,$4,$5,$6)", [order.id, m.id, m.name, qty, price, amount]);
        await c.query("INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,note,created_by,created_at) VALUES($1,'out',$2,'sales_order',$3,'Seed demo bán ra',$4,$5)", [m.id, qty, order.id, admin.id, date]);
        await c.query("UPDATE inventory SET qty_kg=GREATEST(0,qty_kg-$1) WHERE material_id=$2", [qty, m.id]);
      }
      await c.query("UPDATE sales_orders SET total_amount=$1 WHERE id=$2", [total, order.id]);
    }
    await c.query("COMMIT");
    console.log(`Seed hoàn tất: ${people.length} khách, 18 đơn mua, 10 đơn bán.`);
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); await pool.end(); }
};
main().catch((e) => { console.error(e); process.exitCode = 1; });
