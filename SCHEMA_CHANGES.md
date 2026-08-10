# Schema changes - Thiên Nhung

## Trạng thái

Đây là tài liệu bước 0 của kế hoạch nâng cấp. Migration chưa được chạy trên PostgreSQL thật. Hãy review, backup và chỉ áp dụng khi đã xác nhận xong phương án rollback.

## Audit hiện trạng

Schema hiện có: `users`, `sessions`, `customers`, `materials`, `prices`, `purchase_orders`, `purchase_items`, `sales_orders`, `sales_items`, `inventory`, `inventory_movements`, `audit_logs`.

Các điểm còn thiếu:

- Giá trên đơn chưa có snapshot chuẩn hóa; sửa bảng giá có thể làm sai lịch sử.
- Chưa có lịch sử giá theo vật liệu/khách hàng và quy tắc giảm giá.
- Tồn kho chưa có lot nhập và phân bổ lot khi bán ra nên chưa truy được nguồn gốc chính xác.
- Đơn có thể hủy nhưng thiếu người hủy, thời điểm và lý do.
- Khách vãng lai chưa có nhận diện/bí danh rõ ràng.
- Chưa có chỉ mục tối ưu cho lịch sử khách hàng, đơn, giá và số điện thoại.

## Migration được đề xuất

File: `backend/migrations/001_business_integrity_upgrade.sql`.

Migration thêm:

1. `customers.nickname`, `customers.is_guest`.
2. Trạng thái hoàn tất/hủy và metadata hủy đơn cho `purchase_orders` và `sales_orders`.
3. `purchase_items.price_snapshot`, `sales_items.price_snapshot`, `sales_items.cost_snapshot`.
4. `price_history` để lưu mọi mức giá theo thời gian.
5. `customer_price_rules` cho giảm giá theo khách + mặt hàng, theo số tiền hoặc phần trăm.
6. `inventory_lots` và `inventory_lot_allocations` cho FIFO/COGS và truy xuất nguồn gốc tồn kho.
7. Chỉ mục cho truy vấn khách hàng, đơn, giá, lot và số điện thoại.

## Quyết định nghiệp vụ cần giữ

- `unit_price`/`price_snapshot` là giá thực tế chốt trên từng dòng đơn; không được đọc lại giá hiện tại để sửa hóa đơn cũ.
- Lợi nhuận thực hiện chỉ tính trên hàng đã bán: doanh thu bán ra trừ giá vốn của đúng lượng hàng xuất.
- Khi hủy đơn mua đã hoàn tất, phải hoàn tác lượng nhập và các lot liên quan trong một transaction; không xóa lịch sử.
- Khách vãng lai vẫn được tạo hồ sơ theo tên + số điện thoại để đơn và tồn kho có nguồn gốc; nếu sau đó đăng ký, hồ sơ được liên kết với user thay vì tạo hồ sơ thứ hai.
- Migration không tự ý xóa dữ liệu cũ.

## Xử lý trạng thái cũ

Schema cũ có `draft`, `completed`, `cancelled`. Giai đoạn schema chỉ bổ sung metadata và giữ tương thích dữ liệu. Agent nghiệp vụ sẽ rà soát các bản ghi `draft` hiện có trước khi siết trạng thái tạo mới; không tự động chuyển đổi âm thầm hoặc xóa lịch sử.

## Guest merge và unique phone

Trước khi bật unique phone nghiêm ngặt, cần chạy báo cáo trùng số và merge các hồ sơ guest trùng theo nguyên tắc giữ hồ sơ có đơn nhiều hơn, chuyển `customer_id` của đơn sang hồ sơ giữ lại, rồi ghi audit log. Nếu phát hiện trùng số, index sẽ được tạo thất bại có chủ đích để tránh làm hỏng dữ liệu.

## Guest merge migration

File: `backend/migrations/002_merge_duplicate_guest_customers.sql`.

Script này chỉ gộp các hồ sơ có `is_guest=true` và cùng số điện thoại đã chuẩn hóa. Hồ sơ giữ lại được chọn theo số đơn không bị hủy, ngày giao dịch gần nhất rồi đến `id`; toàn bộ `purchase_orders` được chuyển sang hồ sơ đó và ghi audit.

Merge là thao tác không thể đảo ngược hoàn toàn bằng SQL vì hồ sơ trùng bị xóa. Rollback bắt buộc là restore backup. File rollback đi kèm cố ý dừng với lỗi để không tạo cảm giác an toàn giả.

## Rollback

File: `backend/migrations/001_business_integrity_upgrade.rollback.sql`.

Rollback xóa các bảng/cột mới và dữ liệu phát sinh trong chúng. Vì vậy phải backup trước; rollback không khôi phục dữ liệu mới bị xóa. Không chạy rollback sau khi đã có dữ liệu nghiệp vụ quan trọng nếu chưa có phương án export/restore.

## Reporting migration

File `backend/migrations/003_reporting_views.sql` tạo hai view chuẩn:

- `inventory_flow_report`: đối chiếu nhập + điều chỉnh - xuất với số tồn hiện tại, có `reconciliation_delta` để phát hiện lệch kho.
- `sales_margin_report`: doanh thu, giá vốn, chi phí và lợi nhuận gộp từng dòng bán; ưu tiên `cost_snapshot`, sau đó dùng giá mua gần nhất trước thời điểm bán để tương thích dữ liệu cũ.

Rollback của migration này chỉ xóa view và index báo cáo, không xóa dữ liệu giao dịch.

## Thứ tự triển khai sau khi schema được duyệt

- Group A: pricing history/snapshot/discount, order status + cancellation transaction, guest merge.
- Group B: true COGS/profit, inventory opening-in-out-closing + lot tracing, customer synchronization.
- Group C: UI encoding, shared UI states/confirm dialogs, mobile.
- Group D: financial scenario QA và mobile QA.

## Cách áp dụng khi được duyệt

1. Chạy backup PostgreSQL bằng script `backend/backup-postgres.ps1` với `-RunBackup`.
2. Kiểm tra trùng số điện thoại và các bản ghi trạng thái cũ.
3. Chạy migration trong môi trường test.
4. Chạy test backend và scenario tài chính.
5. Chỉ sau khi đạt mới áp dụng lên database dùng cho demo.

## Checklist deploy

- Đã có backup mới nhất và kiểm tra restore được.
- Đã review migration SQL, rollback SQL và báo cáo thay đổi schema.
- Đã xác nhận không có dữ liệu guest trùng số chưa xử lý, hoặc đã có kế hoạch merge.
- Đã chạy migration ở môi trường test.
- Đã chạy backend test và các scenario tài chính liên quan.
- Đã xác nhận code ứng dụng không phụ thuộc vào trạng thái cũ chưa xử lý.
- Đã lưu lại thời điểm deploy, file backup đã dùng và người duyệt.

## Cách rollback an toàn

1. Dừng ghi dữ liệu mới vào hệ thống.
2. Khôi phục từ file backup gần nhất nếu migration đã chạm dữ liệu nghiệp vụ quan trọng.
3. Nếu chỉ là migration schema thuần, chạy rollback script tương ứng trong môi trường test trước.
4. Xác nhận lại số lượng đơn, khách, lot và báo cáo trước khi mở lại ghi dữ liệu.
