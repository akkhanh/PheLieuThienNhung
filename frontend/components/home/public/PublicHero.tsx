import React, { useState } from "react";
import { type Material } from "../../../api/client";
import { Icon } from "../../icons";
import { formatMoneyShort, TRENDS } from "../homeData";
import Hero3DCanvas from "./Hero3DCanvas";

type PublicHeroProps = {
  selectedMaterial: Material | undefined;
  materials?: Material[];
  onSelectMaterial?: (matName: string) => void;
};

type HeroMaterial = Pick<Material, "name" | "price_per_kg" | "group_name" | "unit"> & {
  id?: Material["id"];
};

export default function PublicHero({
  selectedMaterial,
  materials = [],
  onSelectMaterial,
}: PublicHeroProps) {
  const defaultList: HeroMaterial[] = [
    { name: "Đồng đỏ 99%", price_per_kg: 220000, group_name: "Kim loại màu", unit: "kg" },
    { name: "Sắt vụn công trình", price_per_kg: 15500, group_name: "Kim loại đen", unit: "kg" },
    { name: "Nhôm đà đặc", price_per_kg: 48000, group_name: "Kim loại màu", unit: "kg" },
    { name: "Inox 304 vụn", price_per_kg: 38000, group_name: "Inox phế liệu", unit: "kg" },
  ];

  const displayMaterials: HeroMaterial[] = materials.length > 0 ? materials.slice(0, 4) : defaultList;

  const [activeMatName, setActiveMatName] = useState<string>(
    selectedMaterial?.name || displayMaterials[0]?.name || "Đồng đỏ 99%"
  );

  const handleItemClick = (matName: string) => {
    setActiveMatName(matName);
    if (onSelectMaterial) {
      onSelectMaterial(matName);
    }
  };

  return (
    <section className="public-home__hero">
      <Hero3DCanvas />

      <div className="public-home__hero-content">
        <div className="public-home__hero-copy">
          <div className="public-home__eyebrow">
            <span className="public-home__live-dot" />
            ĐANG THU MUA HÔM NAY — TP.HCM &amp; LÂN CẬN
          </div>

          <h1>
            Phế Liệu <span>Thiên Nhung</span>
            <br />
            <span className="hero-subtext">Biến phế liệu thành giá trị thực.</span>
          </h1>

          <p className="public-home__lead">
            Thu mua phế liệu tận nơi tại TP.HCM. Cân đo điện tử công khai, giá niêm yết minh bạch, thanh toán liền tay trong 5 phút.
          </p>

          <div className="public-home__actions">
            <a
              className="public-home__button public-home__button--solid"
              href="https://zalo.me/0911445553"
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 Nhắn Zalo Báo Giá
            </a>
            <a className="public-home__button public-home__button--ghost" href="tel:0911445553">
              <Icon.Call className="w-4 h-4" />
              Gọi 0911 445 553
            </a>
            <a className="public-home__button public-home__button--accent" href="#gia-ung-tinh">
              Ước Tính Nhanh
            </a>
          </div>

          <div className="public-home__hero-stats">
            <div className="stat-card">
              <strong>2.400+</strong>
              <span>Đối tác phục vụ</span>
            </div>
            <div className="stat-card">
              <strong>24 / 7</strong>
              <span>Nhận yêu cầu tận nơi</span>
            </div>
            <div className="stat-card">
              <strong>100%</strong>
              <span>Minh bạch cân đo</span>
            </div>
            <div className="stat-card">
              <strong>5 Phút</strong>
              <span>Thanh toán xong đơn</span>
            </div>
          </div>
        </div>

        {/* Interactive Expandable Scrap Exchange Widget */}
        <div className="public-home__hero-visual">
          <div className="hero-dashboard-card">
            <div className="dashboard-header">
              <div className="dashboard-title">
                <span className="live-dot-pulse" />
                <strong>SÀN GIÁ THU MUA HÔM NAY</strong>
              </div>
              <span className="dashboard-badge">BẤM ĐỂ XEM CHI TIẾT</span>
            </div>

            <div className="dashboard-expandable-list">
              {displayMaterials.map((item, idx) => {
                const isExpanded = item.name === activeMatName;
                const trend = TRENDS[item.name] || { trend: "+2.0%", isDown: false };
                const bgImages = [
                  "/scrap_copper.jpg",
                  "/scrap_iron.jpg",
                  "/scrap_aluminum.jpg",
                  "/scrap_hero.jpg",
                ];
                const itemImg = bgImages[idx % bgImages.length];

                return (
                  <div
                    key={item.id || idx}
                    className={`dashboard-accordion-item ${isExpanded ? "is-expanded" : "is-compact"}`}
                    onClick={() => handleItemClick(item.name)}
                    role="button"
                    tabIndex={0}
                  >
                    {isExpanded ? (
                      /* EXPANDED VIEW */
                      <div className="expanded-card-content">
                        <div className="expanded-header">
                          <div
                            className="expanded-avatar"
                            style={{ backgroundImage: `url(${itemImg})` }}
                          />
                          <div className="expanded-meta">
                            <span className="expanded-tag">{item.group_name || "Phế liệu"}</span>
                            <h4>{item.name}</h4>
                          </div>
                          <span className={`expanded-trend ${trend.isDown ? "is-down" : "is-up"}`}>
                            {trend.trend}
                          </span>
                        </div>

                        <div className="expanded-price-row">
                          <div className="price-box">
                            <span className="price-label">Giá thu mua hôm nay</span>
                            <strong className="price-val">
                              {formatMoneyShort(Number(item.price_per_kg || 0))} <small>đ / {item.unit || "kg"}</small>
                            </strong>
                          </div>
                          <a href="#gia-ung-tinh" className="expanded-calc-btn">
                            Tính giá ngay ➔
                          </a>
                        </div>
                      </div>
                    ) : (
                      /* COMPACT / SHRUNK VIEW */
                      <div className="compact-card-content">
                        <div
                          className="compact-avatar"
                          style={{ backgroundImage: `url(${itemImg})` }}
                        />
                        <div className="compact-info">
                          <strong>{item.name}</strong>
                          <span className="compact-price">{formatMoneyShort(Number(item.price_per_kg || 0))} đ/kg</span>
                        </div>
                        <span className={`compact-trend ${trend.isDown ? "is-down" : "is-up"}`}>
                          {trend.trend}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="dashboard-footer">
              <div className="footer-guarantee">
                <Icon.Check className="w-4 h-4 text-blue-600" />
                <span>Bao vận chuyển đơn &gt; 500kg</span>
              </div>
              <a
                href="https://zalo.me/0911445553"
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-btn"
              >
                Nhắn Zalo Ngay ➔
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="public-home__scroll-hint">
        <a href="#gia">
          <span>Cuộn xuống xem bảng giá</span>
          <div className="scroll-arrow">↓</div>
        </a>
      </div>
    </section>
  );
}
