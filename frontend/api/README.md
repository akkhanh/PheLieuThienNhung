# Frontend API boundary

`client.ts` là điểm gọi API duy nhất của frontend. Tất cả request đều gửi `credentials: include` để dùng session cookie HTTP-only. Frontend không tự quyết định role; trạng thái role lấy từ `/api/auth/me` và backend luôn kiểm tra lại quyền.
