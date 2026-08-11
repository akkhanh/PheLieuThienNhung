import React, { useEffect, useState } from "react";
import { customerApi, type AuthUser } from "../../api/client";
import { Icon } from "../icons";
import { formatMoney } from "./homeData";
import BrandLogo from "./BrandLogo";

type CustomerPortalProps = {
  user: AuthUser;
  onLogout: () => Promise<void>;
};

export default function CustomerPortal({ user, onLogout }: CustomerPortalProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [report, setReport] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([customerApi.orders(), customerApi.report()])
      .then(([orderList, summary]) => {
        setOrders(orderList);
        setReport(summary);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="admin-shell">
      <aside>
        <div className="brand">
          <BrandLogo className="brand-logo--sidebar" />
        </div>

        <nav className="side-nav">
          <button className="selected">
            <span><Icon.Home /></span>
            Tổng quan
          </button>
        </nav>

        <button className="back-public" onClick={onLogout}>
          <Icon.Logout className="w-4 h-4" /> Đăng xuất tài khoản
        </button>

        <div className="profile">
          <div className="avatar">KH</div>
          <div>
            <b>{user.name}</b>
            <small>Khách hàng đối tác</small>
          </div>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <span className="mobile-kicker">CỔNG GIAO DỊCH KHÁCH HÀNG</span>
            <h1>Xin chào, {user.name}</h1>
            <p>Theo dõi lịch sử bán hàng và tích lũy doanh số của bạn.</p>
          </div>
          <button className="btn secondary" onClick={onLogout}>
            Đăng xuất
          </button>
        </header>

        {error && <div className="login-error">{error}</div>}

        {loading ? (
          <div className="panel">Đang tải dữ liệu báo cáo...</div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div>
                  <span>Tổng số lượt bán</span>
                  <strong>{report.orders ?? orders.length}</strong>
                  <small className="positive">Lượt giao dịch</small>
                </div>
                <div className="stat-icon"><Icon.Orders /></div>
              </div>

              <div className="stat-card">
                <div>
                  <span>Tổng tích lũy bán</span>
                  <strong>{formatMoney(Number(report.total_amount ?? 0))}</strong>
                  <small className="positive">Đã thanh toán xong</small>
                </div>
                <div className="stat-icon cash"><Icon.Tag /></div>
              </div>

              <div className="stat-card">
                <div>
                  <span>Khối lượng tích lũy</span>
                  <strong>{Number(report.total_kg ?? 0).toLocaleString("vi-VN")} kg</strong>
                  <small className="positive">Được thu mua</small>
                </div>
                <div className="stat-icon"><Icon.Inventory /></div>
              </div>

              <div className="stat-card">
                <div>
                  <span>Sản phẩm chính bán</span>
                  <strong>{report.top_material?.name ?? "—"}</strong>
                  <small className="positive">Phân loại nhiều nhất</small>
                </div>
                <div className="stat-icon"><Icon.Recycle /></div>
              </div>
            </div>

            <div className="panel table-panel">
              <div className="panel-head">
                <div>
                  <h2>Lịch sử giao dịch chi tiết</h2>
                  <p>Tất cả các phiếu thu mua gắn liền với tài khoản của bạn</p>
                </div>
              </div>

              <table className="table">
                <thead>
                  <tr className="tr th">
                    <span>Mã hóa đơn</span>
                    <span>Ngày hoàn tất</span>
                    <span>Trạng thái</span>
                    <span style={{ textAlign: "right" }}>Tổng số tiền</span>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr className="tr" key={order.code}>
                      <span><b className="order-no">{order.code}</b></span>
                      <span>{order.completed_at ? new Date(order.completed_at).toLocaleString("vi-VN") : "—"}</span>
                      <span><span className="status">Hoàn tất</span></span>
                      <span style={{ textAlign: "right", fontWeight: 800 }}>{formatMoney(Number(order.total_amount))}</span>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                        Chưa ghi nhận bất kỳ giao dịch nào từ trước đến nay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
