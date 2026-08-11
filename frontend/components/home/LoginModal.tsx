import React, { useState } from "react";
import { authApi, type AuthUser } from "../../api/client";
import { Icon } from "../icons";
import BrandLogo from "./BrandLogo";

type LoginProps = {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  error: string;
};

export default function LoginModal({ onClose, onSuccess, error }: LoginProps) {
  const [email, setEmail] = useState("admin@thiennhung.local");
  const [password, setPassword] = useState("Admin@123456");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLocalError("");
    try {
      const result = await authApi.login(email, password);
      onSuccess(result.user);
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <Icon.Close />
        </button>
        <div className="brand">
          <BrandLogo className="brand-logo--login" />
        </div>
        <div className="eyebrow">KHU VỰC ĐĂNG NHẬP</div>
        <h1>Xin chào!</h1>
        <p>Đăng nhập tài khoản của bạn để quản lý tồn kho, xem bảng giá và hóa đơn.</p>

        <label>
          Email đăng nhập
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {(localError || error) && <div className="login-error">{localError || error}</div>}

        <button className="btn primary full" disabled={busy}>
          {busy ? "Đang xử lý..." : "Đăng nhập ngay"}
        </button>

        <small>Tài khoản Demo Admin: admin@thiennhung.local / Admin@123456</small>
      </form>
    </main>
  );
}
