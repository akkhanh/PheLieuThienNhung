import React, { useMemo, useState } from "react";
import { adminApi, type Material } from "../../api/client";

type Props = { materials: Material[]; reload: () => Promise<void> };
type EditState = { name: string; group_name: string; unit: string; price: string; is_public: boolean };

const groups = ["Kim loại", "Giấy", "Nhựa", "Điện tử", "Khác"];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

export default function PricesView({ materials, reload }: Props) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("Tất cả");
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => materials.filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query))
      && (group === "Tất cả" || item.group_name === group);
  }), [materials, search, group]);

  const openEdit = (item: Material) => {
    setEditing(item);
    setForm({ name: item.name, group_name: item.group_name, unit: item.unit || "kg", price: String(item.price_per_kg ?? 0), is_public: item.is_public !== false });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    try {
      await adminApi.updateMaterial(editing.id, { name: form.name.trim(), group_name: form.group_name.trim(), unit: form.unit.trim() || "kg", is_public: form.is_public });
      await adminApi.updatePrice(editing.id, Math.max(0, Math.round(Number(form.price))), { note: "Cập nhật từ Dashboard", is_public: form.is_public });
      setEditing(null);
      setForm(null);
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không cập nhật được mặt hàng.");
    } finally { setSaving(false); }
  };

  return <div className="panel table-panel prices-view">
    <div className="panel-head prices-head">
      <div><h2>Bảng giá thu mua hiện tại</h2><p>Cập nhật tên, nhóm, đơn giá và quyền hiển thị trên trang public.</p></div>
      <div className="prices-filters">
        <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc mã..." />
        <select className="search" value={group} onChange={(e) => setGroup(e.target.value)}><option>Tất cả</option>{groups.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
    </div>
    <div className="price-table-wrap"><table className="table"><thead><tr className="tr th"><span>Mặt hàng</span><span>Nhóm phân loại</span><span>Đơn giá</span><span>Public</span><span>Thao tác</span></tr></thead>
      <tbody>{rows.map((item) => <tr className="tr" key={item.id}>
        <span><b>{item.name}</b><small className="material-code">{item.code}</small></span>
        <span>{item.group_name}</span><span><b>{money(Number(item.price_per_kg || 0))}</b><small>/{item.unit || "kg"}</small></span>
        <span><span className={`pill ${item.is_public === false ? "muted-pill" : "public-pill"}`}>{item.is_public === false ? "Ẩn" : "Đang hiện"}</span></span>
        <span><button className="btn primary compact-btn" onClick={() => openEdit(item)}>Cập nhật</button></span>
      </tr>)}</tbody>
    </table></div>
    {editing && form && <div className="modal-backdrop"><form className="modal edit-material-modal" onSubmit={save}>
      <button type="button" className="close" onClick={() => setEditing(null)}>×</button><div className="eyebrow">CẬP NHẬT MẶT HÀNG</div><h2>{editing.name}</h2>
      <div className="edit-material-grid"><label>Tên mặt hàng<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Nhóm phân loại<select value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })}>{groups.map((item) => <option key={item}>{item}</option>)}</select></label><label>Đơn giá thu mua<input type="text" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9]/g, "") })} required /></label><label>Đơn vị<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label></div>
      <label className="public-toggle"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /><span>Đồng ý hiển thị mặt hàng này trên trang public</span></label>
      <button className="btn primary full" disabled={saving}>{saving ? "Đang lưu..." : "Lưu cập nhật"}</button>
    </form></div>}
  </div>;
}
