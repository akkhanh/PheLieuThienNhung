import React from "react";

const TICKER_ITEMS = [
  { name: "Đồng đỏ 99%", price: "220,000 đ/kg", trend: "+1.8%", isUp: true },
  { name: "Sắt vụn công trình", price: "15,500 đ/kg", trend: "+3.2%", isUp: true },
  { name: "Nhôm đà đặc", price: "48,000 đ/kg", trend: "-0.6%", isUp: false },
  { name: "Inox 304 vụn", price: "38,000 đ/kg", trend: "+2.1%", isUp: true },
  { name: "Giấy carton phế liệu", price: "4,500 đ/kg", trend: "Ổn định", isUp: true },
  { name: "Nhựa PE / PVC", price: "18,000 đ/kg", trend: "+0.9%", isUp: true },
  { name: "Cáp điện đồng cũ", price: "195,000 đ/kg", trend: "+2.5%", isUp: true },
  { name: "MIỄN PHÍ VẬN CHUYỂN", price: "Đơn > 500kg TP.HCM", trend: "HOT ⚡", isUp: true },
];

export default function PriceTicker() {
  return (
    <div className="public-home__ticker-wrap" aria-label="Ticker giá thị trường">
      <div className="public-home__ticker-label">
        <span className="live-dot-pulse" />
        THỊ TRƯỜNG LIVE
      </div>
      <div className="public-home__ticker-viewport">
        <div className="public-home__ticker-track">
          <div className="ticker-group">
            {TICKER_ITEMS.map((item, idx) => (
              <div key={idx} className="public-home__ticker-item">
                <span className="ticker-item__name">{item.name}</span>
                <strong className="ticker-item__price">{item.price}</strong>
                <span className={`ticker-item__badge ${item.isUp ? "is-up" : "is-down"}`}>
                  {item.trend}
                </span>
              </div>
            ))}
          </div>
          <div className="ticker-group" aria-hidden="true">
            {TICKER_ITEMS.map((item, idx) => (
              <div key={`dup-${idx}`} className="public-home__ticker-item">
                <span className="ticker-item__name">{item.name}</span>
                <strong className="ticker-item__price">{item.price}</strong>
                <span className={`ticker-item__badge ${item.isUp ? "is-up" : "is-down"}`}>
                  {item.trend}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
