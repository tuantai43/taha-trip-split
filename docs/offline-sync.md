# Chiến lược Offline & Đồng bộ dữ liệu — TAHA TripSplit

---

## Tổng quan

TAHA TripSplit theo kiến trúc **Offline-First**: mọi thao tác CRUD xảy ra trên local database (IndexedDB) trước. Dữ liệu được đồng bộ lên Supabase khi có kết nối mạng. Khi offline, ứng dụng vẫn hoạt động đầy đủ.

```
User Action → Write to IndexedDB → UI cập nhật ngay (optimistic)
                    │
                    ▼
              Sync Queue (pending)
                    │
                    ▼ (khi có mạng)
              Push to Supabase
                    │
                    ▼
              Mark as synced
```

---

## Kiến trúc Sync

### Các thành phần

```
┌──────────────────────────────────────────────────┐
│                 SYNC ENGINE                       │
│                                                  │
│  ┌───────────────┐    ┌────────────────────┐     │
│  │ Network       │    │ Sync Queue         │     │
│  │ Monitor       │    │ (IndexedDB table)  │     │
│  │               │    │                    │     │
│  │ online/offline│    │ pending changes    │     │
│  │ detection     │    │ retry logic        │     │
│  └──────┬────────┘    └─────────┬──────────┘     │
│         │                       │                │
│         ▼                       ▼                │
│  ┌───────────────┐    ┌────────────────────┐     │
│  │ Push          │    │ Pull               │     │
│  │ Manager       │    │ Manager            │     │
│  │               │    │                    │     │
│  │ local → server│    │ server → local     │     │
│  └──────┬────────┘    └─────────┬──────────┘     │
│         │                       │                │
│         ▼                       ▼                │
│  ┌──────────────────────────────────────────┐    │
│  │         Conflict Resolver                │    │
│  │   last-write-wins / manual resolution    │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 1. Network Monitor

Phát hiện trạng thái mạng và trigger sync:

```typescript
class NetworkMonitor {
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    window.addEventListener("online", () => this.notify(true));
    window.addEventListener("offline", () => this.notify(false));
  }

  get isOnline(): boolean {
    return navigator.onLine;
  }

  onChange(callback: (online: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(online: boolean) {
    this.listeners.forEach((cb) => cb(online));
  }
}
```

**Khi online lại:**

1. Trigger push: đẩy pending changes lên server
2. Trigger pull: kéo changes mới từ server
3. Resolve conflicts nếu có

---

## 2. Sync Queue

Mọi thay đổi local được ghi vào queue trước:

```typescript
interface SyncQueueItem {
  id?: number; // Auto-increment
  tableName: string; // 'trips', 'transactions', ...
  recordId: string; // UUID of the record
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>; // Data snapshot
  status: "pending" | "in_progress" | "failed";
  retryCount: number;
  maxRetries: number; // Default: 5
  errorMessage?: string;
  createdAt: string; // ISO timestamp
}
```

### Luồng hoạt động

```
1. User tạo giao dịch
2. Lưu vào IndexedDB (transactions table)
3. Thêm vào syncQueue:
   {
     tableName: 'transactions',
     recordId: 'uuid-123',
     action: 'create',
     payload: { ... transaction data ... },
     status: 'pending',
     retryCount: 0
   }
4. Nếu online → SyncEngine xử lý ngay
5. Nếu offline → Nằm trong queue chờ
```

### Xử lý queue

```typescript
class SyncQueue {
  async processQueue(): Promise<void> {
    const pendingItems = await db.syncQueue
      .where("status")
      .equals("pending")
      .sortBy("createdAt");

    for (const item of pendingItems) {
      try {
        // Đánh dấu đang xử lý
        await db.syncQueue.update(item.id!, { status: "in_progress" });

        // Push lên server
        await this.pushToServer(item);

        // Thành công → xoá khỏi queue + cập nhật sync status
        await db.syncQueue.delete(item.id!);
        await this.markAsSynced(item.tableName, item.recordId);
      } catch (error) {
        // Thất bại → retry hoặc mark failed
        const newRetryCount = item.retryCount + 1;
        if (newRetryCount >= item.maxRetries) {
          await db.syncQueue.update(item.id!, {
            status: "failed",
            retryCount: newRetryCount,
            errorMessage: error.message,
          });
        } else {
          await db.syncQueue.update(item.id!, {
            status: "pending",
            retryCount: newRetryCount,
          });
        }
      }
    }
  }

  private async pushToServer(item: SyncQueueItem): Promise<void> {
    const { tableName, action, recordId, payload } = item;

    switch (action) {
      case "create":
        await supabase.from(tableName).insert(payload);
        break;
      case "update":
        await supabase.from(tableName).update(payload).eq("id", recordId);
        break;
      case "delete":
        await supabase.from(tableName).delete().eq("id", recordId);
        break;
    }
  }
}
```

---

## 3. Push Manager (Local → Server)

### Thứ tự đồng bộ

Đồng bộ theo thứ tự dependency:

```
1. profiles      (không phụ thuộc gì)
2. trips         (phụ thuộc profiles)
3. trip_members  (phụ thuộc trips + profiles)
4. transactions  (phụ thuộc trips + trip_members)
5. transaction_splits (phụ thuộc transactions + trip_members)
6. settlements   (phụ thuộc trips + trip_members)
```

### Batch Processing

```typescript
// Gom nhóm theo table, push theo batch
async function pushBatch(
  tableName: string,
  items: SyncQueueItem[],
): Promise<void> {
  const creates = items.filter((i) => i.action === "create");
  const updates = items.filter((i) => i.action === "update");
  const deletes = items.filter((i) => i.action === "delete");

  // Batch insert
  if (creates.length > 0) {
    await supabase.from(tableName).insert(creates.map((i) => i.payload));
  }

  // Updates & deletes phải xử lý từng cái (có thể conflict)
  for (const item of updates) {
    await supabase.from(tableName).update(item.payload).eq("id", item.recordId);
  }
  for (const item of deletes) {
    await supabase.from(tableName).delete().eq("id", item.recordId);
  }
}
```

---

## 4. Pull Manager (Server → Local)

### Initial Sync

Khi user đăng nhập lần đầu hoặc trên device mới:

```typescript
async function initialSync(): Promise<void> {
  // Kéo tất cả trips user tham gia
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("updated_at", { ascending: false });

  // Lưu vào IndexedDB
  await db.trips.bulkPut(
    trips.map((t) => ({
      ...t,
      _syncStatus: "synced",
    })),
  );

  // Tương tự cho members, transactions, splits, settlements
  // ...
}
```

### Incremental Sync

Chỉ kéo data thay đổi từ lần sync cuối:

```typescript
async function incrementalSync(): Promise<void> {
  const lastSyncAt = await getLastSyncTimestamp();

  const { data: changes } = await supabase
    .from("transactions")
    .select("*")
    .gt("updated_at", lastSyncAt)
    .order("updated_at", { ascending: true });

  for (const change of changes) {
    const local = await db.transactions.get(change.id);

    if (!local) {
      // Record mới từ server → insert local
      await db.transactions.put({ ...change, _syncStatus: "synced" });
    } else if (local._syncStatus === "synced") {
      // Local không có pending change → cập nhật từ server
      await db.transactions.put({ ...change, _syncStatus: "synced" });
    } else {
      // CONFLICT: cả local và server đều thay đổi
      await handleConflict("transactions", local, change);
    }
  }

  await setLastSyncTimestamp(new Date().toISOString());
}
```

### Realtime Updates

Nhận thay đổi realtime qua WebSocket:

```typescript
function subscribeToTripChanges(tripId: string): void {
  supabase
    .channel(`trip:${tripId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transactions",
        filter: `trip_id=eq.${tripId}`,
      },
      async (payload) => {
        switch (payload.eventType) {
          case "INSERT":
            await db.transactions.put({
              ...payload.new,
              _syncStatus: "synced",
            });
            break;
          case "UPDATE":
            await db.transactions.put({
              ...payload.new,
              _syncStatus: "synced",
            });
            break;
          case "DELETE":
            await db.transactions.delete(payload.old.id);
            break;
        }
      },
    )
    .subscribe();
}
```

---

## 5. Conflict Resolution

### Khi nào xảy ra conflict?

```
Timeline:
  t1: User A (offline) sửa giao dịch X → lưu local
  t2: User B (online) sửa giao dịch X → lưu server
  t3: User A online lại → push change → CONFLICT!
```

### Chiến lược: Last-Write-Wins (LWW) + Field-level merge

```typescript
async function handleConflict(
  tableName: string,
  localRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown>,
): Promise<void> {
  const localUpdatedAt = new Date(localRecord._localUpdatedAt as string);
  const serverUpdatedAt = new Date(serverRecord.updated_at as string);

  if (serverUpdatedAt > localUpdatedAt) {
    // Server wins — cập nhật local từ server
    await db.table(tableName).put({
      ...serverRecord,
      _syncStatus: "synced",
    });
  } else {
    // Local wins — push local lên server
    // (giữ trong sync queue, sẽ được push)
    await db.table(tableName).update(localRecord.id as string, {
      _syncStatus: "pending",
    });
  }
}
```

### Conflict trên delete

| Trường hợp            | Giải pháp                    |
| --------------------- | ---------------------------- |
| Local sửa, Server xoá | Server wins → xoá local      |
| Local xoá, Server sửa | Local wins → xoá trên server |
| Cả hai xoá            | Không conflict               |

### Manual Resolution (cho trường hợp phức tạp)

Nếu conflict không thể auto-resolve:

```typescript
interface ConflictRecord {
  tableName: string;
  recordId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  detectedAt: string;
}

// Lưu vào bảng conflicts, hiện UI cho user chọn
await db.conflicts.put(conflictRecord);
// → UI hiện dialog: "Phiên bản của bạn" vs "Phiên bản mới nhất"
```

---

## 6. Service Worker Strategy

### Caching Strategies

```typescript
// vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt", // Hỏi user trước khi update
      workbox: {
        // Precache app shell
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // Supabase API (cho fallback khi offline)
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Receipt images
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage/,
            handler: "CacheFirst",
            options: {
              cacheName: "receipt-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 ngày
              },
            },
          },
        ],
      },
    }),
  ],
});
```

| Resource                  | Strategy                 | Lý do                            |
| ------------------------- | ------------------------ | -------------------------------- |
| App shell (HTML, JS, CSS) | **Precache**             | Luôn có sẵn offline              |
| Fonts                     | **StaleWhileRevalidate** | Dùng cache, cập nhật ngầm        |
| API calls                 | **NetworkFirst**         | Ưu tiên data mới, fallback cache |
| Receipt images            | **CacheFirst**           | Ảnh ít thay đổi                  |

### Background Sync

```typescript
// Đăng ký background sync trong Service Worker
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-changes") {
    event.waitUntil(syncPendingChanges());
  }
});

// Trigger từ main thread khi thêm vào queue
async function requestBackgroundSync(): Promise<void> {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register("sync-pending-changes");
  }
}
```

---

## 7. Data Flow Summary

### Tạo giao dịch — Online

```
User nhập → Validate → Lưu IndexedDB → UI cập nhật
                                ↓
                         Sync Queue (pending)
                                ↓
                         Push to Supabase ✅
                                ↓
                         Mark synced in IndexedDB
                                ↓
                         Realtime → notify other users
```

### Tạo giao dịch — Offline

```
User nhập → Validate → Lưu IndexedDB → UI cập nhật
                                ↓
                         Sync Queue (pending)
                                ↓
                         ⏸️ Chờ có mạng...
                                ↓ (mạng trở lại)
                         Push to Supabase ✅
                                ↓
                         Mark synced
```

### Nhận thay đổi từ người khác

```
Supabase Realtime (WebSocket)
        ↓
  Nhận change event
        ↓
  Kiểm tra conflict
        ↓
  Lưu vào IndexedDB
        ↓
  Dexie liveQuery → Vue reactivity re-render
```

---

## 8. Offline Capabilities Matrix

| Tính năng           | Offline                  | Cần sync                       |
| ------------------- | ------------------------ | ------------------------------ |
| Xem danh sách trips | ✅                       | Không                          |
| Xem giao dịch       | ✅                       | Không                          |
| Tạo trip            | ✅                       | Có (khi online)                |
| Tạo giao dịch       | ✅                       | Có                             |
| Sửa giao dịch       | ✅                       | Có                             |
| Xoá giao dịch       | ✅                       | Có                             |
| Xem settlement      | ✅                       | Không                          |
| Xem thống kê        | ✅                       | Không                          |
| Mời thành viên      | ❌                       | — (cần server tạo invite link) |
| Đăng nhập           | ❌                       | — (cần server auth)            |
| Đăng ký             | ❌                       | —                              |
| Upload ảnh hoá đơn  | ⚠️ Lưu local, upload sau | Có                             |
| Tỷ giá tiền tệ      | ⚠️ Dùng cache cuối       | Không                          |

---

## 9. Storage Limits & Cleanup

### IndexedDB Quotas

| Browser | Quota                                               |
| ------- | --------------------------------------------------- |
| Chrome  | ~80% disk space (thường hàng GB)                    |
| Firefox | ~50% disk space                                     |
| Safari  | ~1GB (có thể bị xoá sau 7 ngày nếu không tương tác) |

### Cleanup Strategy

```typescript
// Xoá data trips đã archive quá 90 ngày
async function cleanupOldData(): Promise<void> {
  const cutoff = subDays(new Date(), 90).toISOString();

  const oldTrips = await db.trips
    .where("status")
    .equals("archived")
    .and((t) => t.updatedAt < cutoff)
    .toArray();

  for (const trip of oldTrips) {
    await db.transaction(
      "rw",
      [
        db.trips,
        db.tripMembers,
        db.transactions,
        db.transactionSplits,
        db.settlements,
      ],
      async () => {
        await db.transactionSplits
          .where("transactionId")
          .anyOf(
            await db.transactions.where("tripId").equals(trip.id).primaryKeys(),
          )
          .delete();
        await db.transactions.where("tripId").equals(trip.id).delete();
        await db.settlements.where("tripId").equals(trip.id).delete();
        await db.tripMembers.where("tripId").equals(trip.id).delete();
        await db.trips.delete(trip.id);
      },
    );
  }
}
```

---

## 10. Testing Offline Scenarios

### Test checklist

| #   | Scenario                   | Expected                              |
| --- | -------------------------- | ------------------------------------- |
| 1   | Tạo trip offline, bật mạng | Trip sync lên server                  |
| 2   | Thêm giao dịch offline     | Giao dịch sync khi online             |
| 3   | 2 user sửa cùng giao dịch  | Conflict resolution hoạt động         |
| 4   | Tắt mạng giữa chừng sync   | Queue giữ nguyên, retry khi có mạng   |
| 5   | Xoá cache browser          | Data IndexedDB vẫn còn, app hoạt động |
| 6   | Mở app lần đầu offline     | Hoạt động với empty state             |
| 7   | Sync queue có 50+ items    | Batch process không timeout           |
| 8   | Server trả lỗi 500         | Retry với exponential backoff         |

### Simulating offline in DevTools

```
Chrome DevTools → Network tab → Throttling → Offline
```

Hoặc trong code test:

```typescript
// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  get: () => false,
  configurable: true,
});
window.dispatchEvent(new Event("offline"));
```
