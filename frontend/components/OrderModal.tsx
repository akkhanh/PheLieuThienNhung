import React, { useEffect, useMemo, useState } from "react";
import { adminApi, type Customer, type Material } from "../api/client";
import { Icon } from "./icons";

type OrderModalProps = {
  materials: Material[];
  customers: Customer[];
  onClose: () => void;
  onSuccess: () => void;
};

type OrderRow = {
  material_id: number;
  qty_kg: number;
  unit_price: number;
};

const formatMoney = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " đ";

const firstMaterial = (materials: Material[]) => ({
  material_id: materials[0]?.id || 1,
  unit_price: Number(materials[0]?.price_per_kg || 0),
});

export default function OrderModal({ materials, customers, onClose, onSuccess }: OrderModalProps) {
  const initialMaterial = firstMaterial(materials);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "guest">(customers[0]?.id ?? "guest");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([{ ...initialMaterial, qty_kg: 100 }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Materials may arrive after the form mounts. Fill the default price once
  // the list is available, without overwriting a price the user edited.
  useEffect(() => {
    if (!materials.length) return;
    setRows((prev) => prev.map((row) => {
      const selected = materials.find((material) => material.id === row.material_id);
      if (!selected || row.unit_price > 0) return row;
      return { ...row, unit_price: Number(selected.price_per_kg || 0) };
    }));
  }, [materials]);

  const total = useMemo(() => rows.reduce((sum, r) => sum + r.qty_kg * r.unit_price, 0), [rows]);

  const updateRow = <K extends keyof OrderRow>(index: number, field: K, value: OrderRow[K]) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
  };

  const handleMaterialChange = (index: number, materialId: number) => {
    const selected = materials.find((m) => m.id === materialId);
    setRows((prev) => prev.map((row, idx) => idx === index
      ? { ...row, material_id: materialId, unit_price: Number(selected?.price_per_kg || 0) }
      : row));
  };

  const handleAddRow = () => {
    const next = firstMaterial(materials);
    setRows((prev) => [...prev, { ...next, qty_kg: 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const guest = selectedCustomerId === "guest";
      await adminApi.createOrder({
        customer_id: guest ? null : Number(selectedCustomerId),
        customer_name: guest ? guestName.trim() : undefined,
        customer_phone: guest ? guestPhone.trim() : undefined,
        items: rows.map((r) => ({
          material_id: Number(r.material_id),
          qty_kg: Number(r.qty_kg),
          unit_price: Number(r.unit_price),
        })),
        note,
      });
      onSuccess();
    } catch (error: any) {
      alert("Lỗi khi tạo đơn hàng. Vui lòng thử lại!");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ animation: "fadeIn 0.4s ease-out" }}>
      <div
        className="panel-head"
        style={{
          marginBottom: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "20px",
        }}
      >
        <div>
          <span
            className="eyebrow"
            style={{
              display: "block",
              color: "var(--brand-blue)",
              fontSize: "11px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            LẬP HÓA ĐƠN MỚI
          </span>
          <h2 style={{ fontSize: "24px", fontWeight: "800", marginTop: "4px" }}>Phiếu thu mua phế liệu</h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Chọn khách hàng có sẵn hoặc nhập khách vãng lai, rồi chỉnh đơn giá theo từng dòng nếu cần.
          </p>
        </div>
        <button
          type="button"
          className="btn secondary new-order-back-button"
          onClick={onClose}
          style={{ border: "1px solid var(--border)", padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <Icon.Close className="w-4 h-4" /> Quay lại
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%", maxWidth: "none" }}>
        <div className="calc-field" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)" }}>Khách hàng</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value === "guest" ? "guest" : Number(e.target.value))}
            style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "15px", background: "var(--bg-primary)" }}
          >
            <option value="guest">Khách vãng lai</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - {c.phone}
              </option>
            ))}
          </select>
        </div>

        {selectedCustomerId === "guest" && (
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
            <div className="calc-field" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)" }}>Tên khách</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nhập tên khách"
                required
                style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "15px", background: "var(--bg-primary)" }}
              />
            </div>
            <div className="calc-field" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)" }}>Số điện thoại</label>
              <input
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                required
                style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "15px", background: "var(--bg-primary)" }}
              />
            </div>
          </div>
        )}

        <div className="modal-lines" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)" }}>Chi tiết mặt hàng thu mua</label>
          <div className="order-line-header" aria-hidden="true">
            <span>Mặt hàng</span><span>Khối lượng</span><span /> <span>Đơn giá</span><span /> <span>Thành tiền</span><span />
          </div>
          {rows.map((r, i) => {
            const lineAmount = r.qty_kg * r.unit_price;
            return (
              <div className="line" key={i}>
                <select value={r.material_id} onChange={(e) => handleMaterialChange(i, Number(e.target.value))}>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatMoney(m.price_per_kg)}/kg)
                    </option>
                  ))}
                </select>

                <input type="number" min="1" value={r.qty_kg} onChange={(e) => updateRow(i, "qty_kg", Number(e.target.value))} required />
                <span>kg</span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={r.unit_price}
                  onChange={(e) => updateRow(i, "unit_price", Number(e.target.value))}
                  aria-label="Đơn giá"
                  title="Đơn giá"
                />
                <span>đ/kg</span>

                <b style={{ whiteSpace: "nowrap" }}>{formatMoney(lineAmount)}</b>

                {rows.length > 1 ? (
                  <button
                    type="button"
                    style={{ color: "var(--danger)", background: "none", fontSize: "22px", padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", border: "0" }}
                    onClick={() => handleRemoveRow(i)}
                  >
                    ×
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>

        <button type="button" className="add-line" onClick={handleAddRow}>
          <Icon.Plus className="w-4 h-4" /> Thêm loại mặt hàng mới
        </button>

        <div className="calc-field" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)" }}>Ghi chú hóa đơn</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Tải lên xe tải nhỏ, bao bì gỗ..."
            style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "15px", background: "var(--bg-primary)" }}
          />
        </div>

        <div className="modal-total" style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-secondary)" }}>TỔNG THANH TOÁN CHO KHÁCH</span>
          <strong style={{ color: "var(--brand-blue)", fontSize: "28px", fontWeight: "900", whiteSpace: "nowrap" }}>{formatMoney(total)}</strong>
        </div>

        <button className="btn primary" type="submit" disabled={busy} style={{ padding: "16px", fontSize: "16px", fontWeight: "700", textTransform: "uppercase", width: "100%", marginTop: "12px" }}>
          {busy ? "Đang lưu đơn hàng..." : "Xác nhận & In hóa đơn →"}
        </button>
      </form>
    </div>
  );
}
