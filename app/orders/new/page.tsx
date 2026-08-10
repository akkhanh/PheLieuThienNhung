"use client";

import React from "react";
import OrderModal from "../../../frontend/components/OrderModal";
import { adminApi, type Customer, type Material } from "../../../frontend/api/client";

export default function NewPurchaseOrderPage() {
  const [materials, setMaterials] = React.useState<Material[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    Promise.all([
      adminApi.materials(),
      adminApi.customers({ page: 1, page_size: 100 }),
    ])
      .then(([materialList, customerPage]) => {
        setMaterials(Array.isArray(materialList) ? materialList : []);
        setCustomers(customerPage.items || []);
      })
      .catch(() => setError("Không tải được dữ liệu để tạo đơn. Vui lòng quay lại và thử lại."))
      .finally(() => setLoading(false));
  }, []);

  const returnToDashboard = () => {
    const returnTab = new URLSearchParams(window.location.search).get("returnTab") || "Đơn thu mua";
    window.location.href = `/?adminTab=${encodeURIComponent(returnTab)}`;
  };

  return (
    <main className="new-order-page">
      <div className="new-order-page-shell">
        {loading ? (
          <div className="panel new-order-state">Đang tải biểu mẫu tạo đơn...</div>
        ) : error ? (
          <div className="panel new-order-state">
            <p>{error}</p>
            <button className="btn secondary" type="button" onClick={returnToDashboard}>Quay lại dashboard</button>
          </div>
        ) : materials.length === 0 ? (
          <div className="panel new-order-state">
            <p>Chưa có mặt hàng trong bảng giá nên chưa thể tạo đơn.</p>
            <button className="btn secondary" type="button" onClick={returnToDashboard}>Quay lại dashboard</button>
          </div>
        ) : (
          <OrderModal
            materials={materials}
            customers={customers}
            onClose={returnToDashboard}
            onSuccess={returnToDashboard}
          />
        )}
      </div>
    </main>
  );
}
