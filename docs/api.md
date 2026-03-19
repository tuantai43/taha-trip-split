# API & Supabase Queries — TAHA TripSplit

---

## Tổng quan

Ứng dụng **không có REST API server riêng**. Thay vào đó, client giao tiếp trực tiếp với Supabase thông qua:

1. **Supabase Client SDK** — CRUD operations, auth, realtime
2. **Supabase Edge Functions** — Business logic phức tạp (settlement optimization, exchange rates)
3. **Supabase RLS** — Phân quyền ở database level

```
Client (supabase-js) ──► Supabase PostgreSQL (RLS protected)
Client (fetch)       ──► Supabase Edge Functions
Client (WebSocket)   ──► Supabase Realtime
```

---

## Authentication API

Hệ thống chỉ hỗ trợ đăng nhập qua **Google** và **Facebook** (OAuth). Không có email/password hay magic link.

### Đăng nhập Google

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

### Đăng nhập Facebook

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "facebook",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

### Liên kết tài khoản (Account Linking)

```typescript
// Đã đăng nhập Google, muốn link thêm Facebook
const { data, error } = await supabase.auth.linkIdentity({
  provider: "facebook",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

### Đăng xuất

```typescript
const { error } = await supabase.auth.signOut();
```

### Lấy user hiện tại

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
```

---

## Trips API

### Lấy danh sách trips

```typescript
const { data: trips, error } = await supabase
  .from("trips")
  .select(
    `
    *,
    trip_members!inner(id, display_name, role, user_id),
    transactions(count)
  `,
  )
  .order("updated_at", { ascending: false });
```

**Response:**

```typescript
interface TripListItem {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  currency_code: string;
  status: "draft" | "active" | "settled" | "archived";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  trip_members: { id: string; display_name: string; role: string }[];
  transactions: [{ count: number }];
}
```

### Tạo trip mới

```typescript
// 1. Tạo trip
const { data: trip, error } = await supabase
  .from("trips")
  .insert({
    name: "Đà Lạt 2026",
    description: "Chuyến đi Đà Lạt cùng nhóm",
    currency_code: "VND",
    start_date: "2026-04-01",
    end_date: "2026-04-05",
    created_by: userId,
  })
  .select()
  .single();

// 2. Thêm creator là owner
const { error: memberError } = await supabase.from("trip_members").insert({
  trip_id: trip.id,
  user_id: userId,
  display_name: userDisplayName,
  role: "owner",
});
```

### Lấy chi tiết trip

```typescript
const { data: trip, error } = await supabase
  .from("trips")
  .select(
    `
    *,
    trip_members(
      id, user_id, display_name, role, is_guest, joined_at
    )
  `,
  )
  .eq("id", tripId)
  .single();
```

### Cập nhật trip

```typescript
const { error } = await supabase
  .from("trips")
  .update({
    name: "Đà Lạt 2026 (Updated)",
    status: "settled",
  })
  .eq("id", tripId);
```

### Xoá trip (archive)

```typescript
const { error } = await supabase
  .from("trips")
  .update({ status: "archived" })
  .eq("id", tripId);
```

### Tham gia trip qua invite code

```typescript
// Edge Function: POST /functions/v1/join-trip
const response = await supabase.functions.invoke("join-trip", {
  body: { invite_code: "AbCd1234" },
});
```

**Edge Function logic:**

```typescript
// supabase/functions/join-trip/index.ts
Deno.serve(async (req) => {
  const { invite_code } = await req.json();
  const supabase = createClient(/* ... */);

  // 1. Tìm trip
  const { data: trip } = await supabase
    .from("trips")
    .select("id, status")
    .eq("invite_code", invite_code)
    .single();

  if (!trip) return new Response("Trip not found", { status: 404 });
  if (trip.status === "archived")
    return new Response("Trip archived", { status: 400 });

  // 2. Kiểm tra đã là thành viên chưa
  const { data: existing } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .single();

  if (existing)
    return Response.json({ trip_id: trip.id, already_member: true });

  // 3. Thêm thành viên
  await supabase.from("trip_members").insert({
    trip_id: trip.id,
    user_id: user.id,
    display_name: user.display_name,
    role: "member",
  });

  return Response.json({ trip_id: trip.id, already_member: false });
});
```

---

## Trip Members API

### Thêm guest member (nhập tên tay)

```typescript
const { data, error } = await supabase
  .from("trip_members")
  .insert({
    trip_id: tripId,
    display_name: "Hạnh",
    is_guest: true,
    role: "member",
  })
  .select()
  .single();
```

### Claim thành viên (user tự nhận)

```typescript
// Edge Function: POST /functions/v1/claim-member
const { data } = await supabase.functions.invoke("claim-member", {
  body: {
    trip_id: tripId,
    member_id: memberId, // guest member muốn claim
  },
});
```

**Edge Function logic:**

```typescript
Deno.serve(async (req) => {
  const { trip_id, member_id } = await req.json();
  const user = getAuthUser(req);

  // 1. Kiểm tra member có phải guest không
  const { data: member } = await supabase
    .from("trip_members")
    .select("*")
    .eq("id", member_id)
    .eq("trip_id", trip_id)
    .eq("is_guest", true)
    .is("user_id", null)
    .single();

  if (!member)
    return new Response("Member not found or already claimed", { status: 400 });

  // 2. Kiểm tra user chưa là thành viên trip này
  const { data: existing } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", trip_id)
    .eq("user_id", user.id)
    .single();

  if (existing)
    return new Response("You are already a member of this trip", {
      status: 400,
    });

  // 3. Đánh dấu claimed, chờ owner duyệt
  await supabase
    .from("trip_members")
    .update({ claimed_by: user.id })
    .eq("id", member_id);

  return Response.json({ status: "pending_approval" });
});
```

### Owner duyệt claim

```typescript
// Owner chấp nhận claim → link guest vào account thật
const { error } = await supabase
  .from("trip_members")
  .update({
    user_id: claimedByUserId,
    is_guest: false,
    claimed_at: new Date().toISOString(),
  })
  .eq("id", memberId)
  .eq("trip_id", tripId);
```

### Owner chỉ định liên kết

```typescript
// Owner trực tiếp link guest member → user account
const { error } = await supabase
  .from("trip_members")
  .update({
    user_id: targetUserId,
    is_guest: false,
    claimed_by: targetUserId,
    claimed_at: new Date().toISOString(),
  })
  .eq("id", memberId)
  .eq("trip_id", tripId);
```

### Xoá thành viên

```typescript
// Chỉ xoá được nếu không có giao dịch liên quan
const { error } = await supabase
  .from("trip_members")
  .delete()
  .eq("id", memberId)
  .eq("trip_id", tripId);
```

---

## Share View Bill API

### Bật Share View Bill

```typescript
// Tạo share token và bật share
const shareToken = crypto.randomUUID();
const { error } = await supabase
  .from("trips")
  .update({
    share_enabled: true,
    share_token: shareToken,
  })
  .eq("id", tripId);

// Link share: /share/{shareToken}
```

### Tắt Share View Bill

```typescript
const { error } = await supabase
  .from("trips")
  .update({
    share_enabled: false,
    share_token: null,
  })
  .eq("id", tripId);
```

### Xem trip qua share link (không cần auth)

```typescript
// RLS policy cho phép SELECT khi share_enabled = true và share_token khớp
const { data: trip, error } = await supabase
  .from("trips")
  .select(
    `
    name, description, currency_code, start_date, end_date, status,
    trip_members(id, display_name, role, is_guest),
    transactions(
      id, amount, currency_code, description, category, type,
      transaction_date,
      paid_by_member:trip_members!paid_by(display_name),
      splits:transaction_splits(amount, member:trip_members(display_name))
    )
  `,
  )
  .eq("share_token", shareToken)
  .eq("share_enabled", true)
  .single();

// Không trả về email, user_id hay thông tin nhạy cảm
```

---

## Transactions API

### Lấy danh sách giao dịch của trip

```typescript
const { data: transactions, error } = await supabase
  .from("transactions")
  .select(
    `
    *,
    paid_by_member:trip_members!paid_by(id, display_name),
    splits:transaction_splits(
      id, member_id, amount, is_settled,
      member:trip_members(id, display_name)
    )
  `,
  )
  .eq("trip_id", tripId)
  .order("transaction_date", { ascending: false })
  .order("created_at", { ascending: false });
```

### Tạo giao dịch mới

```typescript
// Sử dụng Supabase transaction (RPC) để đảm bảo atomicity
const { error } = await supabase.rpc("create_transaction", {
  p_trip_id: tripId,
  p_paid_by: memberId,
  p_amount: 300000,
  p_currency_code: "VND",
  p_description: "Ăn trưa phở",
  p_category: "food",
  p_type: "expense",
  p_split_method: "equal",
  p_transaction_date: "2026-04-02",
  p_splits: [
    { member_id: "member-1", amount: 100000 },
    { member_id: "member-2", amount: 100000 },
    { member_id: "member-3", amount: 100000 },
  ],
});
```

**RPC Function:**

```sql
CREATE OR REPLACE FUNCTION create_transaction(
  p_trip_id UUID,
  p_paid_by UUID,
  p_amount DECIMAL,
  p_currency_code TEXT,
  p_description TEXT,
  p_category TEXT,
  p_type TEXT,
  p_split_method TEXT,
  p_transaction_date DATE,
  p_splits JSONB
)
RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_split JSONB;
BEGIN
  -- Tạo transaction
  INSERT INTO transactions (
    trip_id, paid_by, amount, currency_code, description,
    category, type, split_method, transaction_date, created_by
  ) VALUES (
    p_trip_id, p_paid_by, p_amount, p_currency_code, p_description,
    p_category, p_type, p_split_method, p_transaction_date, auth.uid()
  ) RETURNING id INTO v_tx_id;

  -- Tạo splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO transaction_splits (transaction_id, member_id, amount)
    VALUES (
      v_tx_id,
      (v_split->>'member_id')::UUID,
      (v_split->>'amount')::DECIMAL
    );
  END LOOP;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Cập nhật giao dịch

```typescript
const { error } = await supabase.rpc("update_transaction", {
  p_transaction_id: txId,
  p_amount: 350000,
  p_description: "Ăn trưa phở + nước",
  p_splits: [
    { member_id: "member-1", amount: 120000 },
    { member_id: "member-2", amount: 120000 },
    { member_id: "member-3", amount: 110000 },
  ],
});
```

### Xoá giao dịch

```typescript
const { error } = await supabase.from("transactions").delete().eq("id", txId);
// CASCADE sẽ tự xoá transaction_splits
```

---

## Settlement API

### Tính toán settlement

```typescript
// Edge Function: POST /functions/v1/calculate-settlement
const { data } = await supabase.functions.invoke("calculate-settlement", {
  body: { trip_id: tripId },
});
```

**Response:**

```typescript
interface SettlementResult {
  balances: {
    member_id: string;
    display_name: string;
    total_paid: number; // Tổng đã trả
    total_owed: number; // Tổng phải trả
    net_balance: number; // Số dư ròng
  }[];
  settlements: {
    from_member: string;
    from_name: string;
    to_member: string;
    to_name: string;
    amount: number;
  }[];
}
```

### Đánh dấu đã thanh toán

```typescript
const { error } = await supabase
  .from("settlements")
  .update({
    is_paid: true,
    paid_at: new Date().toISOString(),
  })
  .eq("id", settlementId);
```

---

## Realtime Subscriptions

### Subscribe to trip changes

```typescript
// Lắng nghe giao dịch mới/sửa/xoá trong trip
const channel = supabase
  .channel(`trip:${tripId}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "transactions",
      filter: `trip_id=eq.${tripId}`,
    },
    (payload) => {
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new / payload.old
      handleTransactionChange(payload);
    },
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "trip_members",
      filter: `trip_id=eq.${tripId}`,
    },
    (payload) => {
      handleMemberChange(payload);
    },
  )
  .subscribe();

// Cleanup khi rời trip
channel.unsubscribe();
```

---

## Upload (Storage)

### Upload ảnh hoá đơn

```typescript
const fileName = `${tripId}/${txId}/${Date.now()}.jpg`;

const { data, error } = await supabase.storage
  .from("receipts")
  .upload(fileName, file, {
    cacheControl: "3600",
    contentType: "image/jpeg",
  });

// Lấy public URL
const {
  data: { publicUrl },
} = supabase.storage.from("receipts").getPublicUrl(fileName);
```

---

## Exchange Rate API

### Lấy tỷ giá

```typescript
// Edge Function: GET /functions/v1/exchange-rate?from=USD&to=VND
const { data } = await supabase.functions.invoke("exchange-rate", {
  body: { from: "USD", to: "VND" },
});

// Response: { rate: 25385.50, updated_at: '2026-03-19T10:00:00Z' }
```

> Sử dụng free API như ExchangeRate-API hoặc cache tỷ giá trong database.

---

## Error Handling

### Error Response Format

```typescript
interface ApiError {
  code: string; // 'TRIP_NOT_FOUND', 'UNAUTHORIZED', ...
  message: string; // Human-readable message
  details?: unknown; // Additional context
}
```

### Common Error Codes

| Code                      | HTTP Status | Mô tả                             |
| ------------------------- | ----------- | --------------------------------- |
| `UNAUTHORIZED`            | 401         | Chưa đăng nhập                    |
| `FORBIDDEN`               | 403         | Không có quyền (RLS)              |
| `TRIP_NOT_FOUND`          | 404         | Trip không tồn tại                |
| `INVALID_INVITE_CODE`     | 400         | Mã mời sai                        |
| `TRIP_ARCHIVED`           | 400         | Trip đã lưu trữ                   |
| `MEMBER_HAS_TRANSACTIONS` | 400         | Không thể xoá member có giao dịch |
| `SPLIT_AMOUNT_MISMATCH`   | 400         | Tổng split ≠ amount               |
| `VALIDATION_ERROR`        | 422         | Input không hợp lệ                |

---

## Rate Limiting & Security

| Measure              | Details                                                 |
| -------------------- | ------------------------------------------------------- |
| **RLS**              | Mọi table đều có Row Level Security                     |
| **Auth required**    | Hầu hết operations yêu cầu đăng nhập (trừ offline mode) |
| **Input validation** | Zod schema ở client + CHECK constraints ở database      |
| **Rate limit**       | Supabase built-in rate limiting                         |
| **CORS**             | Chỉ allow domain của app                                |
