# Quy ước TEST dự án

Khi yêu cầu `TEST`, cần kiểm tra đủ 3 lớp:

1. **Build**: frontend build, TypeScript/JSX, import và bundle.
2. **Backend/API**: auth, phân quyền admin/customer, validation, transaction, đơn mua, đơn bán, tồn kho, hóa đơn và báo cáo PostgreSQL.
3. **Trình duyệt thực tế**: mở web, đăng nhập bằng các role, đi qua các luồng chính, theo dõi Console và Network, kiểm tra lỗi runtime/UI, chụp hoặc ghi nhận lỗi rồi sửa và chạy lại.

Không được chỉ kết luận TEST pass dựa trên build/API nếu chưa kiểm tra các luồng giao diện có liên quan.
