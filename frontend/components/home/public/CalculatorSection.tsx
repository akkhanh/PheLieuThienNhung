import React from "react";
import { type Material } from "../../../api/client";
import { Icon } from "../../icons";
import { formatMoney } from "../homeData";

type CalculatorSectionProps = {
  materials: Material[];
  selectedMatName: string;
  setSelectedMatName: (val: string) => void;
  kg: number;
  setKg: (val: number) => void;
};

export default function CalculatorSection({
  materials,
  selectedMatName,
  setSelectedMatName,
  kg,
  setKg,
}: CalculatorSectionProps) {
  const currentMaterial = materials.find((m) => m.name === selectedMatName) || materials[0];

  const pricePerKg = Number(currentMaterial?.price_per_kg || 0);
  const rawTotal = kg * pricePerKg;

  // Bulk bonus logic: > 500kg gets +5% bonus incentive visual indicator
  const isBulk = kg >= 500;
  const bulkBonus = isBulk ? rawTotal * 0.05 : 0;
  const finalTotal = rawTotal + bulkBonus;

  return (
    <section className="public-home__section public-home__calculator" id="gia-ung-tinh">
      <div className="public-home__calculator-copy">
        <p className="public-home__eyebrow">
          <span className="public-home__live-dot" /> TÍNH TOÁN THỜI GIAN THỰC
        </p>
        <h2>ƯỚC TÍNH NHANH</h2>
        <p className="lead-text">
          Tính ngay số tiền bạn nhận được dựa trên khối lượng phế liệu thực tế. Đơn từ 500kg trở lên được tự động cộng ưu đãi thưởng thêm +5% vào tổng đơn!
        </p>

        <div className="public-home__calculator-highlights">
          <div className="calc-highlight-item">
            <Icon.Check className="w-5 h-5 text-blue-600" />
            <span>Giá chốt chuẩn xác theo niêm yết vựa</span>
          </div>
          <div className="calc-highlight-item">
            <Icon.Check className="w-5 h-5 text-blue-600" />
            <span>Miễn phí cân đo &amp; xe bốc xếp tận nhà</span>
          </div>
          <div className="calc-highlight-item">
            <Icon.Check className="w-5 h-5 text-blue-600" />
            <span>Thanh toán 100% tiền mặt / chuyển khoản</span>
          </div>
        </div>
      </div>

      <div className="public-home__calculator-box">
        <div className="calc-input-group">
          <label>
            <span>Loại phế liệu thu mua</span>
            <div className="custom-select-wrap">
              <select
                value={selectedMatName}
                onChange={(e) => setSelectedMatName(e.target.value)}
              >
                {materials.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name} ({item.group_name}) — {new Intl.NumberFormat("vi-VN").format(Number(item.price_per_kg || 0))} đ/kg
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="calc-input-group">
          <div className="kg-header">
            <span>Số lượng ước tính (kg)</span>
            <strong className="kg-value-display">{kg} kg</strong>
          </div>
          <input
            type="number"
            min="1"
            max="100000"
            value={kg}
            onChange={(e) => setKg(Math.max(1, Number(e.target.value || 1)))}
            className="kg-number-input"
          />

          <input
            type="range"
            min="10"
            max="2000"
            step="10"
            value={kg}
            onChange={(e) => setKg(Number(e.target.value))}
            className="kg-slider-input"
          />

          <div className="kg-presets">
            <button type="button" onClick={() => setKg(50)}>50 kg</button>
            <button type="button" onClick={() => setKg(100)}>100 kg</button>
            <button type="button" onClick={() => setKg(500)}>500 kg ⚡</button>
            <button type="button" onClick={() => setKg(1000)}>1 Tấn ⚡</button>
          </div>
        </div>

        {isBulk && (
          <div className="bulk-bonus-badge">
            <span className="badge-icon">🎁</span>
            <span>Đơn hàng đạt chuẩn thu mua lớn (&ge;500kg): Tặng thưởng +5% giá trị đơn!</span>
          </div>
        )}

        <div className="public-home__calculator-total">
          <div className="total-header">
            <span>TỔNG TIỀN DỰ KIẾN NHẬN ĐƯỢC</span>
            {isBulk && <small className="text-blue-600 font-bold">Đã gồm +5% ưu đãi số lượng lớn</small>}
          </div>

          <strong className="total-amount">{formatMoney(finalTotal)}</strong>

          <p className="total-note">
            *Số tiền thực tế sẽ được cân đo điện tử công khai tại điểm thu mua.
          </p>

          <a href="tel:0911445553" className="calc-cta-button">
            <Icon.Call className="w-4 h-4" />
            Gọi Đặt Lịch Thu Mua Ngay
          </a>
        </div>
      </div>
    </section>
  );
}
