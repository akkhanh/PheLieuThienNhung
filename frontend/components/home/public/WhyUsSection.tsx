import React from "react";
import { type Material } from "../../../api/client";
import { Icon } from "../../icons";

type WhyUsSectionProps = {
  materials: Material[];
};

type SpotlightMaterial = Pick<Material, "id" | "name" | "group_name" | "price_per_kg">;

export default function WhyUsSection({ materials }: WhyUsSectionProps) {
  const defaultSpotlight: SpotlightMaterial[] = [
    { id: 1, name: "Đồng đỏ 99%", group_name: "Kim loại màu", price_per_kg: 220000 },
    { id: 2, name: "Sắt vụn công trình", group_name: "Kim loại đen", price_per_kg: 15500 },
    { id: 3, name: "Nhôm đà đặc", group_name: "Kim loại màu", price_per_kg: 48000 },
    { id: 4, name: "Inox 304 vụn", group_name: "Inox phế liệu", price_per_kg: 38000 },
  ];

  const spotlight: SpotlightMaterial[] = materials.length > 0 ? materials.slice(0, 4) : defaultSpotlight;

  return (
    <section className="public-home__section" id="uu-diem">
      <div className="public-home__statement">
        <div className="statement-content">
          <p className="public-home__eyebrow">
            <span className="public-home__live-dot" /> CAM KẾT UY TÍN
          </p>
          <h2>Đối tác thu mua phế liệu đáng tin cậy nhất TP.HCM</h2>
          <p>
            Với hơn 10 năm kinh nghiệm hoạt động vựa phế liệu tại TP.HCM &amp; các tỉnh lân cận, Thiên Nhung luôn cam kết mang lại mức giá cao nhất, cân đo chuẩn xác 100% và quy trình bốc xếp chuyên nghiệp.
          </p>
          <div className="statement-actions">
            <a
              className="public-home__button public-home__button--solid"
              href="https://zalo.me/0911445553"
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 Tư Vấn Zalo 0911 445 553
            </a>
          </div>
        </div>
        <div className="public-home__statement-image" />
      </div>

      <div className="public-home__features">
        <div className="feature-card">
          <div className="feature-icon-box">
            <Icon.TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <strong>Cân đo điện tử minh bạch</strong>
            <span>Cân chuẩn xác 100% trước sự giám sát của khách hàng</span>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon-box">
            <Icon.Check className="w-6 h-6" />
          </div>
          <div>
            <strong>Thanh toán tức thì</strong>
            <span>Tự động chuyển khoản ngân hàng hoặc nhận tiền mặt tại chỗ</span>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon-box">
            <Icon.Inventory className="w-6 h-6" />
          </div>
          <div>
            <strong>Đội xe bốc xếp 24/7</strong>
            <span>Hỗ trợ thu gom tận nơi bất kể số lượng lớn hay nhỏ</span>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon-box">
            <Icon.Call className="w-6 h-6" />
          </div>
          <div>
            <strong>Hoa hồng cao cho người giới thiệu</strong>
            <span>Chiết khấu hấp dẫn dành cho môi giới &amp; chủ công trình</span>
          </div>
        </div>
      </div>

      <div className="public-home__spotlight">
        <div className="public-home__section-head">
          <div>
            <p className="public-home__eyebrow">
              <span className="public-home__live-dot" /> MẶT HÀNG CHỦ LỰC
            </p>
            <h2>Các dòng phế liệu thu mua số lượng lớn</h2>
          </div>
        </div>

        <div className="public-home__spotlight-grid">
          {spotlight.map((item, idx) => {
            const bgImages = [
              "/scrap_copper.jpg",
              "/scrap_iron.jpg",
              "/scrap_aluminum.jpg",
              "/scrap_hero.jpg",
            ];
            return (
              <article key={item.id || idx} className="spotlight-card">
                <div
                  className="spotlight-img"
                  style={{ backgroundImage: `url(${bgImages[idx % bgImages.length]})` }}
                />
                <div className="spotlight-info">
                  <span className="spotlight-group">{item.group_name}</span>
                  <h3>{item.name}</h3>
                  <span className="spotlight-price">
                    Giá niêm yết: <strong>{new Intl.NumberFormat("vi-VN").format(Number(item.price_per_kg || 0))} đ/kg</strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
