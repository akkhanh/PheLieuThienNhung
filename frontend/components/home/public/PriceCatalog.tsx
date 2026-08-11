import React from "react";
import { type Material } from "../../../api/client";
import { Icon } from "../../icons";
import { formatMoneyShort, TRENDS } from "../homeData";

type PriceCatalogProps = {
  materials: Material[];
  onSelectForCalc: (matName: string) => void;
};

export default function PriceCatalog({
  materials,
  onSelectForCalc,
}: PriceCatalogProps) {
  const popularMaterials = materials.slice(0, 6);

  return (
    <section className="public-home__section" id="gia">
      <div className="public-home__section-head">
        <div>
          <p className="public-home__eyebrow">
            <span className="public-home__live-dot" /> N CẬP NHẬT TRỰC TIẾP
          </p>
          <h2>Giá thu mua hôm nay</h2>
          <p>
            Bảng giá niêm yết chính thức tại vựa Phế Liệu Thiên Nhung. Giá hiển thị minh bạch, cập nhật theo biến động thị trường thu mua hàng ngày.
          </p>
        </div>

      </div>

      {popularMaterials.length === 0 ? (
        <div className="public-home__empty-state">
          <p>Bảng giá các mặt hàng thu mua phổ biến đang được cập nhật.</p>
        </div>
      ) : (
        <div className="public-home__price-grid">
          {popularMaterials.map((item) => {
            const trend = TRENDS[item.name] || { trend: "Ổn định" };
            return (
              <article className="public-home__price-card" key={item.id}>
                <div className="public-home__price-meta">
                  <span className="group-tag">{item.group_name}</span>
                  <h3>{item.name}</h3>
                </div>

                <div className="public-home__price-number">
                  <strong>{formatMoneyShort(Number(item.price_per_kg || 0))}</strong>
                  <small>đ / {item.unit || "kg"}</small>
                </div>

                <div className={`public-home__price-trend ${trend.isDown ? "is-down" : "is-up"}`}>
                  {trend.isDown ? <Icon.TrendingDown className="w-4 h-4" /> : <Icon.TrendingUp className="w-4 h-4" />}
                  <span>{trend.trend}</span>
                </div>

                <button
                  className="public-home__price-calc-btn"
                  onClick={() => onSelectForCalc(item.name)}
                  title="Tính giá mặt hàng này"
                >
                  Ước tính
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
