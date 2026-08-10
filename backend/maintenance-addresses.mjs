import pg from "pg";

const addresses = [
  "12 Nguyễn Văn Quá, Phường Đông Hưng Thuận, Quận 12, TP. Hồ Chí Minh",
  "48 Phan Văn Trị, Phường 7, Quận Gò Vấp, TP. Hồ Chí Minh",
  "105 Lê Văn Khương, Phường Hiệp Thành, Quận 12, TP. Hồ Chí Minh",
  "76 Tô Ký, Xã Thới Tam Thôn, Huyện Hóc Môn, TP. Hồ Chí Minh",
  "31 Nguyễn Ảnh Thủ, Phường Trung Mỹ Tây, Quận 12, TP. Hồ Chí Minh",
  "89 Quốc lộ 1A, Phường Bình Hưng Hòa B, Quận Bình Tân, TP. Hồ Chí Minh",
  "22 Lũy Bán Bích, Phường Tân Thới Hòa, Quận Tân Phú, TP. Hồ Chí Minh",
  "154 Quang Trung, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh",
  "67 Hà Huy Giáp, Phường Thạnh Lộc, Quận 12, TP. Hồ Chí Minh",
  "93 Đặng Thúc Vịnh, Xã Đông Thạnh, Huyện Hóc Môn, TP. Hồ Chí Minh",
  "41 Nguyễn Oanh, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh",
  "118 Trường Chinh, Phường Tân Hưng Thuận, Quận 12, TP. Hồ Chí Minh",
  "56 Phạm Văn Chiêu, Phường 9, Quận Gò Vấp, TP. Hồ Chí Minh",
  "203 Lê Đức Thọ, Phường 16, Quận Gò Vấp, TP. Hồ Chí Minh",
  "35 Song Hành, Xã Trung Chánh, Huyện Hóc Môn, TP. Hồ Chí Minh",
  "72 Tây Thạnh, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh",
  "16 Dương Quảng Hàm, Phường 5, Quận Gò Vấp, TP. Hồ Chí Minh",
  "140 Nguyễn Thị Kiểu, Phường Tân Thới Hiệp, Quận 12, TP. Hồ Chí Minh",
  "28 Phan Huy Ích, Phường 15, Quận Tân Bình, TP. Hồ Chí Minh",
  "81 Võ Văn Vân, Xã Vĩnh Lộc B, Huyện Bình Chánh, TP. Hồ Chí Minh",
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const customers = (await client.query("SELECT id FROM customers ORDER BY id")).rows;
  for (let index = 0; index < customers.length; index += 1) {
    await client.query("UPDATE customers SET address=$1, updated_at=now() WHERE id=$2", [addresses[index % addresses.length], customers[index].id]);
  }
  await client.query("COMMIT");
  console.log(`Updated ${customers.length} customer addresses.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
