CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','customer')), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS customers (id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, address TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS materials (id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, group_name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS prices (id BIGSERIAL PRIMARY KEY, material_id BIGINT NOT NULL REFERENCES materials(id), price_per_kg INTEGER NOT NULL CHECK (price_per_kg >= 0), effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ, is_current BOOLEAN NOT NULL DEFAULT TRUE, note TEXT NOT NULL DEFAULT '', created_by BIGINT REFERENCES users(id));
CREATE UNIQUE INDEX IF NOT EXISTS one_current_price ON prices(material_id) WHERE is_current;
CREATE TABLE IF NOT EXISTS purchase_orders (id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, customer_id BIGINT NOT NULL REFERENCES customers(id), customer_name_snapshot TEXT NOT NULL, customer_phone_snapshot TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','completed','cancelled')), total_amount INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_by BIGINT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS purchase_items (id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE, material_id BIGINT NOT NULL REFERENCES materials(id), material_name_snapshot TEXT NOT NULL, qty_kg NUMERIC(14,3) NOT NULL CHECK (qty_kg > 0), unit_price INTEGER NOT NULL CHECK (unit_price >= 0), line_amount INTEGER NOT NULL CHECK (line_amount >= 0));
CREATE TABLE IF NOT EXISTS inventory (material_id BIGINT PRIMARY KEY REFERENCES materials(id), qty_kg NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (qty_kg >= 0), warning_kg NUMERIC(14,3) NOT NULL DEFAULT 1000, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS inventory_movements (id BIGSERIAL PRIMARY KEY, material_id BIGINT NOT NULL REFERENCES materials(id), type TEXT NOT NULL CHECK (type IN ('in','out','adjust')), qty_kg NUMERIC(14,3) NOT NULL CHECK (qty_kg > 0), ref_type TEXT, ref_id BIGINT, note TEXT NOT NULL DEFAULT '', created_by BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id BIGINT, ip TEXT NOT NULL DEFAULT '', metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON purchase_orders(created_at); CREATE INDEX IF NOT EXISTS idx_items_material ON purchase_items(material_id); CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- Seed data: Thien Nhung Scrap Management
INSERT INTO users (name,email,password_hash,role) VALUES
('Thiên Nhung','admin@thiennhung.local','thiennhung-demo-salt:3a9062422cd4d2ca383f55d8b5a88a712445b8cef77b7b046b541d15606ddc018ed451068e9d0be929a071e13f582de8af3d23944cd0dcd3d328d4233cad70e3','admin'),
('Khách hàng Demo','customer@thiennhung.local','thiennhung-demo-salt:a4722d143bb528b59b1604ec4f8a66e7709cca96e91d4301857a9fd6893c3ece03c42d69a6a299a573ea12225bbf89a53cb630e7f978704fc1b557c1030899b2','customer')
ON CONFLICT (email) DO NOTHING;

INSERT INTO materials (code,name,group_name) VALUES
('sat','Sắt vụn','Kim loại'),('dong','Đồng đỏ','Kim loại'),('nhom','Nhôm','Kim loại'),('inox','Inox 304','Kim loại'),('giay','Giấy carton','Giấy'),('nhua','Nhựa tổng hợp','Nhựa')
ON CONFLICT (code) DO NOTHING;

INSERT INTO prices (material_id,price_per_kg,note,created_by)
SELECT m.id, v.price, 'Giá mẫu ban đầu', u.id FROM (VALUES
('sat',8200),('dong',182000),('nhom',46000),('inox',28500),('giay',4200),('nhua',9800)
) AS v(code,price) JOIN materials m ON m.code=v.code JOIN users u ON u.email='admin@thiennhung.local'
WHERE NOT EXISTS (SELECT 1 FROM prices p WHERE p.material_id=m.id AND p.is_current=true);

INSERT INTO inventory (material_id,qty_kg,warning_kg)
SELECT id, CASE code WHEN 'sat' THEN 2840 WHEN 'dong' THEN 420 WHEN 'nhom' THEN 780 WHEN 'inox' THEN 1260 WHEN 'giay' THEN 1650 ELSE 620 END, 1000 FROM materials
ON CONFLICT (material_id) DO NOTHING;

INSERT INTO customers (code,name,phone,address,note) VALUES
('KH-001','Nguyễn Văn Minh','0901234567','Quận 12, TP.HCM','Khách quen'),
('KH-002','Lê Thị Hương','0912345678','Gò Vấp, TP.HCM','Thu mua định kỳ'),
('KH-003','Trần Quốc Bảo','0933456789','Hóc Môn, TP.HCM','Khách mới')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO audit_logs (user_id,action,entity,metadata)
SELECT id,'seed','database','{"source":"database.postgres.sql"}'::jsonb FROM users WHERE email='admin@thiennhung.local';
DO $$
DECLARE admin_id BIGINT; customer_id BIGINT; order_id BIGINT; sat_id BIGINT; dong_id BIGINT; BEGIN
  SELECT id INTO admin_id FROM users WHERE email='admin@thiennhung.local';
  SELECT id INTO customer_id FROM customers WHERE code='KH-001';
  SELECT id INTO sat_id FROM materials WHERE code='sat';
  SELECT id INTO dong_id FROM materials WHERE code='dong';
  IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE code='MP-DEMO-001') THEN
    INSERT INTO purchase_orders(code,customer_id,customer_name_snapshot,customer_phone_snapshot,status,total_amount,note,created_by,completed_at)
    VALUES('MP-DEMO-001',customer_id,'Nguyễn Văn Minh','0901234567','completed',3136000,'Đơn mẫu để kiểm tra hệ thống',admin_id,now()-interval '1 day') RETURNING id INTO order_id;
    INSERT INTO purchase_items(order_id,material_id,material_name_snapshot,qty_kg,unit_price,line_amount) VALUES
    (order_id,sat_id,'Sắt vụn',200,8200,1640000),(order_id,dong_id,'Đồng đỏ',8,182000,1456000);
    INSERT INTO inventory_movements(material_id,type,qty_kg,ref_type,ref_id,created_by) VALUES
    (sat_id,'in',200,'purchase_order',order_id,admin_id),(dong_id,'in',8,'purchase_order',order_id,admin_id);
    UPDATE inventory SET qty_kg=qty_kg+200 WHERE material_id=sat_id;
    UPDATE inventory SET qty_kg=qty_kg+8 WHERE material_id=dong_id;
  END IF;
END $$;