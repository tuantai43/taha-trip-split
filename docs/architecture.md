# Kiến trúc hệ thống — TAHA TripSplit

---

## Tổng quan kiến trúc

Ứng dụng theo mô hình **Offline-First Client** với **Backend-as-a-Service (Supabase)**. Mọi thao tác đều xảy ra trên client trước (IndexedDB), sau đó được đồng bộ lên server khi có mạng.

```
┌──────────────────────────────────────────────────────────────┐
│                      CLIENT (PWA)                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    UI Layer                           │    │
│  │  Vue Components + Vue Router + Vee-Validate            │    │
│  └────────────────────────┬─────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼─────────────────────────────┐    │
│  │                  State Layer                          │    │
│  │         Pinia Store + TanStack Query                  │    │
│  └──────┬───────────────────────────────────┬───────────┘    │
│         │                                   │                │
│  ┌──────▼──────────┐              ┌─────────▼───────────┐    │
│  │  Local Database │              │   Sync Engine        │    │
│  │  Dexie.js       │◄────────────►│   (Queue + Resolver) │    │
│  │  (IndexedDB)    │              └─────────┬───────────┘    │
│  └─────────────────┘                        │                │
│                                             │                │
│  ┌──────────────────────────────────────────┤                │
│  │  Service Worker (Workbox)                │                │
│  │  - App Shell caching                     │                │
│  │  - Background Sync                       │                │
│  └──────────────────────────────────────────┤                │
└─────────────────────────────────────────────┼────────────────┘
                                              │
                              ┌───────────────▼────────────────┐
                              │          SUPABASE              │
                              │                                │
                              │  ┌──────────┐ ┌────────────┐  │
                              │  │ Auth     │ │ Realtime   │  │
                              │  └──────────┘ └────────────┘  │
                              │  ┌──────────┐ ┌────────────┐  │
                              │  │PostgreSQL│ │ Storage    │  │
                              │  └──────────┘ └────────────┘  │
                              │  ┌──────────────────────────┐  │
                              │  │ Edge Functions           │  │
                              │  └──────────────────────────┘  │
                              └────────────────────────────────┘
```

---

## Layers chi tiết

### 1. UI Layer

```
src/
├── components/          # Shared UI components
│   ├── ui/              # shadcn/ui base components
│   ├── layout/          # Layout components (Header, Nav, ...)
│   └── common/          # App-specific shared components
├── pages/               # Route pages (Vue components)
│   ├── home/
│   ├── trip/
│   ├── transaction/
│   ├── settlement/
│   ├── stats/
│   ├── share/           # Share View Bill (public)
│   └── auth/
├── composables/         # Vue composables (thay thế React hooks)
├── lib/                 # Utility functions
├── types/               # TypeScript type definitions
└── App.vue              # Root component + Router
```

**Nguyên tắc:**

- Component nhỏ, đơn nhiệm (single responsibility)
- UI component thuần tuý, không chứa business logic
- Sử dụng composables để tách logic ra khỏi component

### 2. State Layer

```
src/
├── stores/              # Pinia stores
│   ├── authStore.ts     # Authentication state
│   ├── tripStore.ts     # Active trip state
│   └── uiStore.ts       # UI state (modals, toasts, ...)
├── queries/             # TanStack Query composables
│   ├── useTripQueries.ts
│   ├── useTransactionQueries.ts
│   └── useSettlementQueries.ts
└── services/            # Business logic services
    ├── tripService.ts
    ├── transactionService.ts
    ├── splitService.ts
    └── settlementService.ts
```

**Phân chia trách nhiệm:**

| Layer              | Trách nhiệm                    | Ví dụ                                 |
| ------------------ | ------------------------------ | ------------------------------------- |
| **Pinia**          | Client-only state, UI state    | Active trip ID, modal open/close      |
| **TanStack Query** | Server state, caching, refetch | Danh sách trip, giao dịch             |
| **Services**       | Business logic thuần           | Tính toán split, settlement algorithm |

### 3. Data Layer (Local Database)

```
src/
├── db/
│   ├── schema.ts        # Dexie table definitions
│   ├── database.ts      # Database instance
│   ├── migrations.ts    # Schema migrations
│   └── repositories/    # Data access layer
│       ├── tripRepo.ts
│       ├── transactionRepo.ts
│       ├── memberRepo.ts
│       └── syncRepo.ts
```

**Data flow:**

```
UI Action → Service → Repository → Dexie (IndexedDB)
                                        │
                                        ▼
                                  Sync Queue (nếu online → push lên Supabase)
```

### 4. Sync Layer

```
src/
├── sync/
│   ├── syncEngine.ts       # Core sync orchestrator
│   ├── syncQueue.ts        # Pending changes queue
│   ├── conflictResolver.ts # Handle sync conflicts
│   ├── realtimeListener.ts # Supabase realtime subscription
│   └── networkStatus.ts    # Online/offline detection
```

> Chi tiết sync strategy tại [offline-sync.md](offline-sync.md)

---

## Luồng dữ liệu chính

### Tạo giao dịch (Offline-first)

```
┌─────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│ User │────►│ UI Form  │────►│  Service  │────►│ Dexie.js │
└─────┘     └──────────┘     │ (validate │     │(IndexedDB)│
                              │  + split  │     └─────┬────┘
                              │  calc)    │           │
                              └───────────┘           │
                                                      ▼
            ┌──────────┐     ┌───────────┐     ┌──────────┐
            │ Supabase │◄────│Sync Engine│◄────│Sync Queue│
            │   (DB)   │     │           │     │ (pending) │
            └──────────┘     └───────────┘     └──────────┘
```

**Bước chi tiết:**

1. User nhập thông tin giao dịch
2. Service validate input + tính toán split amounts
3. Lưu vào IndexedDB (qua Dexie.js) — **UI cập nhật ngay lập tức**
4. Thêm vào Sync Queue với trạng thái `pending`
5. Nếu online: Sync Engine push lên Supabase
6. Nếu offline: Nằm trong queue, chờ có mạng

### Đồng bộ từ server (Realtime)

```
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌──────────┐
│ Supabase │────►│ Realtime  │────►│ Conflict  │────►│ Dexie.js │
│ (change) │     │ Listener  │     │ Resolver  │     │(IndexedDB)│
└──────────┘     └───────────┘     └───────────┘     └─────┬────┘
                                                           │
                                                           ▼
                                                    ┌──────────┐
                                                    │  Pinia    │
                                                    │  + Vue    │
                                                    │  (re-render)│
                                                    └──────────┘
```

---

## Routing Structure

```
/                           → Home (danh sách trips)
/auth/login                 → Đăng nhập (Google / Facebook)
/trip/new                   → Tạo trip mới
/trip/:tripId               → Chi tiết trip (tab: giao dịch, thành viên, thống kê)
/trip/:tripId/transaction/new → Thêm giao dịch
/trip/:tripId/transaction/:txId → Chi tiết giao dịch
/trip/:tripId/settle        → Tất toán / Settlement
/trip/:tripId/stats         → Thống kê trip
/trip/:tripId/settings      → Cài đặt trip
/trip/:tripId/invite        → Mời thành viên
/share/:token               → Share View Bill (public, read-only)
/groups                     → Quản lý nhóm bạn bè
/settings                   → Cài đặt app
```

---

## Security

### Client-side

- Supabase RLS (Row Level Security) — user chỉ truy cập được data của trip mình tham gia
- Validate input bằng Zod schema trước khi lưu
- Sanitize user input để chống XSS
- HTTPS only

### Supabase RLS Policies (ví dụ)

```sql
-- User chỉ xem được trip mình là thành viên
CREATE POLICY "Users can view their trips"
ON trips FOR SELECT
USING (
  id IN (
    SELECT trip_id FROM trip_members
    WHERE user_id = auth.uid()
  )
);

-- User chỉ tạo giao dịch trong trip mình tham gia
CREATE POLICY "Members can create transactions"
ON transactions FOR INSERT
WITH CHECK (
  trip_id IN (
    SELECT trip_id FROM trip_members
    WHERE user_id = auth.uid()
  )
);
```

### Data Privacy

- Mật khẩu hash bởi Supabase Auth (bcrypt)
- Không log sensitive data
- Chỉ hỗ trợ đăng nhập qua Google / Facebook OAuth
- Người dùng có thể xoá tài khoản và toàn bộ data

---

## Error Handling Strategy

| Layer         | Strategy                                          |
| ------------- | ------------------------------------------------- |
| **UI**        | Error boundaries, toast notifications             |
| **API calls** | TanStack Query retry (3 lần), exponential backoff |
| **Sync**      | Queue retry với backoff, conflict resolution      |
| **Database**  | Dexie transaction rollback                        |

---

## Performance Considerations

| Concern           | Solution                                              |
| ----------------- | ----------------------------------------------------- |
| Bundle size       | Tree-shaking, lazy loading routes                     |
| First paint       | App shell cached bởi Service Worker                   |
| Large trip data   | Pagination, virtual scrolling cho danh sách giao dịch |
| Realtime overhead | Subscribe chỉ trip đang active                        |
| Re-renders        | Vue reactivity, computed, shallowRef, Pinia selectors |
