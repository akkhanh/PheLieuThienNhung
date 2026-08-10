import vinext from "vinext";
import { defineConfig } from "vite";

// Cấu hình frontend tối giản. Backend PostgreSQL chạy độc lập bằng Node.js
// trong thư mục backend/.
export default defineConfig({
  plugins: [vinext()],
});
