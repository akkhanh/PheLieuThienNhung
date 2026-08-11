
export const TRENDS: Record<string, { trend: string; isDown?: boolean }> = {
  "Sắt vụn": { trend: "+3.2%" },
  "Đồng đỏ": { trend: "+1.8%" },
  "Nhôm": { trend: "-0.6%", isDown: true },
  "Inox 304": { trend: "+2.1%" },
  "Giấy carton": { trend: "Ổn định" },
  "Nhựa tổng hợp": { trend: "+0.9%" },
};

export const formatMoney = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n || 0)} đ`;

export const formatMoneyShort = (n: number) => new Intl.NumberFormat("vi-VN").format(n || 0);

export const ADMIN_TABS = ["Tổng quan", "Đơn thu mua", "Khách hàng", "Bảng giá", "Tồn kho"] as const;
