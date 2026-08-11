import React, { useState } from "react";
import { Icon } from "../../icons";
import BrandLogo from "../BrandLogo";

type PublicHeaderProps = {
  onOpenLogin: () => void;
};

export default function PublicHeader({ onOpenLogin }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="public-home__header">
      <div className="public-home__brand">
        <BrandLogo className="public-home__brand-logo" />
      </div>

      <nav className={`public-home__nav ${mobileMenuOpen ? "is-open" : ""}`}>
        <a href="#gia" onClick={() => setMobileMenuOpen(false)}>
          Bảng Giá Niêm Yết
        </a>
        <a href="#gia-ung-tinh" onClick={() => setMobileMenuOpen(false)}>
          Tính Giá Nhanh
        </a>
        <a href="#quy-trinh" onClick={() => setMobileMenuOpen(false)}>
          Quy Trình 3 Bước
        </a>
        <a href="#uu-diem" onClick={() => setMobileMenuOpen(false)}>
          Cam Kết & Ưu Điểm
        </a>
        <a href="#lien-he" onClick={() => setMobileMenuOpen(false)}>
          Liên Hệ Vựa
        </a>
      </nav>

      <div className="public-home__header-actions">
        <a href="tel:0911445553" className="public-home__header-call">
          <Icon.Call className="w-4 h-4" />
          <span>0911 445 553</span>
        </a>

        <button className="public-home__login" onClick={onOpenLogin}>
          <span>Đăng nhập</span>
          <Icon.ArrowRight className="w-4 h-4" />
        </button>

        <button
          className="public-home__mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
