import React from "react";
import {
  adminApi,
  type Customer,
  type PurchaseInvoice,
  type PurchaseOrder,
} from "../../api/client";
import { PaginationControls, useStablePagination } from "./pagination";
import { useAdminListRules } from "./listRules";

type OrdersViewProps = {
  orders: PurchaseOrder[];
  customers: Customer[] | { items?: Customer[] };
};

const PAGE_SIZE = 12;

const formatMoney = (n: number) =>
  `${new Intl.NumberFormat("vi-VN").format(n || 0)} đ`;
const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa cập nhật";

const normalizeText = (value?: string | null, fallback = "Chưa cập nhật") => {
  const text = value?.trim();
  return text ? text : fallback;
};

type OrderDisplaySource = {
  customer_name_snapshot?: string | null;
  customer_name?: string | null;
  customer_phone_snapshot?: string | null;
  customer_phone?: string | null;
};

function getDisplayName(order: OrderDisplaySource, customer?: Customer) {
  return normalizeText(
    order.customer_name_snapshot ?? order.customer_name ?? customer?.name,
    "Khách vãng lai",
  );
}

function getDisplayPhone(order: OrderDisplaySource, customer?: Customer) {
  return normalizeText(
    order.customer_phone_snapshot ?? order.customer_phone ?? customer?.phone,
  );
}

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
    <div
      onMouseDown={(event) => { const target = event.target as HTMLElement; if (target.tagName === "BUTTON") { event.preventDefault(); target.blur(); } }}
      style={{
        marginTop: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Tổng {total} đơn
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Trước
        </button>
        <span style={{ minWidth: 90, textAlign: "center", fontWeight: 700 }}>
          Trang {page}/{Math.max(totalPages, 1)}
        </span>
        <button className="btn secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Sau
        </button>
      </div>
    </div>
  );
}

export default function OrdersView({ customers }: OrdersViewProps) {
  const customerItems = Array.isArray(customers) ? customers : (customers?.items ?? []);
  const [rows, setRows] = React.useState<PurchaseOrder[]>([]);
  const listRules = useAdminListRules<"default" | "amount_desc" | "amount_asc">(PAGE_SIZE, "default");
  const { draft, page, setPage, updateDraft, apply: submitFilters, reset: resetFilters, query } = listRules;
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [selectedOrder, setSelectedOrder] = React.useState<PurchaseInvoice | null>(null);
  const [loadingId, setLoadingId] = React.useState<number | null>(null);
  const [detailError, setDetailError] = React.useState("");
  const [cancelMode, setCancelMode] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const changePage = useStablePagination(setPage, { page, itemCount: rows.length });

  React.useEffect(() => {
    let active = true;
    adminApi.orders(query)
      .then((result) => {
        if (!active) return;
        setRows(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);
      })
      .catch((error) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setDetailError(error instanceof Error ? error.message : "Không tải được danh sách đơn mua.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, refreshKey]);

  const openDetail = async (order: PurchaseOrder) => {
    setLoadingId(order.id);
    setDetailError("");
    try {
      const detail = await adminApi.invoice(order.code);
      setSelectedOrder(detail);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Không tải được chi tiết đơn mua.");
    } finally {
      setLoadingId(null);
    }
  };

  const submitCancellation = async () => {
    if (!selectedOrder || !cancelReason) return;
    setCancelling(true);
    try {
      await adminApi.cancelOrder(selectedOrder.id, cancelReason);
      setSelectedOrder(null);
      setCancelMode(false);
      setCancelReason("");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Không thể hủy đơn.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="panel table-panel">
      <div className="panel-head" style={{ alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2>Nhật ký đơn mua</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Lọc theo từ khóa và ngày để xem lịch sử đơn mua rõ hơn khi dữ liệu nhiều.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <input
          className="search"
          style={{ width: "100%", marginBottom: 0 }}
          value={draft.search}
          onChange={(event) => updateDraft("search", event.target.value)}
          placeholder="Tìm mã đơn, tên khách, số điện thoại..."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Từ ngày</label>
            <input type="date" value={draft.from} onChange={(event) => updateDraft("from", event.target.value)} className="search" style={{ width: "100%", marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Đến ngày</label>
            <input type="date" value={draft.to} onChange={(event) => updateDraft("to", event.target.value)} className="search" style={{ width: "100%", marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sắp xếp giá trị</label>
            <select value={draft.sort} onChange={(event) => updateDraft("sort", event.target.value as "default" | "amount_desc" | "amount_asc")} className="search" style={{ width: "100%", marginBottom: 0 }}>
              <option value="default">Mặc định</option>
              <option value="amount_desc">Giá trị cao đến thấp</option>
              <option value="amount_asc">Giá trị thấp đến cao</option>
            </select>
          </div>
          <button className="order-filter-button apply" onClick={submitFilters}>Lọc</button>
          <button className="order-filter-button reset" onClick={resetFilters}>Xóa lọc</button>
        </div>
      </div>

      {detailError && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3" }}>
          {detailError}
        </div>
      )}



      <div className="customer-pagination-bar">
        <span>Đang hiển thị <strong style={{ color: "var(--text-primary)" }}>{total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> trên tổng <strong style={{ color: "var(--text-primary)" }}>{total}</strong> đơn thu mua</span>
        <strong>Trang {page}/{Math.max(totalPages, 1)}</strong>
      </div>

      <div className="pagination-table-frame orders-pagination-frame">
      <table className="table orders-table">
        <thead>
          <tr className="tr th">
            <span>Mã đơn</span>
            <span>Khách hàng</span>
            <span>Thời gian</span>
            <span>Trạng thái</span>
            <span style={{ textAlign: "right" }}>Tổng giá trị</span>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                Đang tải dữ liệu...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                Không tìm thấy đơn mua nào.
              </td>
            </tr>
          ) : (
            rows.map((order) => {
              const customer = customerItems.find((item) => item.id === order.customer_id);
              const isLoading = loadingId === order.id;
              return (
                <tr
                  className="tr"
                  key={order.id}
                  onClick={() => void openDetail(order)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openDetail(order);
                    }
                  }}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <span><b className="order-no">{order.code}</b></span>
                  <span>
                    <b style={{ display: "block" }}>{getDisplayName(order, customer)}</b>
                    <small style={{ display: "block", marginTop: 4 }}>{getDisplayPhone(order, customer)}</small>
                  </span>
                  <span>{formatDateTime(order.completed_at ?? order.created_at)}</span>
                  <span>
                    <span className="status">
                      {isLoading ? "Đang tải..." : order.status === "completed" ? "Hoàn tất" : order.status === "cancelled" ? "Đã hủy" : "Nháp"}
                    </span>
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }}>{formatMoney(order.total_amount)}</span>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>

      <div className="orders-bottom-pagination">
        <PaginationControls page={page} totalPages={totalPages} total={total} label="Tổng {total} đơn" onPageChange={changePage} />
      </div>

      {selectedOrder && (
        <div
          className="purchase-invoice-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedOrder(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
        >
          <div
            className="purchase-invoice"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="purchase-invoice-header">
              <div>
                <div className="purchase-invoice-kicker">PHIẾU THU MUA PHẾ LIỆU</div>
                <h2>HÓA ĐƠN THU MUA</h2>
                <p>Số: <strong>{selectedOrder.code || selectedOrder.invoice_code}</strong></p>
              </div>
              <div className="purchase-invoice-header-side">
                <button type="button" className="invoice-full-button" onClick={() => { const code = selectedOrder.code || selectedOrder.invoice_code; if (code) window.open(`/invoice?code=${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer"); }}>Xem bản đầy đủ</button>
                {selectedOrder.status === "completed" && (
                  <div className="invoice-cancel-anchor">
                    <button type="button" className="invoice-cancel-button" onClick={() => setCancelMode((value) => !value)}>Hủy đơn</button>
                    {cancelMode && (
                      <div className="invoice-cancel-panel invoice-cancel-popover">
                        <div><strong>Chọn lý do hủy đơn</strong><small>Đơn đã hủy sẽ trừ lại hàng đã nhập khỏi tồn kho.</small></div>
                        <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
                          <option value="">— Chọn lý do —</option>
                          <option value="Nháp">Nháp</option>
                          <option value="Khách hàng yêu cầu hủy">Khách hàng yêu cầu hủy</option>
                          <option value="Sai thông tin đơn hàng">Sai thông tin đơn hàng</option>
                          <option value="Đơn hàng bị trùng">Đơn hàng bị trùng</option>
                          <option value="Lý do khác">Lý do khác</option>
                        </select>
                        <div className="invoice-cancel-actions">
                          <button type="button" onClick={() => { setCancelMode(false); setCancelReason(""); }}>Quay lại</button>
                          <button type="button" className="confirm" disabled={!cancelReason || cancelling} onClick={() => void submitCancellation()}>{cancelling ? "Đang hủy..." : "Xác nhận hủy"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <span className={`purchase-invoice-status ${selectedOrder.status}`}>{selectedOrder.status === "completed" ? "ĐÃ THANH TOÁN" : selectedOrder.status === "cancelled" ? "ĐÃ HỦY" : "CHƯA HOÀN TẤT"}</span>
                <button className="purchase-invoice-close" aria-label="Đóng" onClick={() => setSelectedOrder(null)}>×</button>
              </div>
            </div>

            <div className="purchase-invoice-parties">
              <div style={{ padding: 18, borderRadius: 16, background: "#f8fafc", border: "1px solid #e5e7eb" }}><div style={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Bên bán / điểm thu mua</div><strong style={{ display: "block", fontSize: 17 }}>Phelieu Recycling</strong><span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 13 }}>Hệ thống quản lý phế liệu</span></div>
              <div style={{ padding: 18, borderRadius: 16, background: "#f8fafc", border: "1px solid #e5e7eb" }}><div style={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Người bán hàng</div><strong style={{ display: "block", fontSize: 17 }}>{getDisplayName(selectedOrder)}</strong><span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 13 }}>{getDisplayPhone(selectedOrder)}</span></div>
              <div style={{ padding: 16, borderRadius: 14, background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", color: "#64748b", fontSize: 12, marginBottom: 6 }}>Ngày lập phiếu</span><strong>{formatDateTime(selectedOrder.created_at)}</strong><small style={{ display: "block", marginTop: 6, color: "#64748b" }}>Chốt giao dịch: {formatDateTime(selectedOrder.completed_at)}</small></div>
              <div style={{ padding: 16, borderRadius: 14, background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", color: "#64748b", fontSize: 12, marginBottom: 6 }}>Trạng thái thanh toán</span><strong style={{ color: selectedOrder.status === "completed" ? "#15803d" : "#b45309" }}>{selectedOrder.status === "completed" ? "Đã thanh toán" : selectedOrder.status}</strong><small style={{ display: "block", marginTop: 6, color: "#64748b" }}>Mã hóa đơn: {selectedOrder.code || selectedOrder.invoice_code}</small></div>
            </div>

            <div className="panel purchase-invoice-lines">
              <div className="panel-head" style={{ marginBottom: 12 }}>
                <div>
                  <h2 className="info-note-title">Bảng kê hàng hóa, dịch vụ</h2>
                  <div className="info-note">Đơn đã chốt chỉ xem chi tiết, không sửa trực tiếp tại đây.</div>
                </div>
              </div>

              <table className="table purchase-invoice-table">
                <thead>
                  <tr className="tr th">
                    <span>STT · Mặt hàng</span>
                    <span>Khối lượng</span>
                    <span>Đơn giá</span>
                    <span style={{ textAlign: "right" }}>Thành tiền</span>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, index) => (
                    <tr className="tr" key={`${selectedOrder.id}-${item.material_id ?? index}-${index}`}>
                      <span><b>{index + 1}. {normalizeText(item.material_name ?? item.material_name_snapshot, "Không rõ mặt hàng")}</b><small style={{ display: "block", marginTop: 4, color: "var(--text-muted)" }}>Hàng thu mua</small></span>
                      <span>{Number(item.qty_kg || 0).toLocaleString("vi-VN")} kg</span>
                      <span>{formatMoney(item.unit_price)}</span>
                      <span style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(item.line_amount)}</span>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="purchase-invoice-summary">
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 10 }}><span>Tạm tính</span><span>{formatMoney(selectedOrder.total_amount)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, fontWeight: 900 }}><span>TỔNG CỘNG</span><span style={{ color: "#2563eb" }}>{formatMoney(selectedOrder.total_amount)}</span></div>
              <div style={{ textAlign: "right", color: "#64748b", fontSize: 12, marginTop: 6 }}>Đã bao gồm các khoản điều chỉnh (nếu có)</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <span style={{ display: "block", color: "var(--text-muted)", marginBottom: 6 }}>Ghi chú</span>
              <div style={{ padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid rgba(148, 163, 184, 0.18)" }}>
                {normalizeText(selectedOrder.note, "Không có ghi chú")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
