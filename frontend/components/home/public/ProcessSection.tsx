import React from "react";
import { Icon } from "../../icons";

const STEPS = [
  {
    step: "01",
    title: "Liên hệ & Báo giá nhanh",
    desc: "Gọi điện hoặc nhắn tin kèm ảnh phế liệu. Đội ngũ Thiên Nhung phản hồi báo giá trong vòng 3 phút.",
    icon: Icon.Call,
  },
  {
    step: "02",
    title: "Tận nơi khảo sát & Cân đo",
    desc: "Nhân viên đến tận công trình hoặc kho bãi, cân điện tử công khai trước sự giám sát của khách hàng.",
    icon: Icon.TrendingUp,
  },
  {
    step: "03",
    title: "Bốc xếp & Vận chuyển",
    desc: "Đội xe tải bốc xếp chuyên nghiệp hỗ trợ thu gom nhanh gọn, không làm gián đoạn sinh hoạt hay sản xuất.",
    icon: Icon.Inventory,
  },
  {
    step: "04",
    title: "Thanh toán liền tay",
    desc: "Thanh toán 100% tiền mặt hoặc chuyển khoản ngân hàng ngay khi chốt số kg, kèm dọn dẹp mặt bằng sạch sẻ.",
    icon: Icon.Check,
  },
];

export default function ProcessSection() {
  return (
    <section className="public-home__section public-home__process" id="quy-trinh">
      <div className="public-home__section-head text-center">
        <div>
          <p className="public-home__eyebrow justify-center">
            <span className="public-home__live-dot" /> QUY TRÌNH CHUYÊN NGHIỆP
          </p>
          <h2>Thu mua 4 bước nhanh gọn, không lo ép giá</h2>
          <p>
            Quy trình làm việc minh bạch, uy tín tuyệt đối. Giúp bạn tiết kiệm thời gian và thu hồi tối đa giá trị phế liệu.
          </p>
        </div>
      </div>

      <div className="public-home__process-grid">
        {STEPS.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <article key={idx} className="process-card">
              <div className="process-card__header">
                <span className="process-card__number">{item.step}</span>
                <div className="process-card__icon">
                  <IconComp className="w-6 h-6" />
                </div>
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <div className="process-card__step-line" />
            </article>
          );
        })}
      </div>
    </section>
  );
}
