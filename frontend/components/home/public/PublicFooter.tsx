import React from "react";
import { Icon } from "../../icons";
import BrandLogo from "../BrandLogo";

export default function PublicFooter() {
  return (
    <footer className="public-home__footer" id="lien-he">
      {/* 1. Integrated Contact Banner Box Inside Footer */}
      <div className="footer-contact-banner">
        <div className="contact-banner-card">
          <div className="contact-banner-info">
            <span className="contact-badge">⚡ THU MUA TẬN NƠI 24/7</span>
            <h2>Bạn có phế liệu cần bán? Liên hệ ngay với Thiên Nhung!</h2>
            <p>
              Chuyên thu mua phế liệu Đồng, Sắt, Nhôm, Inox, Giấy, Nhựa công trình &amp; nhà xưởng giá cao nhất TP.HCM. Cân đo minh bạch, thanh toán liền tay.
            </p>

            <div className="contact-detail-grid">
              <div className="contact-detail-item">
                <div className="detail-icon">📍</div>
                <div>
                  <strong>Địa chỉ vựa chính:</strong>
                  <span>Tam Hải - TP. Đà Nẵng</span>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="detail-icon">⏰</div>
                <div>
                  <strong>Giờ làm việc:</strong>
                  <span>07:00 — 21:00 (Phục vụ cả Thứ 7, Chủ Nhật &amp; Ngày lễ)</span>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="detail-icon">🚚</div>
                <div>
                  <strong>Khu vực thu mua:</strong>
                  <span>Huyện Núi Thành (cũ)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-banner-action">
            <div className="hotline-box">
              <span>BÁO GIÁ TRỰC TIẾP QUA ZALO &amp; HOTLINE</span>
              <a
                href="https://zalo.me/0911445553"
                target="_blank"
                rel="noopener noreferrer"
                className="hotline-number hotline-number--zalo"
              >
                <span>💬 Nhắn Zalo 0911 445 553</span>
              </a>

              <a href="tel:0911442625" className="hotline-number hotline-number--call">
                <Icon.Call className="w-5 h-5" />
                <span>Gọi 0911442625</span>
              </a>

              <small>Tư vấn báo giá miễn phí trong 3 phút</small>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main 4-Column Corporate Footer Grid */}
      <div className="footer-grid">
        <div className="footer-col footer-col--brand">
          <div className="public-home__brand">
            <BrandLogo className="public-home__brand-logo public-home__brand-logo--inverse" />
          </div>
          <p className="footer-desc">
            Vựa phế liệu Thiên Nhung uy tín hàng đầu TP.HCM. Chuyên thu mua đồng, sắt vụn, nhôm, inox, nhà xưởng giá cao tận nơi.
          </p>
          <div className="footer-socials">
            <a
              href="https://zalo.me/0911445553"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-phone-tag"
            >
              💬 Nhắn Zalo: 0911 445 553 · 0911 442 625
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Thông Tin Liên Hệ</h4>
          <ul className="footer-contact-list">
            <li>
              <strong>Nhắn Zalo:</strong>{" "}
              <a
                href="https://zalo.me/0911445553"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 font-bold hover:underline"
              >
                0911 445 553
              </a>
              {" · "}
              <a
                href="https://zalo.me/0911442625"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 font-bold hover:underline"
              >
                0911 442 625
              </a>
            </li>
            <li>
              <strong>Gọi Hotline 24/7:</strong>{" "}
              <a href="tel:0911442625" className="text-sky-300 font-bold hover:underline">
                0911 442 625
              </a>
              {" · "}
              <a href="tel:0911445553" className="text-sky-300 font-bold hover:underline">
                0911 445 553
              </a>
            </li>
            <li>
              <strong>Địa chỉ:</strong> Tam Hải - TP. Đà Nẵng
            </li>
            <li>
              <strong>Giờ mở cửa:</strong> 07:00 — 21:00 hàng ngày
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Danh Mục Thu Mua</h4>
          <ul>
            <li><a href="#gia">Thu mua phế liệu Đồng đỏ, Đồng cáp</a></li>
            <li><a href="#gia">Thu mua phế liệu Sắt vụn, Công trình</a></li>
            <li><a href="#gia">Thu mua phế liệu Nhôm đà, Nhôm máy</a></li>
            <li><a href="#gia">Thu mua phế liệu Inox 304, 201</a></li>
            <li><a href="#gia">Thu mua Giấy Carton &amp; Nhựa PVC/PE</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Cam Kết Chất Lượng</h4>
          <ul>
            <li>✓ Giá thu mua cao nhất TP.HCM</li>
            <li>✓ Cân điện tử chuẩn xác 100%</li>
            <li>✓ Hỗ trợ xe bốc xếp tận nơi miễn phí</li>
            <li>✓ Thanh toán tiền mặt / CK trong 5 phút</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Phế Liệu Thiên Nhung. Tất cả quyền được bảo lưu.</p>
        <div className="footer-links">
          <a href="#gia">Bảng Giá</a>
          <a href="#quy-trinh">Quy Trình</a>
          <a href="#lien-he">Liên Hệ Vựa</a>
        </div>
      </div>

      {/* Floating Action Button Widget */}
      <div className="public-home__floating-widget">
        <a
          href="https://zalo.me/0911445553"
          target="_blank"
          rel="noopener noreferrer"
          className="floating-btn floating-btn--zalo"
          aria-label="Nhắn tin Zalo"
          title="Nhắn Zalo 0911 445 553"
        >
          <span className="zalo-icon-badge">Zalo</span>
          <span>Chat Zalo</span>
        </a>
        <a
          href="tel:0911442625"
          className="floating-btn floating-btn--call"
          aria-label="Gọi điện"
          title="Gọi 0911442625"
        >
          <Icon.Call className="w-5 h-5" />
          <span>Gọi Điện</span>
        </a>
      </div>
    </footer>
  );
}
