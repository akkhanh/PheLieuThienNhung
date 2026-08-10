# Frontend

UI được tách khỏi backend theo các boundary rõ ràng:

- `pages/`: màn hình React được app router gọi.
- `api/`: client và contract gọi backend PostgreSQL.
- `styles/`: CSS của frontend.
- `features/` và `shared/`: nơi mở rộng tiếp các module giao diện.

`app/page.tsx` chỉ là entry adapter rất mỏng để Vinext/Next nhận route `/`.
