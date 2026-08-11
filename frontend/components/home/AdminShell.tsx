import React, { useMemo } from "react";
import { type Customer, type Material, type PurchaseOrder } from "../../api/client";
import AdminInventoryView from "../admin/InventoryView";
import AdminOrdersView from "../admin/OrdersView";
import AdminCustomersView from "../admin/CustomersView";
import AdminPricesView from "../admin/PricesView";
import { Icon } from "../icons";
import { formatMoney } from "./homeData";
import BrandLogo from "./BrandLogo";

type AdminShellProps = {
  tab: string;
  setTab: (value: string) => void;
  stats: Record<string, any>;
  customers: Customer[];
  setCustomers: (value: Customer[]) => void;
  recentOrders: PurchaseOrder[];
  materials: Material[];
  reloadAdmin: () => Promise<void>;
  onPublic: () => void;
  onLogout: () => Promise<void>;
};

const menuItems = [
  { name: "Tổng quan", icon: <Icon.Home /> },
  { name: "Đơn thu mua", icon: <Icon.Orders /> },
  { name: "Khách hàng", icon: <Icon.Users /> },
  { name: "Bảng giá", icon: <Icon.Tag /> },
  { name: "Tồn kho", icon: <Icon.Inventory /> },
];

export default function AdminShell({
  tab,
  setTab,
  stats,
  customers = [],
  setCustomers,
  recentOrders = [],
  materials = [],
  reloadAdmin,
  onPublic,
  onLogout,
}: AdminShellProps) {
  const safeOrders = Array.isArray(recentOrders) ? recentOrders : (recentOrders as any)?.items || [];
  const safeCustomers = Array.isArray(customers) ? customers : (customers as any)?.items || [];
  const safeMaterials = Array.isArray(materials) ? materials : (materials as any)?.items || [];

  const totalKgAll = useMemo(
    () => stats.total_kg ?? safeMaterials.reduce((acc: number, item: any) => acc + (item.qty_kg ?? 0), 0),
    [stats.total_kg, safeMaterials],
  );

  const computedStats = useMemo(
    () => [
      { title: "Đơn hoàn tất", value: stats.orders ?? safeOrders.length, trend: "Đơn hàng hệ thống", key: "orders", icon: <Icon.Orders /> },
      { title: "Tổng tiền thu mua", value: formatMoney(stats.revenue ?? stats.total_amount ?? 0), trend: "Chi phí đầu vào", key: "cash", icon: <Icon.Tag /> },
      { title: "Tồn kho vựa", value: `${Math.round(totalKgAll).toLocaleString("vi-VN")} kg`, trend: "Số lượng hiện có trong kho", key: "stock", icon: <Icon.Inventory /> },
      { title: "Khách hàng đăng ký", value: safeCustomers.length, trend: "Khách hàng thân thiết", key: "users", icon: <Icon.Users /> },
    ],
    [stats, safeOrders.length, totalKgAll, safeCustomers.length],
  );

  return (
    <main className="admin-shell">
      <aside>
        <div className="brand">
          <BrandLogo className="brand-logo--sidebar" />
        </div>

        <nav className="side-nav">
          {menuItems.map((item) => (
            <button key={item.name} className={tab === item.name ? "selected" : ""} onClick={() => setTab(item.name)}>
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <button className="back-public" onClick={onPublic}>
          <Icon.Logout className="w-4 h-4" /> Quay lại trang chủ
        </button>

        <div className="profile">
          <div className="avatar">AD</div>
          <div className="profile-copy">
            <b>Thiên Nhung</b>
            <small>Chủ vựa</small>
            <span className="profile-status">Online</span>
          </div>
          <button className="profile-more" onClick={onLogout} title="Đăng xuất">
            <Icon.Logout className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <span className="mobile-kicker">HỆ THỐNG NỘI BỘ</span>
            <h1>{tab === "Tổng quan" ? "Chào buổi sáng, chị Nhung" : tab}</h1>
            <p>{tab === "Tổng quan" ? "Dưới đây là tình hình hoạt động của vựa phế liệu hôm nay." : `Quản lý ${tab.toLowerCase()} chi tiết trong hệ thống.`}</p>
          </div>
          <div className="header-actions">
            <span className="date">
              <Icon.Calendar className="w-4 h-4" />{" "}
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <button className="btn primary" onClick={() => { window.location.href = `/orders/new?returnTab=${encodeURIComponent(tab)}`; }}>
              <Icon.Plus className="w-4 h-4" /> Tạo đơn mới
            </button>
          </div>
        </header>

        {tab === "Khách hàng" ? (
          <AdminCustomersView customers={customers} setCustomers={setCustomers} reload={reloadAdmin} />
        ) : tab === "Bảng giá" ? (
          <AdminPricesView materials={materials} reload={reloadAdmin} />
        ) : tab === "Tồn kho" ? (
          <AdminInventoryView materials={materials} reload={reloadAdmin} />
        ) : tab === "Đơn thu mua" ? (
          <AdminOrdersView orders={recentOrders} customers={customers} />
        ) : (
          <>
            <div className="stat-grid">
              {computedStats.map((item) => (
                <div className="stat-card" key={item.title}>
                  <div>
                    <span>{item.title}</span>
                    <strong>{item.value}</strong>
                    <small className="positive">{item.trend}</small>
                  </div>
                  <div className={`stat-icon ${item.key === "cash" ? "cash" : ""}`}>{item.icon}</div>
                </div>
              ))}
            </div>

            <div className="dash-grid">
              <div className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Biểu đồ thu chi vựa</h2>
                    <p>Thống kê dòng tiền chi ra trong tuần này</p>
                  </div>
                  <select>
                    <option>7 ngày qua</option>
                    <option>30 ngày qua</option>
                  </select>
                </div>
                <div className="chart">
                  <div className="chart-lines"><i /><i /><i /><i /></div>
                  <svg viewBox="0 0 700 180" preserveAspectRatio="none">
                    <path d="M0,140 C60,130 80,110 120,125 S200,150 240,90 S300,75 350,105 S420,50 465,70 S520,95 555,45 S620,55 700,10" fill="none" stroke="#059669" strokeWidth="4" />
                    <path d="M0,140 C60,130 80,110 120,125 S200,150 240,90 S300,75 350,105 S420,50 465,70 S520,95 555,45 S620,55 700,10 V180 H0" fill="url(#chartGrad)" opacity="0.1" />
                    <defs>
                      <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="#10b981" />
                        <stop offset="1" stopColor="#ffffff" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="chart-labels">
                  <span>Thứ 2</span><span>Thứ 3</span><span>Thứ 4</span><span>Thứ 5</span><span>Thứ 6</span><span>Thứ 7</span><span>Chủ nhật</span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Giao dịch gần đây</h2>
                    <p>Xem danh sách hóa đơn thu mua mới nhất</p>
                  </div>
                  <button className="view-all" onClick={() => setTab("Đơn thu mua")}>Tất cả đơn →</button>
                </div>
                <div className="orders-list">
                  {safeOrders.slice(0, 5).map((order: any) => {
                    const customer = safeCustomers.find((item: any) => item.id === order.customer_id);
                    return (
                      <div className="order-row" key={order.id}>
                        <span className="order-no">{order.code}</span>
                        <div>
                          <b>{customer ? customer.name : "Khách lẻ"}</b>
                          <small>{order.completed_at ? new Date(order.completed_at).toLocaleString("vi-VN") : "Hôm nay"}</small>
                        </div>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{order.item_count ? `${order.item_count} sản phẩm` : "Đã chốt"}</span>
                        <strong>{formatMoney(order.total_amount)}</strong>
                      </div>
                    );
                  })}
                  {safeOrders.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 20 }}>Chưa có đơn hàng nào trong hôm nay.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
