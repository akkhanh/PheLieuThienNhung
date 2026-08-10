# PRD - Website Quản Lý Vựa Phế Liệu

## 1. Tổng quan

**Mục tiêu:** Xây dựng website hỗ trợ gia đình kinh doanh phế liệu, gồm 2 phần:
- **Trang công khai (Public):** giới thiệu, bảng giá, thu hút khách mới
- **Trang quản lý nội bộ (Admin):** ghi nhận thu mua, quản lý khách hàng, tồn kho, báo cáo doanh thu

**Vấn đề cần giải quyết:**
- Ghi sổ tay dễ sai sót, khó tổng hợp báo cáo
- Không theo dõi được khách hàng quen (ai bán thường xuyên, bán loại gì)
- Không biết chính xác tồn kho từng loại phế liệu để quyết định khi nào bán ra
- Giá phế liệu biến động, khách khó tra cứu giá mới nhất
- Khách hàng vãng lai khó liên hệ, thiếu kênh chuyên nghiệp (chỉ có truyền miệng)

---

## 2. Đối tượng sử dụng

| Vai trò | Mô tả |
|---|---|
| **Chủ vựa / Người quản lý** | Toàn quyền: nhập đơn, sửa giá, xem báo cáo |
| **Nhân viên (nếu có)** | Nhập đơn thu mua, xem tồn kho |
| **Khách vãng lai (public)** | Xem bảng giá, gọi/nhắn Zalo, không cần đăng nhập |

---

## 3. Phạm vi tính năng

### 3.1. Trang công khai (Public Site)

- **Trang chủ:** giới thiệu vựa, khu vực thu mua, hình ảnh thực tế
- **Bảng giá thu mua:** hiển thị giá theo từng loại (sắt, đồng, nhôm, giấy, nhựa, inox...), lấy dữ liệu trực tiếp từ hệ thống admin nên luôn cập nhật
- **Máy tính quy đổi nhanh:** khách nhập số kg → hệ thống tự tính ra số tiền theo giá hiện tại (không cần đăng nhập)
- **Nút liên hệ nổi bật:** gọi điện / chat Zalo
- **SEO địa phương:** tối ưu để lên top khi khách tìm "thu mua phế liệu [khu vực]"

### 3.2. Trang quản lý nội bộ (Admin)

#### a) Quản lý khách hàng
- Danh sách khách hàng: mã KH, tên, SĐT, địa chỉ, ghi chú
- Tìm kiếm nhanh theo tên/SĐT khi tạo đơn
- Lịch sử giao dịch của từng khách: tất cả đơn hàng đã thực hiện
- Thống kê: tổng số lần bán, tổng kg, tổng tiền đã giao dịch → nhận diện "khách mối"
- (Tùy chọn mở rộng) Giá ưu đãi riêng cho khách quen

#### b) Quản lý đơn hàng (phiếu thu mua)
- Tạo đơn mới:
  1. Chọn khách hàng có sẵn hoặc tạo khách hàng mới
  2. Thêm nhiều dòng mặt hàng trong cùng 1 đơn: chọn loại phế liệu → nhập số kg → hệ thống tự lấy đơn giá hiện tại → tự tính thành tiền từng dòng
  3. Tự động cộng tổng tiền toàn đơn
  4. **Chốt đơn giá tại thời điểm giao dịch** (không đổi theo giá về sau, để tính lời lỗ chính xác)
  5. Hoàn tất → sinh phiếu điện tử có mã đơn, ngày giờ, người thực hiện
- Xem lại / in phiếu đơn hàng cũ
- Mỗi đơn hoàn tất sẽ **tự động cộng vào tồn kho** theo từng loại phế liệu

#### c) Quản lý bảng giá
- Cập nhật giá thu mua theo từng loại phế liệu (thay đổi hằng ngày)
- Lịch sử thay đổi giá (biết ngày nào giá bao nhiêu)
- Đồng bộ trực tiếp với bảng giá hiển thị ở trang công khai

#### d) Quản lý tồn kho
- Xem tồn kho hiện tại theo từng loại phế liệu (kg)
- Ghi nhận xuất kho khi bán ra cho đầu mối lớn hơn
- Cảnh báo khi tồn kho 1 loại nào đó vượt ngưỡng (đầy kho, cần bán ra)

#### e) Báo cáo & thống kê
- Doanh thu/chi phí theo ngày / tuần / tháng
- Biểu đồ: loại phế liệu thu mua nhiều nhất, khách hàng đóng góp nhiều nhất
- Lãi/lỗ khi so sánh giá mua vào và giá bán ra (nếu có ghi nhận xuất kho)
- Xuất báo cáo (Excel/PDF) nếu cần

---

## 4. Mô hình dữ liệu (cấu trúc chính)

```
Khách hàng ──┐
             ├──> Đơn hàng ──> Chi tiết đơn hàng (từng loại phế liệu)
Bảng giá ────┘                        │
                                       ▼
                                  Tồn kho (tự cộng dồn)
```

| Bảng | Trường chính |
|---|---|
| **Khách hàng** | mã KH, tên, SĐT, địa chỉ, ghi chú, ngày tạo |
| **Đơn hàng** | mã đơn, khách hàng, ngày giờ, tổng tiền, người thực hiện |
| **Chi tiết đơn hàng** | thuộc đơn nào, loại phế liệu, số kg, đơn giá lúc đó, thành tiền |
| **Bảng giá** | loại phế liệu, giá hiện tại, ngày cập nhật |
| **Tồn kho** | loại phế liệu, tổng kg đang có |

---

## 5. Luồng nghiệp vụ chính (User Flow)

**Luồng tạo đơn thu mua:**
1. Nhân viên/chủ vựa đăng nhập vào Admin
2. Bấm "Tạo đơn mới"
3. Tìm/chọn khách hàng (hoặc tạo mới nếu là khách lần đầu)
4. Thêm từng mặt hàng: loại → số kg → hệ thống tự tính tiền
5. Xem lại tổng đơn → Xác nhận hoàn tất
6. Hệ thống tự động: lưu phiếu điện tử, cộng tồn kho, cập nhật lịch sử khách hàng

**Luồng khách vãng lai xem giá:**
1. Khách vào website → xem bảng giá
2. Dùng máy tính quy đổi để ước lượng số tiền
3. Bấm gọi/Zalo để liên hệ

---

## 6. Yêu cầu phi chức năng

- Giao diện đơn giản, dễ dùng trên điện thoại (vì thao tác thu mua thường ở ngoài hiện trường)
- Admin cần đăng nhập, phân quyền cơ bản (chủ vựa / nhân viên)
- Dữ liệu lưu trữ an toàn, có backup định kỳ
- Trang công khai load nhanh, thân thiện SEO

---

## 7. Định hướng công nghệ (đề xuất, cần thống nhất thêm)

- **Frontend:** React / Next.js (nếu đã biết) hoặc HTML-CSS-JS thuần (nếu mới học)
- **Backend + Database:** 
  - Bắt đầu đơn giản: Google Sheets làm database tạm, kết nối qua API
  - Làm bài bản: Node.js/Express + SQLite hoặc PostgreSQL
- **Triển khai:** Vercel/Netlify (frontend), Railway/Render (backend) - đều có gói miễn phí cho quy mô nhỏ

---

## 8. Các giai đoạn phát triển đề xuất (Roadmap)

| Giai đoạn | Nội dung |
|---|---|
| **Phase 1 - MVP** | Trang công khai (giới thiệu + bảng giá tĩnh) + Admin: tạo đơn hàng, quản lý khách hàng cơ bản |
| **Phase 2** | Tồn kho tự động, báo cáo doanh thu cơ bản |
| **Phase 3** | Máy tính quy đổi trên trang công khai, đồng bộ giá real-time |
| **Phase 4** | Biểu đồ thống kê nâng cao, xuất báo cáo, phân quyền nhân viên |

---

## 9. Câu hỏi cần làm rõ thêm

- Trình độ lập trình hiện tại để chọn công nghệ phù hợp (mới học HTML/CSS/JS, đã biết React, hay biết cả backend)
- Có cần quản lý nhiều nhân viên/phân quyền không, hay chỉ 1 người dùng (chủ vựa)?
- Có cần ghi nhận luôn phần "bán ra" (xuất kho cho đầu mối lớn) để tính lời/lỗ, hay chỉ tập trung phần thu mua trước?
