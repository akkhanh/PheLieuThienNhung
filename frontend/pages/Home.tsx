"use client";

import { useEffect, useMemo, useState } from "react";
import { authApi, customerApi, publicApi, adminApi, type AuthUser, type Material, type Customer, type PurchaseOrder } from "../api/client";
import AdminInventoryView from "../components/admin/InventoryView";
import AdminOrdersView from "../components/admin/OrdersView";
import AdminCustomersView from "../components/admin/CustomersView";

// --- SVG Icons Component Library ---
const Icon = {
  Recycle: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18v3.11h3.11M4 4h1.17C7.6 4 9.682 5.567 10.3 7.89l.3 1.11m4.4-6.89h-.878C11.4 2.11 9.318 3.677 8.7 6l-.3 1.11m12.4 12.89v-5h-.582m-15.356-2a8.001 8.001 0 11-1.21 3.11H6v-3.11h-3.11M20 20h-1.17C16.4 20 14.318 18.433 13.7 16.11l-.3-1.11M10 17.5v-3.11H6.89M14 6.5v3.11h3.11" />
    </svg>
  ),
  Home: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Orders: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Users: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Tag: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Inventory: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  Call: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Logout: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Search: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Calendar: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Plus: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  Check: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  ArrowRight: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  ),
  TrendingUp: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  TrendingDown: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  Close: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Warning: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
};

// --- MOCK FALLBACKS (If Backend is not accessible) ---
const FALLBACK_MATERIALS: Material[] = [
  { id: 1, code: "sat", name: "Sắt vụn", group_name: "Kim loại", unit: "kg", price_per_kg: 8200, qty_kg: 2840, warning_kg: 3000 },
  { id: 2, code: "dong", name: "Đồng đỏ", group_name: "Kim loại", unit: "kg", price_per_kg: 182000, qty_kg: 420, warning_kg: 1000 },
  { id: 3, code: "nhom", name: "Nhôm", group_name: "Kim loại", unit: "kg", price_per_kg: 46000, qty_kg: 780, warning_kg: 1000 },
  { id: 4, code: "inox", name: "Inox 304", group_name: "Kim loại", unit: "kg", price_per_kg: 28500, qty_kg: 1260, warning_kg: 2000 },
  { id: 5, code: "giay", name: "Giấy carton", group_name: "Giấy", unit: "kg", price_per_kg: 4200, qty_kg: 1650, warning_kg: 2000 },
  { id: 6, code: "nhua", name: "Nhựa tổng hợp", group_name: "Nhựa", unit: "kg", price_per_kg: 9800, qty_kg: 620, warning_kg: 1000 },
];

const FALLBACK_CUSTOMERS: Customer[] = [
  { id: 1, code: "KH-024", name: "Nguyễn Văn Minh", phone: "0901234567", address: "Quận 12, TP.HCM", note: "Khách mối sắt", orders: 18, total_amount: 42800000 },
  { id: 2, code: "KH-023", name: "Lê Thị Hương", phone: "0912345678", address: "Gò Vấp, TP.HCM", note: "Thanh toán mặt hàng đồng", orders: 11, total_amount: 18650000 },
  { id: 3, code: "KH-022", name: "Trần Quốc Bảo", phone: "0933456789", address: "Hóc Môn, TP.HCM", note: "Không giao hàng chủ nhật", orders: 7, total_amount: 9200000 },
];

const TRENDS: Record<string, { trend: string; isDown?: boolean }> = {
  "Sắt vụn": { trend: "+3.2%" },
  "Đồng đỏ": { trend: "+1.8%" },
  "Nhôm": { trend: "-0.6%", isDown: true },
  "Inox 304": { trend: "+2.1%" },
  "Giấy carton": { trend: "Ổn định" },
  "Nhựa tổng hợp": { trend: "+0.9%" },
};

const formatMoney = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " đ";

export default function Home() {
  const [view, setView] = useState<"public" | "admin">("public");
  const [tab, setTab] = useState("Tổng quan");
  const [kg, setKg] = useState(10);
  
  const [materials, setMaterials] = useState<Material[]>(FALLBACK_MATERIALS);
  const [selectedMatName, setSelectedMatName] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [customers, setCustomers] = useState<Customer[]>(FALLBACK_CUSTOMERS);
  const [showOrder, setShowOrder] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [customerUser, setCustomerUser] = useState<AuthUser | null>(null);
  
  // Real APIs Dynamic Data
  const [adminStats, setAdminStats] = useState<Record<string, any>>({});
  const [recentOrders, setRecentOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("adminTab");
    if (["Tổng quan", "Đơn thu mua", "Khách hàng", "Bảng giá", "Tồn kho"].includes(requestedTab || "")) {
      setTab(requestedTab as string);
    }
  }, []);

  // Fetch materials prices on load
  const loadPublicData = async () => {
    try {
      const data = await publicApi.prices();
      if (data && data.length > 0) {
        setMaterials(data);
      }
    } catch (e) {
      console.warn("Public API error, falling back to mock data:", e);
    }
  };

  // Try to load active user on startup
  useEffect(() => {
    loadPublicData();
    authApi.me()
      .then((res) => {
        if (res.user) {
          if (res.user.role === "admin") {
            setView("admin");
          } else {
            setCustomerUser(res.user);
          }
        }
      })
      .catch(() => {
        // Not logged in, stay in public
      });
  }, []);

  // Update calculator selection once materials are loaded
  useEffect(() => {
    if (materials.length > 0 && !selectedMatName) {
      setSelectedMatName(materials[0].name);
    }
  }, [materials]);

  const selectedMaterial = useMemo(() => {
    return materials.find((m) => m.name === selectedMatName) || materials[0];
  }, [materials, selectedMatName]);

  const totalEstimate = useMemo(() => {
    if (!selectedMaterial) return 0;
    return kg * selectedMaterial.price_per_kg;
  }, [kg, selectedMaterial]);

  const visibleMaterials = useMemo(() => {
    if (filter === "Tất cả") return materials;
    return materials.filter((m) => m.group_name === filter);
  }, [materials, filter]);

  // Load Admin Portal Data
  const loadAdminData = async () => {
    try {
      const [custData, summaryData, ordersData, inventoryData] = await Promise.all([
        adminApi.customers(),
        adminApi.summary(),
        adminApi.orders(),
        adminApi.inventory().catch(() => ({ items: [] }))
      ]);
      
      setCustomers(Array.isArray(custData) ? custData : (custData as any)?.items || []);
      setAdminStats(summaryData);
      setRecentOrders(Array.isArray(ordersData) ? ordersData : (ordersData as any)?.items || []);
      
      // Update local materials stock from inventory
      const invItems = Array.isArray(inventoryData) ? inventoryData : (inventoryData as any)?.items || [];
      if (invItems && invItems.length > 0) {
        const updated = materials.map(m => {
          const inv = (invItems as any[]).find(i => i.id === m.id || i.name === m.name);
          return inv ? { ...m, qty_kg: inv.qty_kg, warning_kg: inv.warning_kg } : m;
        });
        setMaterials(updated);
      }
    } catch (e) {
      console.warn("Admin API error, keeping current/fallback data:", e);
    }
  };

  useEffect(() => {
    if (view === "admin") {
      loadAdminData();
    }
  }, [view]);

  const logout = async () => {
    await authApi.logout();
    setCustomerUser(null);
    setView("public");
  };

  if (customerUser) {
    return <CustomerPortal user={customerUser} onLogout={logout} />;
  }

  if (showLogin) {
    return (
      <Login
        onClose={() => setShowLogin(false)}
        onSuccess={(u) => {
          if (u.role === "admin") {
            setView("admin");
            setShowLogin(false);
          } else {
            setCustomerUser(u);
            setShowLogin(false);
          }
        }}
        error={authError}
      />
    );
  }

  if (view === "admin") {
    return (
      <Admin
        tab={tab}
        setTab={setTab}
        stats={adminStats}
        customers={customers}
        setCustomers={setCustomers}
        recentOrders={recentOrders}
        materials={materials}
        reloadAdmin={loadAdminData}
        onPublic={() => setView("public")}
        showOrder={showOrder}
        setShowOrder={setShowOrder}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="public-shell">
      {/* Navigation */}
      <nav className="public-nav">
        <div className="brand">
          <span className="brand-mark">
            <Icon.Recycle className="w-5 h-5" />
          </span>
          <span>
            Phế Liệu <b>Thiên Nhung</b>
          </span>
        </div>
        <div className="nav-links">
          <a href="#gia">Bảng giá</a>
          <a href="#quy-trinh">Quy trình</a>
          <a href="#lien-he">Liên hệ</a>
        </div>
        <button
          className="admin-link"
          onClick={() => {
            setAuthError("");
            setShowLogin(true);
          }}
        >
          Đăng nhập quản lý <Icon.ArrowRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> ĐANG THU MUA HÔM NAY
          </div>
          <h1>
            Biến phế liệu
            <br />
            <em>thành giá trị.</em>
          </h1>
          <p>
            Thu mua phế liệu tận nơi tại TP.HCM. Cân đo minh bạch, báo giá cập nhật hằng ngày, thanh toán nhanh chóng ngay tại vựa.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="tel:0909888777">
              <Icon.Call className="w-4 h-4" /> Gọi thu mua ngay
            </a>
            <a className="btn secondary" href="#gia">
              Xem bảng giá hôm nay
            </a>
          </div>
          <div className="trust">
            <span>✓</span> Đã phục vụ <b>2.400+</b> đối tác, hộ gia đình tại TP.HCM
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-art-bg" />
          
          <div className="art-card card-one">
            <span>GIÁ HÔM NAY</span>
            <strong>ĐỒNG ĐỎ</strong>
            <b>182.000 <small>đ/kg</small></b>
            <i>
              <Icon.TrendingUp className="w-4 h-4" /> +1.8% hôm qua
            </i>
          </div>

          <div className="art-card card-two">
            <span>QUY TRÌNH THU MUA</span>
            <strong>NHANH • GỌN • UY TÍN</strong>
            <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
              Cân điện tử độ chính xác cao. Tránh thất thoát cho khách hàng.
            </p>
          </div>
        </div>
      </section>

      {/* Price Ticker */}
      <section className="ticker">
        <div className="ticker-item"><span>CÂN ĐO CÔNG KHAI</span></div>
        <i />
        <div className="ticker-item"><span>THU MUA TẬN NƠI</span></div>
        <i />
        <div className="ticker-item"><span>THANH TOÁN LIỀN TAY</span></div>
        <i />
        <div className="ticker-item"><span>GIÁ CẢ CẠNH TRANH</span></div>
      </section>

      {/* Pricing Section */}
      <section className="section" id="gia">
        <div className="section-head">
          <div>
            <div className="eyebrow">BẢNG GIÁ THỜI TIẾT</div>
            <h2>Giá thu mua hôm nay</h2>
            <p>Bảng giá cập nhật trực tiếp tại vựa. Chốt giá chính xác tại thời điểm giao dịch.</p>
          </div>
          <div className="filters">
            {["Tất cả", "Kim loại", "Giấy", "Nhựa"].map((f) => (
              <button
                className={filter === f ? "active" : ""}
                key={f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="price-grid">
          {visibleMaterials.map((m) => {
            const tr = TRENDS[m.name] || { trend: "Ổn định" };
            return (
              <article className="price-card" key={m.id}>
                <div className="material-icon">
                  <Icon.Tag className="w-5 h-5" />
                </div>
                <div>
                  <span>{m.group_name}</span>
                  <h3>{m.name}</h3>
                </div>
                <div className="price-value">
                  <b>{formatMoney(m.price_per_kg).replace(" đ", "")}</b>
                  <small>đ / kg</small>
                  <i className={tr.isDown ? "down" : ""}>
                    {tr.isDown ? <Icon.TrendingDown /> : <Icon.TrendingUp />} {tr.trend}
                  </i>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Quick Calculator */}
      <section className="calculator">
        <div>
          <div className="eyebrow">ƯỚC TÍNH NHANH</div>
          <h2>Biết ngay giá trị phế liệu của bạn.</h2>
          <p>Chọn loại phế liệu cần bán và nhập số kilogram ước tính bên dưới để xem ngay giá dự kiến nhận về.</p>
          <a href="tel:0909888777" className="text-link">
            Cần khảo sát số lượng lớn? Gọi ngay hotline <Icon.ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="calc-box">
          <div className="calc-field">
            <label>Loại phế liệu</label>
            <select
              value={selectedMatName}
              onChange={(e) => setSelectedMatName(e.target.value)}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.group_name})
                </option>
              ))}
            </select>
          </div>
          <div className="calc-field">
            <label>Số lượng (kg)</label>
            <input
              type="number"
              min="1"
              value={kg}
              onChange={(e) => setKg(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="calc-total">
            <span>TỔNG TIỀN DỰ KIẾN</span>
            <strong>{formatMoney(totalEstimate)}</strong>
            <small>* Mức giá dựa trên bảng giá niêm yết hôm nay, chưa cộng giá ưu đãi khách quen.</small>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process section" id="quy-trinh">
        <div className="eyebrow">BA BƯỚC ĐƠN GIẢN</div>
        <h2>Thu mua nhanh gọn, không lo ép giá</h2>
        <div className="process-grid">
          <div className="process-card">
            <b className="process-num">01</b>
            <h3>Liên hệ báo tin</h3>
            <p>Gọi điện hoặc nhắn tin Zalo kèm hình ảnh phế liệu. Chúng tôi báo khoảng giá ngay.</p>
          </div>
          <div className="process-card">
            <b className="process-num">02</b>
            <h3>Khảo sát & Cân đo</h3>
            <p>Nhân viên đến tận nơi cân đo minh bạch bằng cân điện tử chuẩn xác nhất.</p>
          </div>
          <div className="process-card">
            <b className="process-num">03</b>
            <h3>Thanh toán & Thu dọn</h3>
            <p>Trả tiền mặt hoặc chuyển khoản ngay tại chỗ. Bốc xếp dọn dẹp mặt bằng sạch sẽ.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="lien-he">
        <div>
          <div className="brand" style={{ marginBottom: "12px" }}>
            <span className="brand-mark">
              <Icon.Recycle className="w-5 h-5" />
            </span>
            <span>
              Phế Liệu <b>Thiên Nhung</b>
            </span>
          </div>
          <p>
            Địa chỉ vựa: Quốc lộ 1A, Quận 12, TP.HCM
            <br />
            Phục vụ tất cả các ngày trong tuần (kể cả chủ nhật)
            <br />
            Giờ làm việc: 07:00 — 21:00
          </p>
        </div>
        <a className="btn primary" href="tel:0909888777">
          <Icon.Call className="w-4 h-4" /> 0909 888 777
        </a>
      </footer>
    </main>
  );
}

// --- ADMIN PORTAL VIEW ---
type AdminProps = {
  tab: string;
  setTab: (t: string) => void;
  stats: Record<string, any>;
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  recentOrders: PurchaseOrder[];
  materials: Material[];
  reloadAdmin: () => Promise<void>;
  onPublic: () => void;
  showOrder: boolean;
  setShowOrder: (v: boolean) => void;
  onLogout: () => Promise<void>;
};

function Admin({
  tab,
  setTab,
  stats,
  customers = [],
  setCustomers,
  recentOrders = [],
  materials = [],
  reloadAdmin,
  onPublic,
  showOrder,
  setShowOrder,
  onLogout,
}: AdminProps) {
  const safeOrders = Array.isArray(recentOrders) ? recentOrders : (recentOrders as any)?.items || [];
  const safeCustomers = Array.isArray(customers) ? customers : (customers as any)?.items || [];
  const safeMaterials = Array.isArray(materials) ? materials : (materials as any)?.items || [];

  const menuItems = [
    { name: "Tổng quan", icon: <Icon.Home /> },
    { name: "Đơn thu mua", icon: <Icon.Orders /> },
    { name: "Khách hàng", icon: <Icon.Users /> },
    { name: "Bảng giá", icon: <Icon.Tag /> },
    { name: "Tồn kho", icon: <Icon.Inventory /> },
  ];

  const totalKgAll = useMemo(() => {
    return stats.total_kg ?? safeMaterials.reduce((acc: number, m: any) => acc + (m.qty_kg ?? 0), 0);
  }, [stats.total_kg, safeMaterials]);

  const computedStats = useMemo(() => {
    return [
      {
        title: "Đơn hoàn tất",
        value: stats.orders ?? safeOrders.length,
        trend: "Đơn hàng hệ thống",
        key: "orders",
        icon: <Icon.Orders />,
      },
      {
        title: "Tổng tiền thu mua",
        value: formatMoney(stats.revenue ?? stats.total_amount ?? 0),
        trend: "Chi phí đầu vào",
        key: "cash",
        icon: <Icon.Tag />,
      },
      {
        title: "Tồn kho vựa",
        value: `${Math.round(totalKgAll).toLocaleString("vi-VN")} kg`,
        trend: "Số lượng hiện có trong kho",
        key: "stock",
        icon: <Icon.Inventory />,
      },
      {
        title: "Khách hàng đăng ký",
        value: safeCustomers.length,
        trend: "Khách hàng thân thiết",
        key: "users",
        icon: <Icon.Users />,
      },
    ];
  }, [stats, safeOrders, totalKgAll, safeCustomers]);

  return (
    <main className="admin-shell">
      {/* Sidebar */}
      <aside>
        <div className="brand">
          <span className="brand-mark">
            <Icon.Recycle className="w-5 h-5" />
          </span>
          <div>
            <span>THIÊN NHUNG</span>
            <small>Quản Lý Vựa</small>
          </div>
        </div>

        <nav className="side-nav">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={tab === item.name ? "selected" : ""}
              onClick={() => setTab(item.name)}
            >
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

      {/* Main Panel Content */}
      <section className="admin-content">
        <header className="admin-header">
          <div>
            <span className="mobile-kicker">HỆ THỐNG NỘI BỘ</span>
            <h1>{tab === "Tổng quan" ? "Chào buổi sáng, chị Nhung" : tab}</h1>
            <p>
              {tab === "Tổng quan"
                ? "Dưới đây là tình hình hoạt động của vựa phế liệu hôm nay."
                : `Quản lý ${tab.toLowerCase()} chi tiết trong hệ thống.`}
            </p>
          </div>
          <div className="header-actions">
            <span className="date">
              <Icon.Calendar className="w-4 h-4" />{" "}
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <button className="btn primary" onClick={() => { window.location.href = `/orders/new?returnTab=${encodeURIComponent(tab)}`; }}>
              <Icon.Plus className="w-4 h-4" /> Tạo đơn mới
            </button>
          </div>
        </header>

        {tab === "Khách hàng" ? (
          <AdminCustomersView customers={customers} setCustomers={setCustomers} reload={reloadAdmin} />
        ) : tab === "Bảng giá" ? (
          <PricesView materials={materials} reload={reloadAdmin} />
        ) : tab === "Tồn kho" ? (
          <AdminInventoryView materials={materials} reload={reloadAdmin} />
        ) : tab === "Đơn thu mua" ? (
          <AdminOrdersView orders={recentOrders} customers={customers} />
        ) : (
          /* Dashboard Tab */
          <>
            <div className="stat-grid">
              {computedStats.map((s) => (
                <div className="stat-card" key={s.title}>
                  <div>
                    <span>{s.title}</span>
                    <strong>{s.value}</strong>
                    <small className={s.warning ? "warning" : "positive"}>{s.trend}</small>
                  </div>
                  <div className={`stat-icon ${s.key === "cash" ? "cash" : s.warning ? "warning-bg" : ""}`}>
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            <div className="dash-grid">
              {/* Cost Chart */}
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
                  <div className="chart-lines">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <svg viewBox="0 0 700 180" preserveAspectRatio="none">
                    {/* Soft modern green gradient path */}
                    <path
                      d="M0,140 C60,130 80,110 120,125 S200,150 240,90 S300,75 350,105 S420,50 465,70 S520,95 555,45 S620,55 700,10"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="4"
                    />
                    <path
                      d="M0,140 C60,130 80,110 120,125 S200,150 240,90 S300,75 350,105 S420,50 465,70 S520,95 555,45 S620,55 700,10 V180 H0"
                      fill="url(#chartGrad)"
                      opacity="0.1"
                    />
                    <defs>
                      <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="#10b981" />
                        <stop offset="1" stopColor="#ffffff" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="chart-labels">
                  <span>Thứ 2</span>
                  <span>Thứ 3</span>
                  <span>Thứ 4</span>
                  <span>Thứ 5</span>
                  <span>Thứ 6</span>
                  <span>Thứ 7</span>
                  <span>Chủ nhật</span>
                </div>
              </div>

              {/* Recent Orders Panel */}
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Giao dịch gần đây</h2>
                    <p>Xem danh sách hóa đơn thu mua mới nhất</p>
                  </div>
                  <button className="view-all" onClick={() => setTab("Đơn thu mua")}>
                    Tất cả đơn →
                  </button>
                </div>
                <div className="orders-list">
                  {safeOrders.slice(0, 5).map((o: any) => {
                    const cust = safeCustomers.find((c: any) => c.id === o.customer_id);
                    return (
                      <div className="order-row" key={o.id}>
                        <span className="order-no">{o.code}</span>
                        <div>
                          <b>{cust ? cust.name : "Khách lẻ"}</b>
                          <small>
                            {o.completed_at ? new Date(o.completed_at).toLocaleString("vi-VN") : "Hôm nay"}
                          </small>
                        </div>
                        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                          {o.item_count ? `${o.item_count} sản phẩm` : "Đã chốt"}
                        </span>
                        <strong>{formatMoney(o.total_amount)}</strong>
                      </div>
                    );
                  })}
                  {safeOrders.length === 0 && (
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "20px" }}>
                      Chưa có đơn hàng nào trong hôm nay.
                    </p>
                  )}
                </div>
              </div>
            </div>

          </>
        )}
      </section>

    </main>
  );
}

// --- SUBVIEWS COMPONENTS ---

// Prices list subview
type Props = { materials: Material[]; reload: () => Promise<void> };
type EditState = { name: string; group_name: string; unit: string; price: string; is_public: boolean };

const groups = ["Kim loại", "Giấy", "Nhựa", "Điện tử", "Khác"];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

function PricesView({ materials, reload }: Props) {
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


// Legacy order modal retained below only until the dedicated order page migration is complete.
type LoginProps = {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  error: string;
};

function Login({ onClose, onSuccess, error }: LoginProps) {
  const [email, setEmail] = useState("admin@thiennhung.local");
  const [password, setPassword] = useState("Admin@123456");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLocalError("");
    try {
      const result = await authApi.login(email, password);
      onSuccess(result.user);
    } catch (e: any) {
      setLocalError(e.message || "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <Icon.Close />
        </button>
        <div className="brand">
          <span className="brand-mark">
            <Icon.Recycle className="w-5 h-5" />
          </span>
          <span>
            Phế Liệu <b>Thiên Nhung</b>
          </span>
        </div>
        <div className="eyebrow">KHU VỰC ĐĂNG NHẬP</div>
        <h1>Xin chào!</h1>
        <p>Đăng nhập tài khoản của bạn để quản lý tồn kho, xem bảng giá và hóa đơn.</p>

        <label>
          Email đăng nhập
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        
        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {(localError || error) && <div className="login-error">{localError || error}</div>}

        <button className="btn primary full" disabled={busy}>
          {busy ? "Đang xử lý..." : "Đăng nhập ngay"}
        </button>

        <small>Tài khoản Demo Admin: admin@thiennhung.local / Admin@123456</small>
      </form>
    </main>
  );
}

// 7. Customer Portal View Component
function CustomerPortal({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [report, setReport] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([customerApi.orders(), customerApi.report()])
      .then(([o, r]) => {
        setOrders(o);
        setReport(r);
      })
      .catch((e) => {
        setError(e.message || "Không tải được dữ liệu");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <main className="admin-shell">
      {/* Customer Sidebar */}
      <aside>
        <div className="brand">
          <span className="brand-mark">
            <Icon.Recycle className="w-5 h-5" />
          </span>
          <div>
            <span>THIÊN NHUNG</span>
            <small>Cổng Khách Hàng</small>
          </div>
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

      {/* Main Panel */}
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
            {/* Stats Metrics */}
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

            {/* Orders Table */}
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
                  {orders.map((o) => (
                    <tr className="tr" key={o.code}>
                      <span>
                        <b className="order-no">{o.code}</b>
                      </span>
                      <span>
                        {o.completed_at ? new Date(o.completed_at).toLocaleString("vi-VN") : "—"}
                      </span>
                      <span>
                        <span className="status">Hoàn tất</span>
                      </span>
                      <span style={{ textAlign: "right", fontWeight: "800" }}>
                        {formatMoney(Number(o.total_amount))}
                      </span>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
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
