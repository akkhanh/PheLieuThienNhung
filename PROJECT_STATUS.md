# Trạng thái dự án Thiên Nhung

Ngày ghi chú: 04/08/2026

## Đã hoàn thành

- Tách source thành `backend` và `frontend`.
- Backend Node.js kết nối PostgreSQL.
- Đăng nhập, đăng ký, session, CSRF và phân quyền `admin` / `customer`.
- Customer chỉ xem được đơn và báo cáo của chính mình.
- Tạo đơn mua, đơn bán ra và cập nhật tồn kho theo transaction.
- Hủy đơn mua có hoàn tác tồn kho và ghi lịch sử điều chỉnh.
- Khách vãng lai được tìm lại theo số điện thoại, không tạo Guest trùng khi số đã tồn tại.
- Mã đơn theo dạng `IN_DDMMYYYY_n` và `OUT_DDMMYYYY_n`.
- Chụp giá tại thời điểm giao dịch; hỗ trợ giá ghi đè và giảm giá theo từng dòng.
- Báo cáo dùng giá vốn hàng thực sự đã xuất theo FIFO; hàng còn trong kho không bị tính là lỗ.
- Báo cáo tồn kho có nhập trong kỳ, xuất trong kỳ, tồn đầu/cuối kỳ và truy ngược nguồn hàng.
- Quản lý bảng giá, bật/tắt công khai, tìm kiếm và lọc nhóm.
- Lịch sử thay đổi giá và audit log có API/UI.
- Quản lý khách hàng có xem/sửa/xóa, lịch sử đơn và tổng giao dịch chỉ tính đơn hoàn tất.
- Giao diện loading, empty, error, modal chi tiết và phân trang.
- Đã sửa lỗi nhảy vị trí khi chuyển trang.
- Có tài liệu vận hành, backup PostgreSQL và hướng dẫn migration.
- Build thành công.

## Kiểm thử gần nhất

- Bộ kiểm thử chính: **22/22 đạt**.
- Bộ kiểm thử chức năng chiết khấu: **18/18 đạt**.
- Bao gồm transaction, phân quyền, customer ownership, guest phone reuse, snapshot giá, hủy đơn, tồn kho và sales.

## Còn phải làm

1. Hoàn thiện UI chuyển khách Guest thành tài khoản customer chính thức và kiểm thử end-to-end.
2. Hiển thị rõ giảm giá, giá gốc, giá sau giảm trong mọi màn xem đơn và invoice của admin/customer.
3. Chạy các migration PostgreSQL trên database thật sau khi backup:
   - `backend/migrations/001_business_integrity_upgrade.sql`
   - `backend/migrations/002_merge_duplicate_guest_customers.sql`
   - `backend/migrations/003_inventory_flow_and_price_audit.sql`
4. Kiểm tra và xử lý các hồ sơ Guest trùng số trước khi bật unique phone nghiêm ngặt.
5. Cấu hình Windows Task Scheduler để backup PostgreSQL tự động; hiện mới có script và tài liệu.
6. Sửa hết các chuỗi tiếng Việt mojibake còn sót trong backend và các file frontend ngoài phạm vi agent đã xử lý.
7. Chạy lại `npx tsc --noEmit` và xử lý các lỗi type còn lại trong CustomersView, OrdersView, CustomerPortal và Home.
8. Kiểm thử thủ công trên mobile và kiểm tra các luồng tạo/hủy đơn, xuất kho, audit log.
9. Trước khi deploy thật: đổi mật khẩu admin demo, kiểm tra `.env`, loại log/build khỏi source và xác nhận backup restore được.

## Cách tiếp tục lần sau

Ưu tiên theo thứ tự: migration + backup an toàn → Guest thành customer → hiển thị discount trong invoice → sửa type/encoding → test full UI.

Không chạy migration tự động nếu chưa xác nhận đã backup database PostgreSQL.
