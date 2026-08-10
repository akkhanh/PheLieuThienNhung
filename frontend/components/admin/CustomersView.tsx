import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  adminApi,
  type Customer,
  type CustomerOrdersResponse,
} from "../../api/client";
import { Icon } from "../icons";
import { useAdminListRules } from "./listRules";

type CustomersViewProps = {
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  reload: () => Promise<void>;
};

type CustomerFormState = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

type CustomerAccountState = {
  email: string;
  password: string;
};

type CustomerDetailCustomer = Customer & {
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  user_active?: boolean | null;
};

type CustomerOrdersDetail = Omit<CustomerOrdersResponse, "customer"> & {
  customer: CustomerDetailCustomer;
};

type CustomerAccountResult = {
  customer: CustomerDetailCustomer;
  user: {
    id: number;
    name: string;
    email: string;
    role: "customer";
    active: boolean;
  };
  created: boolean;
  linked: boolean;
  temp_password?: string;
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const normalizeText = (value?: string | null, fallback = "Chưa cập nhật") => {
  const text = value?.trim();
  return text ? text : fallback;
};

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
    <div onMouseDown={(event) => { const target = event.target as HTMLElement; if (target.tagName === "BUTTON") { event.preventDefault(); target.blur(); } }} style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)" }}>Tổng {total} khách hàng</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="customer-page-button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>← Trước</button>
        <span style={{ minWidth: 90, textAlign: "center", fontWeight: 700 }}>Trang {page}/{Math.max(totalPages, 1)}</span>
        <button className="customer-page-button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Sau →</button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

const emptyForm = (): CustomerFormState => ({
  name: "",
  phone: "",
  address: "",
  note: "",
});

const formatMoney = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(n) + " đ";

export default function CustomersView({
  customers,
  setCustomers,
  reload,
}: CustomersViewProps) {
  const [rows, setRows] = useState<Customer[]>([]);
  const listRules = useAdminListRules<"default" | "customer_amount_desc" | "customer_amount_asc">(PAGE_SIZE, "default");
  const { draft, page, setPage, updateDraft, apply: submitFilters, reset: resetFilters, query } = listRules;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailData, setDetailData] = useState<CustomerOrdersDetail | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderLoadingId, setOrderLoadingId] = useState<number | null>(null);
  const [orderDetailError, setOrderDetailError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [accountForm, setAccountForm] = useState<CustomerAccountState>({ email: "", password: "" });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.customers(query);
      setRows(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (err: any) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(err?.message || "Không tải được danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setError("");
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      note: customer.note ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const loadCustomerDetail = async (customerId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    try {
      const data = await adminApi.customerOrders(customerId) as CustomerOrdersDetail;
      setDetailData(data);
      setAccountError("");
      setAccountNotice("");
      setAccountForm({
        email: data.customer.user_email || `kh-${data.customer.phone || data.customer.id}@thiennhung.local`,
        password: "",
      });
    } catch (err: unknown) {
      setDetailData(null);
      setDetailError(err instanceof Error ? err.message : "Không thể tải chi tiết khách hàng");
    } finally {
      setDetailLoading(false);
    }
  };

  const openOrderDetail = async (order: { id: number; code: string; status: string }) => {
    setOrderLoadingId(order.id);
    setOrderDetailError("");
    try {
      const detail = await adminApi.invoice(order.code);
      setDetailOpen(false);
      setSelectedOrder(detail);
    } catch (err: unknown) {
      setOrderDetailError(err instanceof Error ? err.message : "Không tải được chi tiết đơn hàng.");
    } finally {
      setOrderLoadingId(null);
    }
  };

  const openAccountForm = () => {
    if (!detailData) return;
    setAccountError("");
    setAccountNotice("");
    setAccountForm({
      email: detailData.customer.user_email || `kh-${detailData.customer.phone || detailData.customer.id}@thiennhung.local`,
      password: "",
    });
    setAccountOpen(true);
  };

  const submitAccountForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailData) return;

    setAccountSaving(true);
    setAccountError("");
    setAccountNotice("");

    try {
      const response = await api<CustomerAccountResult>(`/api/customers/${detailData.customer.id}/account`, {
        method: "POST",
        body: JSON.stringify({
          email: accountForm.email.trim(),
          ...(accountForm.password.trim() ? { password: accountForm.password.trim() } : {}),
        }),
      });
      setAccountNotice(
        response.created
          ? `Đã tạo tài khoản ${response.user.email}${response.temp_password ? ` · Mật khẩu tạm: ${response.temp_password}` : ""}`
          : `Đã cập nhật / gán tài khoản ${response.user.email}`,
      );
      setAccountOpen(false);
      await loadCustomerDetail(Number(detailData.customer.id));
      await reload();
    } catch (err: unknown) {
      setAccountError(err instanceof Error ? err.message : "Không thể tạo hoặc gán tài khoản");
    } finally {
      setAccountSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const note = form.note.trim();

    if (!name || !phone) {
      setError("Họ tên và Số điện thoại là bắt buộc.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = { name, phone, address, note };

      if (editingId) {
        await adminApi.updateCustomer(editingId, payload);
      } else {
        await adminApi.createCustomer(payload);
      }
      resetForm();
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (editingId ? "Không thể cập nhật khách hàng" : "Không thể thêm khách hàng"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const ok = window.confirm(`Xóa khách hàng "${customer.name}"?\nNếu khách đã có đơn hàng, hệ thống sẽ không cho xóa.`);
    if (!ok) return;
    try {
      await adminApi.deleteCustomer(customer.id);
      setCustomers(customers.filter((item) => item.id !== customer.id));
      if (detailData?.customer.id === customer.id) {
        setDetailOpen(false);
        setDetailData(null);
      }
      await reload();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Không thể xóa khách hàng");
    }
  };

  return (
    <div className="panel table-panel">
      <div className="panel-head" style={{ alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2>Danh sách khách hàng đối tác</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Phân trang và lọc ngày giúp quản lý danh sách khách hàng lớn gọn hơn.</p>
        </div>
        <button className="btn primary" onClick={openCreateForm}>
          <Icon.Plus className="w-4 h-4" /> Thêm khách hàng
        </button>
      </div>

      {showForm && (
        <div className="customer-form-backdrop" onClick={resetForm}>
          <form onSubmit={handleSubmit} className="panel customer-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="customer-form-header">
              <div className="customer-form-heading">
                <div className="customer-form-icon">{form.name.trim().charAt(0).toUpperCase() || "+"}</div>
                <div>
                  <span>{editingId ? "CHỈNH SỬA HỒ SƠ" : "HỒ SƠ ĐỐI TÁC MỚI"}</span>
                  <h3>{editingId ? "Cập nhật khách hàng" : "Thêm khách hàng"}</h3>
                  <p>{editingId ? "Điều chỉnh thông tin liên hệ và ghi chú khách hàng." : "Nhập đầy đủ thông tin để tạo hồ sơ khách hàng."}</p>
                </div>
              </div>
              <button type="button" className="purchase-invoice-close" aria-label="Đóng" onClick={resetForm}>×</button>
            </div>
            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
            <div className="customer-form-grid">
              <div className="calc-field">
                <label>Họ và tên <em>*</em></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Nguyễn Văn A" required />
                <small>Tên đầy đủ của khách hàng hoặc người đại diện.</small>
              </div>
              <div className="calc-field">
                <label>Số điện thoại <em>*</em></label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ví dụ: 0901234567" required />
                <small>Dùng để nhận diện khách và liên hệ giao dịch.</small>
              </div>
            </div>
            <div className="calc-field customer-form-wide">
              <label>Địa chỉ</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
              <small>Ghi địa chỉ đầy đủ để thuận tiện điều phối thu mua.</small>
            </div>
            <div className="calc-field customer-form-wide">
              <label>Ghi chú</label>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Khách quen, lưu ý thanh toán..." rows={3} />
            </div>
            <div className="customer-form-footer">
              <span><strong>*</strong> Thông tin bắt buộc</span>
              <div>
                <button className="customer-form-cancel" type="button" onClick={resetForm} disabled={saving}>Hủy bỏ</button>
                <button className="customer-form-save" type="submit" disabled={saving}>{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo khách hàng"}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <input className="search" style={{ width: "100%", marginBottom: 0 }} placeholder="Tìm theo tên, mã hoặc số điện thoại..." value={draft.search} onChange={(e) => updateDraft("search", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Từ ngày</label>
            <input type="date" value={draft.from} onChange={(e) => updateDraft("from", e.target.value)} className="search" style={{ width: "100%", marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Đến ngày</label>
            <input type="date" value={draft.to} onChange={(e) => updateDraft("to", e.target.value)} className="search" style={{ width: "100%", marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sắp xếp khách hàng</label>
            <select value={draft.sort} onChange={(event) => updateDraft("sort", event.target.value as "default" | "customer_amount_desc" | "customer_amount_asc")} className="search" style={{ width: "100%", marginBottom: 0 }}>
              <option value="default">Mặc định</option>
              <option value="customer_amount_desc">Giao dịch cao đến thấp</option>
              <option value="customer_amount_asc">Giao dịch thấp đến cao</option>
            </select>
          </div>
          <button className="order-filter-button apply" onClick={submitFilters}>Lọc</button>
          <button className="order-filter-button reset" onClick={resetFilters}>Xóa lọc</button>
        </div>
      </div>



      <div className="customer-pagination-bar">
        <span>Đang hiển thị <strong style={{ color: "var(--text-primary)" }}>{total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> trên tổng <strong style={{ color: "var(--text-primary)" }}>{total}</strong> khách hàng</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="customer-page-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</button>
          <strong>Trang {page}/{Math.max(totalPages, 1)}</strong>
          <button className="customer-page-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sau →</button>
        </div>
      </div>

      <div className="pagination-table-frame">
      <table className="table customer-table">
        <thead>
          <tr className="tr th" style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.2fr 0.8fr 1fr 1.8fr", gap: 16, alignItems: "center" }}>
            <span>Khách hàng</span>
            <span>Số điện thoại</span>
            <span>Địa chỉ</span>
            <span>Số đơn bán</span>
            <span style={{ textAlign: "right" }}>Tổng đã hoàn tất</span>
            <span style={{ textAlign: "right" }}>Thao tác</span>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Đang tải dữ liệu...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Không tìm thấy khách hàng phù hợp.</td></tr>
          ) : (
            rows.map((c) => (
              <tr className="tr customer-row" key={c.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.2fr 0.8fr 1fr 1.8fr", gap: 16, alignItems: "center" }}>
                <span><button type="button" onClick={() => loadCustomerDetail(c.id)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}><b>{c.name}</b></button></span>
                <span>{c.phone}</span>
                <span>{c.address || "Chưa cập nhật"}</span>
               <span>{c.orders ?? 0} đơn</span>
               <span style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(c.total_amount ?? 0)}</span>
                <span className="customer-actions">
                  <button type="button" className="customer-action view" onClick={() => loadCustomerDetail(c.id)}>Xem</button>
                  <button type="button" className="customer-action edit" onClick={() => openEditForm(c)}>Sửa</button>
                  <button type="button" className="customer-action delete" onClick={() => handleDelete(c)}>Xóa</button>
                </span>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {detailOpen && (
        <div className="customer-detail-backdrop" onClick={() => setDetailOpen(false)}>
          <div className="panel customer-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="customer-detail-header">
              <div className="customer-detail-heading">
                <div className="customer-detail-avatar">{detailData?.customer.name?.trim().charAt(0).toUpperCase() || "K"}</div>
                <div>
                  <span className="customer-detail-kicker">HỒ SƠ ĐỐI TÁC</span>
                  <h2>{detailData?.customer.name || "Chi tiết khách hàng"}</h2>
                  <p>{detailData?.customer.code || "Khách hàng"} · {detailData?.orders.length || 0} đơn giao dịch</p>
                </div>
              </div>
              <button type="button" className="purchase-invoice-close" aria-label="Đóng" onClick={() => setDetailOpen(false)}>×</button>
            </div>
            {detailLoading && <div>Đang tải dữ liệu...</div>}
            {!detailLoading && detailError && <div className="login-error">{detailError}</div>}
            {!detailLoading && !detailError && detailData && (
              <>
                <div className="customer-detail-stats">
                  <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Tên khách</span>
                    <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>{detailData.customer.name}</strong>
                  </div>
                  <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Số điện thoại</span>
                    <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>{detailData.customer.phone}</strong>
                  </div>
                  <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Địa chỉ</span>
                    <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>{detailData.customer.address || "Chưa cập nhật"}</strong>
                  </div>
                  <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Tổng đã hoàn tất</span>
                     <strong style={{ fontSize: 18, color: "var(--brand-blue)" }}>{formatMoney(detailData.customer.total_amount ?? 0)}</strong>
                  </div>
                </div>
                <div className="customer-detail-note">
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Ghi chú</span>
                  <div style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500 }}>{detailData.customer.note || "Không có ghi chú"}</div>
                </div>
                <div className="customer-history-heading">
                  <h3 style={{ marginBottom: 4 }}>Lịch sử đơn hàng</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>Tổng cộng {detailData.orders.length} đơn. Bấm vào từng dòng để xem chi tiết hóa đơn.</p>
                </div>
                <div className="customer-account-card">
                  <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Tài khoản</span>
                    <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>
                      {detailData.customer.user_id ? (detailData.customer.user_email || "Đã liên kết") : "Chưa có tài khoản"}
                    </strong>
                    <small style={{ display: "block", marginTop: 4, color: "var(--text-muted)" }}>
                      {detailData.customer.user_id ? (detailData.customer.user_active ? "Đang hoạt động" : "Đã tạm khóa") : "Có thể tạo hoặc gán tài khoản đăng nhập ngay"}
                    </small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <button type="button" className="btn primary" onClick={openAccountForm} style={{ minHeight: 56 }}>
                      {detailData.customer.user_id ? "Đổi / gán lại tài khoản" : "Tạo tài khoản"}
                    </button>
                  </div>
                </div>
                {orderDetailError && <div className="login-error" style={{ marginBottom: 16 }}>{orderDetailError}</div>}
                <div className="customer-history-table-wrap"><table className="table customer-history-table">
                  <thead>
                    <tr className="tr th" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr 1.5fr 1.2fr", gap: 12, alignItems: "center" }}>
                      <span>Mã đơn</span>
                      <span>Trạng thái</span>
                      <span>Thời gian</span>
                      <span>Số mặt hàng</span>
                      <span>Ghi chú</span>
                      <span style={{ textAlign: "right" }}>Tổng tiền</span>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.orders.map((order) => {
                      const isOrderLoading = orderLoadingId === order.id;
                      return (
                        <tr
                          className="tr customer-order-row"
                          key={order.id}
                          style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr 1.5fr 1.2fr", gap: 12, alignItems: "center", cursor: "pointer" }}
                          onClick={() => void openOrderDetail(order)}
                        >
                          <span><b className="order-no">{order.code}</b></span>
                          <span><span className="status">{isOrderLoading ? "Đang tải..." : order.status === "completed" ? "Hoàn tất" : order.status === "cancelled" ? "Đã hủy" : "Nháp"}</span></span>
                          <span>{formatDateTime(order.completed_at || order.created_at)}</span>
                           <span>{order.item_count ?? 0} loại</span>
                          <span>{order.note || "Không có"}</span>
                           <span style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(order.total_amount ?? 0)}</span>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="purchase-invoice-backdrop" role="dialog" aria-modal="true" onClick={() => { setSelectedOrder(null); setDetailOpen(true); }} style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="purchase-invoice" onClick={(event) => event.stopPropagation()}>
            <div className="purchase-invoice-header">
              <div>
                <div className="purchase-invoice-kicker">PHIẾU THU MUA PHẾ LIỆU</div>
                <h2>HÓA ĐƠN THU MUA</h2>
                <p>Số: <strong>{selectedOrder.code || selectedOrder.invoice_code}</strong></p>
              </div>
              <div className="purchase-invoice-header-side">
                <button type="button" className="invoice-full-button" onClick={() => { const code = selectedOrder.code || selectedOrder.invoice_code; if (code) window.open(`/invoice?code=${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer"); }}>Xem bản đầy đủ</button>
                <span className={`purchase-invoice-status ${selectedOrder.status}`}>{selectedOrder.status === "completed" ? "ĐÃ THANH TOÁN" : selectedOrder.status === "cancelled" ? "ĐÃ HỦY" : "CHƯA HOÀN TẤT"}</span>
                <button className="purchase-invoice-close" aria-label="Đóng" onClick={() => { setSelectedOrder(null); setDetailOpen(true); }}>×</button>
              </div>
            </div>
            <div className="purchase-invoice-parties">
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}><span style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>BÊN MUA / ĐIỂM THU MUA</span><strong>Phế Liệu Thiên Nhung</strong><small style={{ display: "block", marginTop: 6, color: "#64748b" }}>Hệ thống quản lý phế liệu</small></div>
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}><span style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>NGƯỜI BÁN HÀNG</span><strong>{normalizeText(selectedOrder.customer_name_snapshot || selectedOrder.customer_name || "Khách vãng lai")}</strong><small style={{ display: "block", marginTop: 6, color: "#64748b" }}>{normalizeText(selectedOrder.customer_phone_snapshot || selectedOrder.customer_phone || "")}</small></div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", color: "#64748b", fontSize: 12, marginBottom: 6 }}>Ngày lập phiếu</span><strong>{formatDateTime(selectedOrder.created_at)}</strong><small style={{ display: "block", marginTop: 6, color: "#64748b" }}>Ngày chốt: {formatDateTime(selectedOrder.completed_at)}</small></div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", color: "#64748b", fontSize: 12, marginBottom: 6 }}>Tổng thanh toán</span><strong style={{ color: "#2563eb", fontSize: 19 }}>{formatMoney(selectedOrder.total_amount)}</strong><small style={{ display: "block", marginTop: 6, color: "#64748b" }}>{selectedOrder.items.length} mặt hàng</small></div>
            </div>
            <div className="panel purchase-invoice-lines">
              <div className="panel-head" style={{ marginBottom: 12 }}>
                <div>
                  <h2 className="info-note-title">Bảng kê hàng hóa, dịch vụ</h2>
                  <div className="info-note">Chi tiết hàng hóa tại thời điểm lập đơn.</div>
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
                  {selectedOrder.items.map((item: { material_id?: number; material_name?: string; material_name_snapshot?: string; qty_kg?: number; unit_price?: number; line_amount?: number }, index: number) => (
                     <tr className="tr" key={`${selectedOrder.id}-${item.material_id || index}-${index}`}>
                       <span><b>{index + 1}. {normalizeText(item.material_name_snapshot || item.material_name || "Không rõ mặt hàng")}</b><small style={{ display: "block", marginTop: 4, color: "var(--text-muted)" }}>Hàng thu mua</small></span>
                      <span>{Number(item.qty_kg || 0).toLocaleString("vi-VN")} kg</span>
                      <span>{formatMoney(item.unit_price ?? 0)}</span>
                      <span style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(item.line_amount ?? 0)}</span>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="purchase-invoice-summary">
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 10 }}><span>Tạm tính</span><span>{formatMoney(selectedOrder.total_amount)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, fontWeight: 900 }}><span>TỔNG CỘNG</span><span style={{ color: "#2563eb" }}>{formatMoney(selectedOrder.total_amount)}</span></div>
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

      {accountOpen && detailData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 1200 }} onClick={() => setAccountOpen(false)}>
          <form
            className="panel uniform-popup"
            style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 24, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.24)" }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitAccountForm}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>{detailData.customer.user_id ? "Cập nhật tài khoản khách hàng" : "Tạo tài khoản khách hàng"}</h2>
                <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>
                  Liên kết một tài khoản đăng nhập cho khách hàng này mà không làm thay đổi dữ liệu đơn hàng.
                </p>
              </div>
              <button type="button" className="btn secondary" onClick={() => setAccountOpen(false)}>Đóng</button>
            </div>
            {accountError && <div className="login-error" style={{ marginBottom: 16 }}>{accountError}</div>}
            {accountNotice && <div className="login-success" style={{ marginBottom: 16 }}>{accountNotice}</div>}
            <div className="calc-field" style={{ marginBottom: 16 }}>
              <label>Khách hàng</label>
              <input value={`${detailData.customer.name} · ${detailData.customer.phone}`} readOnly />
            </div>
            <div className="calc-field" style={{ marginBottom: 16 }}>
              <label>Email đăng nhập</label>
              <input
                value={accountForm.email}
                onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
                placeholder="kh-0901234567@thiennhung.local"
                required
              />
            </div>
            <div className="calc-field" style={{ marginBottom: 16 }}>
              <label>Mật khẩu mới / tạm</label>
              <input
                value={accountForm.password}
                onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })}
                placeholder="Để trống để hệ thống tự tạo"
                type="text"
              />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Nếu để trống mật khẩu, hệ thống sẽ tự sinh một mật khẩu tạm và trả lại ngay sau khi lưu.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" className="btn secondary" onClick={() => setAccountOpen(false)} disabled={accountSaving}>Hủy bỏ</button>
              <button type="submit" className="btn primary" disabled={accountSaving}>
                {accountSaving ? "Đang lưu..." : detailData.customer.user_id ? "Lưu thay đổi" : "Tạo tài khoản"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
