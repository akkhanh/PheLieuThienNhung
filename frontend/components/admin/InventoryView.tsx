import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type InventoryDetail, type Material, type PurchaseInvoice, type SalesOrder } from "../../api/client";
import { Icon } from "../icons";
import { PaginationControls, useStablePagination } from "./pagination";

type InventoryViewProps = {
  materials: Material[];
  reload: () => Promise<void>;
  onOpenSales?: () => void;
};

const PAGE_SIZE = 10;

const formatKg = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatMoney = (value?: number | null) =>
  typeof value === "number" ? `${new Intl.NumberFormat("vi-VN").format(value)} đ` : "—";

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)" }}>Tổng {total} mặt hàng tồn kho</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Trước</button>
        <span style={{ minWidth: 90, textAlign: "center", fontWeight: 700 }}>Trang {page}/{Math.max(totalPages, 1)}</span>
        <button className="btn secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Sau</button>
      </div>
    </div>
  );
}

export default function InventoryView({ materials, reload, onOpenSales }: InventoryViewProps) {
  const [rows, setRows] = useState<Material[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleBuyer, setSaleBuyer] = useState("");
  const [salePhone, setSalePhone] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 16));
  const [saleNote, setSaleNote] = useState("");
  const [saleItems, setSaleItems] = useState([{ material_id: materials[0]?.id ?? 0, qty_kg: 1, unit_price: materials[0]?.price_per_kg ?? 0 }]);
  const [savingSale, setSavingSale] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<PurchaseInvoice | null>(null);
  const [linkedSale, setLinkedSale] = useState<SalesOrder | null>(null);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const changePage = useStablePagination(setPage, { page, itemCount: rows.length });

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.inventory({
        page,
        page_size: PAGE_SIZE,
        search,
        from,
        to,
      });
      setRows(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, search, from, to]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const availableMaterials = useMemo(
    () => materials.filter((item) => item.active !== false),
    [materials],
  );

  const groupedInventory = useMemo(() => {
    const map = new Map<string, { items: Material[]; totalValue: number; totalKg: number }>();
    for (const mat of rows) {
      const g = mat.group_name || "Mặt hàng khác";
      const qty = Number(mat.qty_kg ?? 0);
      const price = Number(mat.price_per_kg ?? 0);
      const val = qty * price;

      if (!map.has(g)) {
        map.set(g, { items: [], totalValue: 0, totalKg: 0 });
      }
      const group = map.get(g)!;
      group.items.push(mat);
      group.totalValue += val;
      group.totalKg += qty;
    }

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      items: data.items,
      totalValue: data.totalValue,
      totalKg: data.totalKg,
    }));
  }, [rows]);

  const totalStats = useMemo(() => {
    let totalValue = 0;
    let totalKg = 0;
    const inventoryMaterials = materials.filter((item) => item.active !== false);
    for (const mat of inventoryMaterials) {
      const qty = Number(mat.qty_kg ?? 0);
      const price = Number(mat.price_per_kg ?? 0);
      totalKg += qty;
      totalValue += qty * price;
    }
    return {
      totalValue,
      totalKg,
      count: inventoryMaterials.length,
    };
  }, [materials]);

  const openMovement = async (movement: InventoryDetail["movements"][number]) => {
    if (!movement.ref_id || (movement.ref_type === "purchase_order" && !movement.order_code)) return;
    setLoadingLinked(true);
    try {
      if (movement.ref_type === "sales_order") setLinkedSale(await adminApi.sale(Number(movement.ref_id)));
      else if (movement.ref_type === "purchase_order") setLinkedOrder(await adminApi.order(Number(movement.ref_id)));
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Không tải được chi tiết giao dịch.");
    } finally {
      setLoadingLinked(false);
    }
  };

  const openDetail = async (materialId: number) => {
    setDetailOpen(true);
    setLoadingDetail(true);
    setDetail(null);
    try {
      const response = await adminApi.inventoryDetail(materialId);
      setDetail(response);
    } catch {
      alert("Không tải được chi tiết tồn kho.");
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openSale = (materialId?: number) => {
    const firstMaterial = materialId ?? availableMaterials[0]?.id ?? 0;
    const current = availableMaterials.find((item) => item.id === firstMaterial);
    setSaleItems([{ material_id: firstMaterial, qty_kg: 1, unit_price: current?.price_per_kg ?? 0 }]);
    setSaleBuyer("");
    setSalePhone("");
    setSaleDate(new Date().toISOString().slice(0, 16));
    setSaleNote("");
    setSaleOpen(true);
  };

  const updateSaleItem = (index: number, field: "material_id" | "qty_kg" | "unit_price", value: number) => {
    setSaleItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "material_id") {
          const material = availableMaterials.find((entry) => entry.id === value);
          return { ...item, material_id: value, unit_price: material?.price_per_kg ?? item.unit_price };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const addSaleItem = () => {
    const fallback = availableMaterials[0];
    if (!fallback) return;
    setSaleItems((current) => [...current, { material_id: fallback.id, qty_kg: 1, unit_price: fallback.price_per_kg ?? 0 }]);
  };

  const removeSaleItem = (index: number) => {
    setSaleItems((current) => (current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const totalAmount = saleItems.reduce((sum, item) => sum + Number(item.qty_kg || 0) * Number(item.unit_price || 0), 0);

  const submitSale = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingSale(true);
    try {
      await adminApi.createSale({
        buyer_name: saleBuyer,
        buyer_phone: salePhone,
        sold_at: new Date(saleDate).toISOString(),
        note: saleNote,
        items: saleItems.map((item) => ({
          material_id: Number(item.material_id),
          qty_kg: Number(item.qty_kg),
          unit_price: Math.round(Number(item.unit_price)),
        })),
      });
      setSaleOpen(false);
      await reload();
      await loadInventory();
      onOpenSales?.();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Không tạo được phiếu bán ra.");
    } finally {
      setSavingSale(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Total Inventory Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="panel" style={{ padding: "20px 24px", borderRadius: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            TỔNG GIÁ TRỊ TỒN KHO
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
            {formatMoney(totalStats.totalValue)}
          </div>
        </div>

        <div className="panel" style={{ padding: "20px 24px", borderRadius: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            TỔNG KHỐI LƯỢNG
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
            {formatKg(totalStats.totalKg)} <span style={{ fontSize: 16, fontWeight: 700 }}>kg</span>
          </div>
        </div>

        <div className="panel" style={{ padding: "20px 24px", borderRadius: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            SỐ MẶT HÀNG
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
            {totalStats.count} <span style={{ fontSize: 16, fontWeight: 700 }}>mặt hàng</span>
          </div>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="panel-head" style={{ alignItems: "end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2>Tồn kho hiện có</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
              Tìm nhanh theo mã/tên hàng, lọc ngày và quản lý danh sách tồn kho gọn gàng.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={() => openSale()}>
            <Icon.Plus className="w-4 h-4" /> Xuất kho
          </button>
        </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Tìm theo tên, mã hoặc nhóm mặt hàng..."
          className="search"
          style={{ width: "100%", marginBottom: 0 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>TỪ NGÀY</label>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="search" style={{ width: "100%", marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>ĐẾN NGÀY</label>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="search" style={{ width: "100%", marginBottom: 0 }} />
          </div>
          <button type="button" className="order-filter-button apply" onClick={() => { setPage(1); setSearch(queryInput.trim()); }}>
            Lọc
          </button>
          <button type="button" className="order-filter-button reset" onClick={() => { setQueryInput(""); setSearch(""); setFrom(""); setTo(""); setPage(1); }}>
            Xóa lọc
          </button>
        </div>
      </div>

      <div className="pagination-table-frame" style={{ display: "grid", gap: 24 }}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", padding: 20, textAlign: "center" }}>Đang tải tồn kho...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 20, textAlign: "center" }}>Không tìm thấy mặt hàng phù hợp.</p>
        ) : (
          groupedInventory.map((group) => {
            return (
              <div key={group.name} style={{ display: "grid", gap: 12 }}>
                {/* Header of Group */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{group.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{group.items.length} mặt hàng</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                    {formatMoney(group.totalValue)}
                  </div>
                </div>

                {/* Container for Group Items */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    background: "#fff",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  {group.items.map((material, idx) => {
                    const qty = Number(material.qty_kg ?? 0);
                    const price = Number(material.price_per_kg ?? 0);
                    const estimatedValue = qty * price;

                    return (
                      <div
                        key={material.id}
                        className="inventory-item-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => void openDetail(material.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void openDetail(material.id);
                          }
                        }}
                        onMouseDown={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.tagName === "BUTTON") {
                            event.preventDefault();
                            target.blur();
                          }
                        }}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(220px, 2fr) minmax(140px, 1fr) minmax(200px, 1.5fr) 180px",
                          gap: 16,
                          alignItems: "center",
                          padding: "16px 20px",
                          borderBottom: idx < group.items.length - 1 ? "1px solid var(--border-light, #f1f5f9)" : "none",
                        }}
                      >
                        {/* Col 1: Material Name & Code */}
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{material.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                            {material.code} · {formatMoney(price)}/kg
                          </div>
                        </div>

                        {/* Col 2: Weight */}
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                            {formatKg(qty)} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{material.unit || "kg"}</span>
                          </div>
                        </div>

                        {/* Col 3: Valuation */}
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                            {formatMoney(estimatedValue)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                            Đơn giá: {formatMoney(price)}/kg
                          </div>
                        </div>

                        {/* Col 4: Action Buttons */}
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ padding: "7px 14px", fontSize: 13 }}
                            onClick={(event) => { event.stopPropagation(); void openDetail(material.id); }}
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            style={{ padding: "7px 14px", fontSize: 13 }}
                            onClick={(event) => { event.stopPropagation(); openSale(material.id); }}
                          >
                            Xuất kho
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <PaginationControls page={page} totalPages={totalPages} total={total} label="Tổng {total} mặt hàng tồn kho" onPageChange={changePage} />

      {detailOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 980, width: "min(980px, calc(100vw - 32px))" }}>
            <button type="button" className="close" onClick={() => setDetailOpen(false)}>
              <Icon.Close />
            </button>
            <h2>Truy xuất nguồn gốc tồn kho</h2>
            {loadingDetail || !detail ? (
              <p style={{ marginTop: 16, color: "var(--text-muted)" }}>Đang tải dữ liệu...</p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
                  <div style={{ background: "var(--surface-secondary)", borderRadius: 12, padding: 14 }}>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Mặt hàng</div>
                    <strong>{detail.name}</strong>
                  </div>
                  <div style={{ background: "var(--surface-secondary)", borderRadius: 12, padding: 14 }}>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Tồn hiện tại</div>
                    <strong>{formatKg(Number(detail.qty_kg ?? 0))} kg</strong>
                  </div>
                  <div style={{ background: "var(--surface-secondary)", borderRadius: 12, padding: 14 }}>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Giá mua hiện tại</div>
                    <strong>{formatMoney(detail.price_per_kg)}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                  <div><strong style={{ display: "block" }}>Đơn hàng hình thành tồn kho</strong><small style={{ color: "var(--text-muted)" }}>Bấm vào từng lần nhập để xem toàn bộ hóa đơn thu mua.</small></div>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{detail.movements.filter((movement) => movement.type === "in" && movement.ref_type === "purchase_order" && movement.order_code).length} đơn thu mua liên quan</span>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10, maxHeight: 420, overflow: "auto" }}>
                  {detail.movements.map((movement) => (
                    <div key={movement.id} onClick={() => movement.ref_type === "purchase_order" && movement.ref_id && movement.order_code ? void openMovement(movement) : undefined} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14, cursor: movement.ref_type === "purchase_order" && movement.ref_id && movement.order_code ? "pointer" : "default", background: movement.ref_type === "purchase_order" && movement.order_code ? "#fff" : "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <strong>{movement.type === "in" ? (movement.ref_type === "purchase_order" && movement.order_code ? "Nhập từ đơn thu mua" : "Nhập điều chỉnh — cần kiểm tra") : movement.ref_type === "sales_order" ? "Xuất bán ra" : "Xuất kho"}</strong>
                        <span>{new Date(movement.created_at).toLocaleString("vi-VN")}</span>
                      </div>
                      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Khối lượng</div>
                          <div>{formatKg(Number(movement.qty_kg ?? 0))} kg</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Khách hàng</div>
                          <div><strong>{movement.customer_name || "Không có"}</strong>{movement.customer_phone && <small style={{ display: "block", marginTop: 3, color: "var(--text-muted)" }}>{movement.customer_phone}</small>}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Mã tham chiếu</div>
                          <div>{movement.ref_type === "purchase_order" && movement.order_code ? <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); void openMovement(movement); }}>{movement.order_code} · Xem đơn thu mua</button> : <span style={{ color: "#b45309" }}>Không có đơn thu mua</span>}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Đơn giá</div>
                          <div>{formatMoney(movement.unit_price)}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Thành tiền</div>
                          <div><strong>{formatMoney(movement.line_amount)}</strong></div>
                        </div>
                      </div>
                      {movement.note && <div style={{ marginTop: 8, color: "var(--text-muted)" }}>{movement.note}</div>}
                    </div>
                  ))}
                  {detail.movements.length === 0 && <p style={{ color: "var(--text-muted)" }}>Chưa có lịch sử biến động.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {saleOpen && (
        <div className="modal-backdrop">
          <form onSubmit={submitSale} className="modal" style={{ maxWidth: 920, width: "min(920px, calc(100vw - 32px))" }}>
            <button type="button" className="close" onClick={() => setSaleOpen(false)}>
              <Icon.Close />
            </button>
            <h2>Tạo phiếu bán ra</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 18 }}>
              <div className="calc-field"><label>Người mua</label><input value={saleBuyer} onChange={(event) => setSaleBuyer(event.target.value)} required /></div>
              <div className="calc-field"><label>Số điện thoại</label><input value={salePhone} onChange={(event) => setSalePhone(event.target.value)} /></div>
              <div className="calc-field"><label>Ngày bán</label><input type="datetime-local" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} required /></div>
              <div className="calc-field"><label>Ghi chú</label><input value={saleNote} onChange={(event) => setSaleNote(event.target.value)} /></div>
            </div>
            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
              {saleItems.map((item, index) => (
                <div key={`${item.material_id}-${index}`} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr auto", gap: 10, alignItems: "end" }}>
                  <div className="calc-field">
                    <label>Mặt hàng</label>
                    <select value={item.material_id} onChange={(event) => updateSaleItem(index, "material_id", Number(event.target.value))}>
                      {availableMaterials.map((material) => (
                        <option key={material.id} value={material.id}>{material.name} ({formatKg(Number(material.qty_kg ?? 0))} kg)</option>
                      ))}
                    </select>
                  </div>
                  <div className="calc-field"><label>Số kg</label><input type="number" min="0.001" step="0.001" value={item.qty_kg} onChange={(event) => updateSaleItem(index, "qty_kg", Number(event.target.value))} /></div>
                  <div className="calc-field"><label>Giá bán/kg</label><input type="number" min="0" step="1" value={item.unit_price} onChange={(event) => updateSaleItem(index, "unit_price", Number(event.target.value))} /></div>
                  <button type="button" className="btn" onClick={() => removeSaleItem(index)}>Xóa</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={addSaleItem}><Icon.Plus className="w-4 h-4" /> Thêm mặt hàng</button>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Tổng bán ra: {formatMoney(totalAmount)}</div>
            </div>
            <button className="btn primary full" style={{ marginTop: 22 }} type="submit" disabled={savingSale}>
              {savingSale ? "Đang lưu..." : "Xác nhận xuất kho"}
            </button>
          </form>
        </div>
      )}

      {(linkedOrder || linkedSale || loadingLinked) && (
        <div className="modal-backdrop" onClick={() => { setLinkedOrder(null); setLinkedSale(null); }}>
          <div className="modal" style={{ maxWidth: 760, width: "min(760px, calc(100vw - 32px))" }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => { setLinkedOrder(null); setLinkedSale(null); }}><Icon.Close /></button>
            <h2>{linkedSale ? "Chi tiết bán ra" : "Chi tiết đơn mua"}</h2>
            {loadingLinked ? <p>Đang tải dữ liệu...</p> : (() => {
              const tx = linkedSale || linkedOrder;
              return tx ? (
                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid var(--border)" }}>
                    <div><small style={{ display: "block", color: "var(--text-muted)", marginBottom: 4 }}>Trạng thái đơn</small><strong>{"status" in tx ? (tx.status === "completed" ? "Đã hoàn tất" : tx.status) : "Đã hoàn tất"}</strong></div>
                    <div><small style={{ display: "block", color: "var(--text-muted)", marginBottom: 4 }}>Ngày chốt</small><strong>{"completed_at" in tx && tx.completed_at ? new Date(tx.completed_at).toLocaleString("vi-VN") : "Chưa chốt"}</strong></div>
                  </div>
                  <div><strong>Mã giao dịch:</strong> {"code" in tx ? tx.code : (tx as { invoice_code?: string }).invoice_code}</div>
                  <div><strong>Khách hàng/người mua:</strong> {"buyer_name" in tx ? tx.buyer_name : (tx as { customer_name?: string }).customer_name} {("buyer_phone" in tx ? tx.buyer_phone : (tx as { customer_phone?: string }).customer_phone) ? `(${("buyer_phone" in tx ? tx.buyer_phone : (tx as { customer_phone?: string }).customer_phone)})` : ""}</div>
                  <div><strong>Thời gian:</strong> {new Date("sold_at" in tx ? tx.sold_at : (tx as { created_at: string }).created_at).toLocaleString("vi-VN")}</div>
                  <div><strong>Tổng tiền:</strong> {formatMoney(Number(tx.total_amount || 0))}</div>
                  {linkedOrder && (linkedOrder.code || linkedOrder.invoice_code) && (
                    <button type="button" className="invoice-full-button" onClick={() => window.open(`/invoice?code=${encodeURIComponent(linkedOrder.code || linkedOrder.invoice_code || "")}`, "_blank", "noopener,noreferrer")}>Xem hóa đơn đầy đủ</button>
                  )}
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <strong>Toàn bộ hàng hóa trong đơn</strong>
                    {(tx.items || []).map((item: { material_name?: string; qty_kg?: number; unit_price?: number; line_amount?: number }, index: number) => (
                      <div key={index} style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                        {item.material_name} — {formatKg(Number(item.qty_kg))} kg × {formatMoney(Number(item.unit_price))} = {formatMoney(Number(item.line_amount))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
