# UI & Màn hình — TAHA TripSplit

---

## Nguyên tắc thiết kế

- **Mobile-first**: Thiết kế cho màn hình 375px trước, responsive lên tablet/desktop
- **Bottom navigation**: Thanh điều hướng ở dưới (giống app native)
- **Thumb-friendly**: Các nút hành động chính nằm trong vùng ngón cái dễ chạm
- **Minimal taps**: Tối thiểu số bước để hoàn thành hành động thường dùng
- **Dark / Light mode**: Hỗ trợ cả 2, theo system preference

---

## Sitemap

```
├── 🏠 Home (Danh sách trips)
│   ├── Trip Card → Chi tiết Trip
│   └── FAB "+" → Tạo Trip mới
│
├── 📋 Chi tiết Trip
│   ├── Tab: Giao dịch (mặc định)
│   │   ├── Timeline giao dịch theo ngày
│   │   ├── FAB "+" → Tạo Giao dịch
│   │   └── Tap item → Chi tiết Giao dịch
│   ├── Tab: Thành viên
│   │   ├── Danh sách thành viên + balance + badge (Guest/Linked)
│   │   ├── Nút thêm thành viên (nhập tên)
│   │   ├── Nút mời qua link
│   │   └── Claim/Liên kết tài khoản
│   ├── Tab: Tất toán
│   │   ├── Bảng ai nợ ai
│   │   └── Danh sách settlement
│   └── Tab: Thống kê
│       ├── Tổng chi tiêu
│       ├── Biểu đồ tròn (theo danh mục)
│       └── Biểu đồ cột (theo ngày)
│
├── 📱 Share View Bill (/share/{token})
│   ├── Không cần đăng nhập — read-only
│   ├── Tên trip, thành viên, giao dịch, ai nợ ai
│   └── CTA: "Đăng nhập để tham gia"
│
├── 👤 Tài khoản / Settings
│   ├── Profile
│   ├── Liên kết tài khoản (Google + Facebook)
│   ├── Nhóm bạn bè
│   └── Cài đặt app
│
└── 🔐 Auth
    ├── Đăng nhập (Google / Facebook)
    └── Dùng offline
```

---

## Màn hình chi tiết

### 1. Home — Danh sách Trips

```
┌─────────────────────────────┐
│  TAHA TripSplit      [👤]  │  ← Header + avatar
├─────────────────────────────┤
│  🔍 Tìm kiếm trip...       │  ← Search bar
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │ 📸 Đà Lạt 2026     │    │  ← Trip card
│  │ 01/04 - 05/04       │    │     Ảnh bìa + tên + ngày
│  │ 👥 5 người          │    │     Số thành viên
│  │ 💰 2,500,000 VND    │    │     Tổng chi tiêu
│  │ 🟢 Đang diễn ra     │    │     Trạng thái
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ 📸 Phú Quốc 2025   │    │
│  │ 15/12 - 20/12       │    │
│  │ 👥 4 người          │    │
│  │ 💰 5,200,000 VND    │    │
│  │ ✅ Đã tất toán      │    │
│  └─────────────────────┘    │
│                             │
│                             │
├─────────────────────────────┤
│  🏠 Home    ＋ Thêm   ⚙️   │  ← Bottom Nav
└─────────────────────────────┘
```

**Tương tác:**

- Tap trip card → mở chi tiết trip
- Long press → menu ngữ cảnh (sửa, archive, xoá)
- Pull-to-refresh → đồng bộ lại
- FAB (+) → tạo trip mới

---

### 2. Tạo Trip

```
┌─────────────────────────────┐
│  ← Tạo Trip mới            │
├─────────────────────────────┤
│                             │
│  📸 [Chọn ảnh bìa]         │  ← Tap to upload
│                             │
│  Tên chuyến đi *            │
│  ┌─────────────────────┐    │
│  │ Đà Lạt 2026         │    │
│  └─────────────────────┘    │
│                             │
│  Mô tả                     │
│  ┌─────────────────────┐    │
│  │ Chuyến đi cùng nhóm │    │
│  └─────────────────────┘    │
│                             │
│  Loại tiền                  │
│  ┌─────────────────────┐    │
│  │ 🇻🇳 VND           ▼ │    │
│  └─────────────────────┘    │
│                             │
│  Ngày bắt đầu    Ngày kết  │
│  ┌──────────┐ ┌──────────┐ │
│  │01/04/2026│ │05/04/2026│ │
│  └──────────┘ └──────────┘ │
│                             │
│  ┌─────────────────────┐    │
│  │     Tạo Trip        │    │  ← Primary button
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

---

### 3. Chi tiết Trip — Tab Giao dịch

```
┌─────────────────────────────┐
│  ← Đà Lạt 2026       [⚙️]  │
├─────────────────────────────┤
│  💰 Tổng: 2,500,000 VND    │  ← Summary bar
│  Bạn đã trả: 800,000       │
│  Bạn nợ: 50,000            │
├─────────────────────────────┤
│ [Giao dịch] [Thành viên]   │  ← Tab bar
│ [Tất toán]  [Thống kê]     │
├─────────────────────────────┤
│                             │
│  📅 02/04/2026              │  ← Date divider
│  ┌─────────────────────┐    │
│  │ 🍜 Ăn trưa phở     │    │
│  │ Tài trả • 300,000₫  │    │
│  │ Chia 3: 100k/người  │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 🚗 Grab đi chợ     │    │
│  │ Hạnh trả • 45,000₫  │    │
│  │ Chia 2: Tài, Hạnh   │    │
│  └─────────────────────┘    │
│                             │
│  📅 01/04/2026              │
│  ┌─────────────────────┐    │
│  │ 🏨 Homestay         │    │
│  │ Tài trả •1,500,000₫ │    │
│  │ Chia 5: 300k/người  │    │
│  └─────────────────────┘    │
│                             │
│                             │
├─────────────────────────────┤
│ 🏠 Home    ＋ Thêm   ⚙️    │
└─────────────────────────────┘
```

---

### 4. Tạo Giao dịch

```
┌─────────────────────────────┐
│  ← Thêm giao dịch          │
├─────────────────────────────┤
│                             │
│  Loại chi tiêu              │
│  [Chi chung ✓] [Chi riêng]  │  ← Toggle
│                             │
│  Số tiền *                  │
│  ┌─────────────────────┐    │
│  │     300,000      VND│    │  ← Số lớn, dễ nhập
│  └─────────────────────┘    │
│                             │
│  Mô tả *                   │
│  ┌─────────────────────┐    │
│  │ Ăn trưa phở         │    │
│  └─────────────────────┘    │
│                             │
│  Ai trả? *                  │
│  ┌─────────────────────┐    │
│  │ 👤 Tài           ▼  │    │  ← Dropdown member
│  └─────────────────────┘    │
│                             │
│  Cách chia *                │
│  [Đều ✓] [Số tiền] [%] [Phần]│ ← Toggle buttons
│                             │
│  Chia cho ai? *             │
│  ☑ Tài          100,000₫   │
│  ☑ Hạnh         100,000₫   │
│  ☑ Minh         100,000₫   │
│  ☐ Lan                     │
│  ☐ Nam                     │
│                             │
│  Danh mục                  │
│  [🍜] [🏨] [🚗] [🎫]      │  ← Quick select
│  [🛒] [🎉] [💊] [📦]      │
│                             │
│  📅 02/04/2026              │
│  📎 Đính kèm hoá đơn       │
│                             │
│  ┌─────────────────────┐    │
│  │    Lưu giao dịch    │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

**Tương tác quan trọng:**

- Khi chọn "Chia đều": tự tính `amount / số người` cho mỗi người
- Khi chọn "Số tiền": mỗi người nhập số tiền cụ thể, hiện cảnh báo nếu tổng ≠ amount
- Khi chọn "%": mỗi người nhập %, cảnh báo nếu tổng ≠ 100%
- Khi chọn "Phần": mỗi người nhập số phần, tự tính amount

---

### 5. Tab Tất toán (Settlement)

```
┌─────────────────────────────┐
│  ← Đà Lạt 2026       [⚙️]  │
├─────────────────────────────┤
│ [Giao dịch] [Thành viên]   │
│ [Tất toán ✓] [Thống kê]    │
├─────────────────────────────┤
│                             │
│  📊 Balance mỗi người      │
│  ┌─────────────────────┐    │
│  │ Tài    +350,000₫  🟢│    │  ← Được nhận lại
│  │ Hạnh    -50,000₫  🔴│    │  ← Cần trả
│  │ Minh   -200,000₫  🔴│    │
│  │ Lan    -100,000₫  🔴│    │
│  │ Nam          0₫   ⚪│    │  ← Huề
│  └─────────────────────┘    │
│                             │
│  💸 Ai trả ai?             │
│  (Đã tối ưu: 3 → 2 GD)    │
│                             │
│  ┌─────────────────────┐    │
│  │ Minh → Tài          │    │
│  │ 200,000₫            │    │
│  │ [☐ Đã thanh toán]   │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ Lan → Tài           │    │
│  │ 100,000₫            │    │
│  │ [☐ Đã thanh toán]   │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ Hạnh → Tài          │    │
│  │ 50,000₫             │    │
│  │ [☑ Đã thanh toán ✅]│    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

---

### 6. Tab Thống kê

```
┌─────────────────────────────┐
│  ← Đà Lạt 2026       [⚙️]  │
├─────────────────────────────┤
│ [Giao dịch] [Thành viên]   │
│ [Tất toán] [Thống kê ✓]    │
├─────────────────────────────┤
│                             │
│  💰 Tổng chi tiêu          │
│  ┌─────────────────────┐    │
│  │    2,500,000 VND    │    │
│  │    5 ngày • 12 GD   │    │
│  │    500k/người/ngày   │    │
│  └─────────────────────┘    │
│                             │
│  📊 Theo danh mục          │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │    [Pie Chart]      │    │
│  │    🍜 40% Ăn uống   │    │
│  │    🏨 35% Lưu trú   │    │
│  │    🚗 15% Di chuyển  │    │
│  │    📦 10% Khác      │    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
│  📊 Theo ngày              │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │    [Bar Chart]      │    │
│  │  █ █ █████ ██ █     │    │
│  │  1  2  3   4  5     │    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
│  👥 Theo người             │
│  Tài:  đã trả  1,800,000₫  │
│  Hạnh: đã trả    450,000₫  │
│  Minh: đã trả    250,000₫  │
│  Lan:  đã trả          0₫  │
│  Nam:  đã trả          0₫  │
│                             │
└─────────────────────────────┘
```

---

### 7. Tab Thành viên

```
┌─────────────────────────────┐
│  ← Đà Lạt 2026       [⚙️]  │
├─────────────────────────────┤
│ [Giao dịch] [Thành viên ✓] │
│ [Tất toán] [Thống kê]      │
├─────────────────────────────┤
│                             │
│  👥 5 thành viên            │
│                             │
│  ┌─────────────────────┐    │
│  │ 👤 Tài        👑    │    │  ← Owner badge
│  │ Balance: +350,000₫  │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 👤 Hạnh             │    │
│  │ Balance: -50,000₫   │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 👤 Minh             │    │
│  │ Balance: -200,000₫  │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 👤 Lan   (Guest)    │    │  ← Guest badge
│  │ Balance: -100,000₫  │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 👤 Nam              │    │
│  │ Balance: 0₫         │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │  🔗 Mời thành viên  │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │  ➕ Thêm guest      │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

---

### 8. Mời thành viên

```
┌─────────────────────────────┐
│  ← Mời thành viên          │
├─────────────────────────────┤
│                             │
│  Chia sẻ link mời          │
│                             │
│  ┌─────────────────────┐    │
│  │ taha.app/join/AbCd  │    │
│  │         [📋 Copy]   │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │      [QR Code]      │    │
│  │                     │    │
│  │    ██████████████    │    │
│  │    ██          ██    │    │
│  │    ██████████████    │    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
│  Hoặc chia sẻ qua:         │
│  [Zalo] [Messenger] [Copy] │
│                             │
│  ─── Hoặc thêm tay ──────  │
│                             │
│  Tên *                      │
│  ┌─────────────────────┐    │
│  │ Nhập tên bạn bè     │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Thêm như Guest      │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

---

### 9. Auth — Đăng nhập

```
┌─────────────────────────────┐
│                             │
│                             │
│     🧳 TAHA TripSplit     │
│     Chia tiền dễ dàng      │
│                             │
│                             │
│  ┌─────────────────────┐    │
│  │  🔵 Tiếp tục với    │    │
│  │     Google          │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │  🔵 Tiếp tục với    │    │
│  │     Facebook        │    │
│  └─────────────────────┘    │
│                             │
│  ──────────────────────     │
│  [Dùng offline không cần    │
│   đăng nhập →]              │
│                             │
└─────────────────────────────┘
```

**Cấu trúc đơn giản:** Chỉ 2 nút Google + Facebook + link dùng offline.

---

### 10. Share View Bill (Trang chỉ xem)

Link: `/share/{share_token}` — không cần đăng nhập

```
┌─────────────────────────────┐
│  🧳 Đà Lạt 2026           │
│  01/04 - 05/04 • 5 người   │
├─────────────────────────────┤
│                             │
│  💰 Tổng chi tiêu          │
│  ┌─────────────────────┐    │
│  │    2,500,000 VND    │    │
│  │    500k/người       │    │
│  └─────────────────────┘    │
│                             │
│  📅 02/04/2026              │
│  ┌─────────────────────┐    │
│  │ 🍜 Ăn trưa phở     │    │
│  │ Tài trả • 300,000₫  │    │
│  │ Chia 3: 100k/người  │    │
│  └─────────────────────┘    │
│                             │
│  💸 Ai trả ai?             │
│  ┌─────────────────────┐    │
│  │ Minh → Tài: 200,000₫│    │
│  │ Lan  → Tài: 100,000₫│    │
│  │ Hạnh → Tài:  50,000₫│    │
│  └─────────────────────┘    │
│                             │
│  ──────────────────────     │
│  Chỉ xem • Không thể chỉnh  │
│  sửa. Đăng nhập để tham gia │
│  [Đăng nhập để tham gia →] │
│                             │
└─────────────────────────────┘
```

**Đặc điểm:**

- Không có nút sửa/xóa/thêm
- Không hiển email/sđt thành viên, chỉ hiện tên
- Có CTA "Đăng nhập để tham gia" ở cuối trang
- Responsive, hoạt động trên mọi thiết bị

---

## Sync Status Indicator

Hiển thị ở header hoặc bottom bar:

```
🟢 Đã đồng bộ           — Tất cả data đã sync
🟡 Đang đồng bộ (3)...  — 3 thay đổi đang sync
🔴 Offline (5 pending)   — Không có mạng, 5 thay đổi chờ sync
⚠️ Lỗi đồng bộ          — Có conflict cần giải quyết
```

---

## Responsive Layout

### Mobile (< 768px)

- Single column layout
- Bottom navigation bar
- Full-screen modals cho form
- Swipe gestures

### Tablet (768px - 1024px)

- 2-column layout (trip list + detail)
- Side navigation

### Desktop (> 1024px)

- 3-column layout (trips | transactions | detail)
- Top navigation bar
- Dialogs thay vì full-screen modals

---

## Component Library (shadcn/ui)

| Component            | Sử dụng cho                      |
| -------------------- | -------------------------------- |
| **Button**           | CTA, actions                     |
| **Card**             | Trip card, transaction card      |
| **Dialog / Sheet**   | Forms trên mobile (bottom sheet) |
| **Input / Textarea** | Form fields                      |
| **Select**           | Dropdown (member, currency, ...) |
| **Tabs**             | Trip detail tabs                 |
| **Avatar**           | User/member avatar               |
| **Badge**            | Status, role badges              |
| **Toast**            | Success/error notifications      |
| **Checkbox**         | Settlement paid toggle           |
| **Toggle Group**     | Split method selector            |
| **Skeleton**         | Loading states                   |
