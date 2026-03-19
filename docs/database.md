# Database Schema — TAHA TripSplit

---

## Tổng quan

Hệ thống sử dụng **2 database**:

- **Supabase PostgreSQL** — server-side, nguồn sự thật (source of truth)
- **Dexie.js (IndexedDB)** — client-side, offline storage + cache

Cả hai chia sẻ chung schema logic, với một số trường bổ sung cho sync.

---

## Entity Relationship Diagram

```
┌──────────┐       ┌──────────────┐       ┌───────────────┐
│  users   │       │  trips       │       │  currencies   │
│──────────│       │──────────────│       │───────────────│
│ id (PK)  │       │ id (PK)      │       │ code (PK)     │
│ email    │       │ name         │       │ name          │
│ name     │       │ description  │       │ symbol        │
│ avatar   │       │ currency_code│──────►│               │
└────┬─────┘       │ status       │       └───────────────┘
     │             │ created_by   │──┐
     │             └──────┬───────┘  │
     │                    │          │
     │    ┌───────────────┼──────────┘
     │    │               │
     ▼    ▼               ▼
┌─────────────────┐  ┌──────────────────┐
│  trip_members   │  │  transactions    │
│─────────────────│  │──────────────────│
│ id (PK)         │  │ id (PK)          │
│ trip_id (FK)    │  │ trip_id (FK)     │
│ user_id (FK)    │  │ paid_by (FK)     │
│ display_name    │  │ amount           │
│ role            │  │ currency_code    │
│ is_guest        │  │ description      │
└─────────────────┘  │ category         │
          ▲          │ type             │
          │          │ split_method     │
          │          │ date             │
          │          └────────┬─────────┘
          │                   │
          │                   ▼
          │          ┌──────────────────┐
          └──────────│ transaction_splits│
                     │──────────────────│
                     │ id (PK)          │
                     │ transaction_id(FK)│
                     │ member_id (FK)   │
                     │ amount           │
                     │ is_settled       │
                     └──────────────────┘

┌─────────────────┐  ┌──────────────────┐
│  groups         │  │  settlements     │
│─────────────────│  │──────────────────│
│ id (PK)         │  │ id (PK)          │
│ name            │  │ trip_id (FK)     │
│ created_by (FK) │  │ from_member (FK) │
│                 │  │ to_member (FK)   │
└────────┬────────┘  │ amount           │
         │           │ is_paid          │
         ▼           │ paid_at          │
┌─────────────────┐  └──────────────────┘
│  group_members  │
│─────────────────│
│ id (PK)         │
│ group_id (FK)   │
│ user_id (FK)    │
└─────────────────┘
```

---

## Tables chi tiết

### users

Quản lý bởi Supabase Auth. Bảng `profiles` mở rộng thông tin user.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Cột          | Kiểu | Mô tả                       |
| ------------ | ---- | --------------------------- |
| id           | UUID | PK, trùng với auth.users.id |
| email        | TEXT | Email đăng ký               |
| display_name | TEXT | Tên hiển thị                |
| avatar_url   | TEXT | URL ảnh đại diện            |

---

### trips

```sql
CREATE TABLE trips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  cover_image_url TEXT,
  currency_code  TEXT NOT NULL DEFAULT 'VND',
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('draft', 'active', 'settled', 'archived')),
  start_date     DATE,
  end_date       DATE,
  invite_code    TEXT UNIQUE NOT NULL DEFAULT nanoid(8),
  share_enabled  BOOLEAN NOT NULL DEFAULT false,
  share_token    TEXT UNIQUE,
  created_by     UUID NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_invite_code ON trips(invite_code);
CREATE INDEX idx_trips_share_token ON trips(share_token);
```

| Cột             | Kiểu    | Mô tả                                           |
| --------------- | ------- | ----------------------------------------------- |
| id              | UUID    | Primary key                                     |
| name            | TEXT    | Tên chuyến đi                                   |
| description     | TEXT    | Mô tả (tuỳ chọn)                                |
| cover_image_url | TEXT    | Ảnh bìa trip                                    |
| currency_code   | TEXT    | Loại tiền mặc định (VND, USD, ...)              |
| status          | TEXT    | Trạng thái: draft / active / settled / archived |
| start_date      | DATE    | Ngày bắt đầu                                    |
| end_date        | DATE    | Ngày kết thúc                                   |
| invite_code     | TEXT    | Mã mời duy nhất (8 ký tự)                       |
| share_enabled   | BOOLEAN | Bật/tắt Share View Bill                         |
| share_token     | TEXT    | Token cho link chỉ-xem (NULL nếu chưa bật)      |
| created_by      | UUID    | FK → profiles.id                                |

---

### trip_members

```sql
CREATE TABLE trip_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id),
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'member')),
  is_guest      BOOLEAN NOT NULL DEFAULT true,
  claimed_by    UUID REFERENCES profiles(id),
  claimed_at    TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(trip_id, user_id)
);

CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user ON trip_members(user_id);
```

| Cột          | Kiểu        | Mô tả                                                     |
| ------------ | ----------- | --------------------------------------------------------- |
| id           | UUID        | Primary key                                               |
| trip_id      | UUID        | FK → trips.id                                             |
| user_id      | UUID        | FK → profiles.id (NULL nếu guest chưa được claim)         |
| display_name | TEXT        | Tên hiển thị trong trip (nhập tay bởi owner)              |
| role         | TEXT        | owner / member                                            |
| is_guest     | BOOLEAN     | True nếu chưa liên kết tài khoản                          |
| claimed_by   | UUID        | FK → profiles.id — user đã claim (chờ duyệt hoặc đã link) |
| claimed_at   | TIMESTAMPTZ | Thời điểm được claim/link thành công                      |

> **Guest members**: Khi thêm thành viên bằng cách nhập tên, `user_id = NULL`, `is_guest = true`. Khi người đó đăng nhập và claim (hoặc owner chỉ định), `user_id` được cập nhật và `is_guest = false`.

---

### transactions

```sql
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by         UUID NOT NULL REFERENCES trip_members(id),
  amount          DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency_code   TEXT NOT NULL DEFAULT 'VND',
  exchange_rate   DECIMAL(15,6) DEFAULT 1.0,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'food', 'accommodation', 'transport',
                      'ticket', 'shopping', 'entertainment',
                      'health', 'other'
                    )),
  type            TEXT NOT NULL DEFAULT 'shared_expense'
                    CHECK (type IN ('shared_expense', 'personal_expense', 'transfer', 'income')),
  split_method    TEXT NOT NULL DEFAULT 'equal'
                    CHECK (split_method IN ('equal', 'exact', 'percentage', 'shares')),
  receipt_url     TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_trip ON transactions(trip_id);
CREATE INDEX idx_transactions_paid_by ON transactions(paid_by);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_category ON transactions(category);
```

| Cột              | Kiểu    | Mô tả                                                 |
| ---------------- | ------- | ----------------------------------------------------- |
| id               | UUID    | Primary key                                           |
| trip_id          | UUID    | FK → trips.id                                         |
| paid_by          | UUID    | FK → trip_members.id (người trả tiền)                 |
| amount           | DECIMAL | Số tiền                                               |
| currency_code    | TEXT    | Loại tiền của giao dịch                               |
| exchange_rate    | DECIMAL | Tỷ giá so với tiền mặc định của trip                  |
| description      | TEXT    | Mô tả giao dịch                                       |
| category         | TEXT    | Danh mục                                              |
| type             | TEXT    | shared_expense / personal_expense / transfer / income |
| split_method     | TEXT    | equal / exact / percentage / shares                   |
| receipt_url      | TEXT    | URL ảnh hoá đơn                                       |
| transaction_date | DATE    | Ngày giao dịch                                        |

---

### transaction_splits

```sql
CREATE TABLE transaction_splits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES trip_members(id),
  amount          DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  is_settled      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(transaction_id, member_id)
);

CREATE INDEX idx_splits_transaction ON transaction_splits(transaction_id);
CREATE INDEX idx_splits_member ON transaction_splits(member_id);
```

| Cột            | Kiểu    | Mô tả                                          |
| -------------- | ------- | ---------------------------------------------- |
| id             | UUID    | Primary key                                    |
| transaction_id | UUID    | FK → transactions.id                           |
| member_id      | UUID    | FK → trip_members.id (người phải trả phần này) |
| amount         | DECIMAL | Số tiền người đó phải chịu                     |
| is_settled     | BOOLEAN | Đã tất toán chưa                               |

---

### settlements

```sql
CREATE TABLE settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES trip_members(id),
  to_member   UUID NOT NULL REFERENCES trip_members(id),
  amount      DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL DEFAULT 'VND',
  is_paid     BOOLEAN NOT NULL DEFAULT false,
  paid_at     TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (from_member != to_member)
);

CREATE INDEX idx_settlements_trip ON settlements(trip_id);
```

| Cột         | Kiểu        | Mô tả                 |
| ----------- | ----------- | --------------------- |
| from_member | UUID        | Người trả (debtor)    |
| to_member   | UUID        | Người nhận (creditor) |
| amount      | DECIMAL     | Số tiền cần trả       |
| is_paid     | BOOLEAN     | Đã thanh toán chưa    |
| paid_at     | TIMESTAMPTZ | Thời điểm thanh toán  |

---

### groups & group_members

```sql
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, user_id)
);
```

---

## Sync Metadata (Client-side only)

Các trường bổ sung chỉ có trên IndexedDB, phục vụ cho offline sync:

```typescript
interface SyncMeta {
  _sync_status: "synced" | "pending" | "conflict" | "error";
  _sync_action: "create" | "update" | "delete";
  _local_updated_at: string; // ISO timestamp
  _server_updated_at: string; // ISO timestamp (từ lần sync cuối)
  _client_id: string; // UUID của client tạo record
}
```

### Dexie.js Schema

```typescript
import Dexie, { type EntityTable } from "dexie";

interface Trip {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  currencyCode: string;
  status: "draft" | "active" | "settled" | "archived";
  startDate?: string;
  endDate?: string;
  inviteCode: string;
  shareEnabled: boolean;
  shareToken?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Sync meta
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

interface TripMember {
  id: string;
  tripId: string;
  userId?: string;
  displayName: string;
  isGuest: boolean;
  claimedBy?: string;
  claimedAt?: string;
  role: "owner" | "member";
  joinedAt: string;
  // Sync meta
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

const db = new Dexie("TahaTripSplit") as Dexie & {
  trips: EntityTable<Trip, "id">;
  tripMembers: EntityTable<TripMember, "id">;
  transactions: EntityTable<Transaction, "id">;
  transactionSplits: EntityTable<TransactionSplit, "id">;
  settlements: EntityTable<Settlement, "id">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
};

db.version(1).stores({
  trips: "id, status, createdBy, shareToken, _syncStatus",
  tripMembers: "id, tripId, userId, isGuest, claimedBy, [tripId+userId]",
  transactions: "id, tripId, paidBy, transactionDate, category, _syncStatus",
  transactionSplits: "id, transactionId, memberId, [transactionId+memberId]",
  settlements: "id, tripId, fromMember, toMember",
  syncQueue: "++id, tableName, recordId, action, status, createdAt",
});
```

---

## Sync Queue Table

```typescript
interface SyncQueueItem {
  id?: number; // Auto-increment
  tableName: string; // 'trips', 'transactions', ...
  recordId: string; // UUID of the record
  action: "create" | "update" | "delete";
  payload: object; // Data snapshot at time of change
  status: "pending" | "in_progress" | "failed";
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}
```

---

## Supabase Functions

### Trigger: auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Áp dụng tương tự cho transactions, settlements, profiles
```

### Function: nanoid cho invite_code

```sql
CREATE OR REPLACE FUNCTION nanoid(size INT DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..size LOOP
    result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```
