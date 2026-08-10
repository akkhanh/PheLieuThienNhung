"use client";

import React from "react";
import { adminApi, type PurchaseInvoice } from "../../frontend/api/client";

const money = (value?: number | null) => `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} đ`;
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "Chưa cập nhật";

export default function InvoicePage() {
  const [invoice, setInvoice] = React.useState<PurchaseInvoice | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setError("Thiếu mã hóa đơn.");
      return;
    }
    adminApi.invoice(code).then(setInvoice).catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được hóa đơn."));
  }, []);

  if (error) return <main className="a4-invoice-page"><div className="a4-invoice error">{error}</div></main>;
  if (!invoice) return <main className="a4-invoice-page"><div className="a4-invoice">Đang tải hóa đơn...</div></main>;

  return (
    <main className="a4-invoice-page">
      <div className="a4-toolbar"><button onClick={() => window.print()}>In hóa đơn</button><button onClick={() => window.close()}>Đóng trang</button></div>
      <article className="a4-invoice">
        <header><div><small>PHẾ LIỆU THIÊN NHUNG</small><h1>HÓA ĐƠN THU MUA</h1><p>Số: <strong>{invoice.code || invoice.invoice_code}</strong></p></div><span className={`purchase-invoice-status ${invoice.status}`}>{invoice.status === "completed" ? "ĐÃ THANH TOÁN" : invoice.status === "cancelled" ? "ĐÃ HỦY" : "CHƯA HOÀN TẤT"}</span></header>
        <section className="a4-info-grid">
          <div><small>ĐƠN VỊ THU MUA</small><strong>Phế Liệu Thiên Nhung</strong><span>Hệ thống quản lý phế liệu</span></div>
          <div><small>NGƯỜI BÁN HÀNG</small><strong>{invoice.customer_name_snapshot || invoice.customer_name || "Khách vãng lai"}</strong><span>{invoice.customer_phone_snapshot || invoice.customer_phone || "Chưa cập nhật"}</span></div>
          <div><small>NGÀY LẬP PHIẾU</small><strong>{dateTime(invoice.created_at)}</strong><span>Ngày chốt: {dateTime(invoice.completed_at)}</span></div>
          <div><small>TỔNG THANH TOÁN</small><strong className="amount">{money(invoice.total_amount)}</strong><span>{invoice.items.length} mặt hàng</span></div>
        </section>
        <table><thead><tr><th>STT</th><th>Mặt hàng</th><th>Khối lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={index}><td>{index + 1}</td><td><strong>{item.material_name || item.material_name_snapshot}</strong></td><td>{Number(item.qty_kg || 0).toLocaleString("vi-VN")} kg</td><td>{money(item.unit_price)}</td><td><strong>{money(item.line_amount)}</strong></td></tr>)}</tbody></table>
        <section className="a4-total"><span>TỔNG CỘNG</span><strong>{money(invoice.total_amount)}</strong></section>
        <section className="a4-note"><small>GHI CHÚ</small><p>{invoice.note || "Không có ghi chú"}</p></section>
        <footer><div>Người bán hàng<br/><small>(Ký và ghi rõ họ tên)</small></div><div>Người lập phiếu<br/><small>(Ký và ghi rõ họ tên)</small></div></footer>
      </article>
    </main>
  );
}
