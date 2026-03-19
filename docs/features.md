# Tính năng chi tiết — TAHA TripSplit

---

## Mục lục

1. [Tạo & Quản lý Trip](#1-tạo--quản-lý-trip)
2. [Tạo Giao dịch](#2-tạo-giao-dịch)
3. [Chia tiền thông minh](#3-chia-tiền-thông-minh)
4. [Tối ưu hoá nợ (Settlement)](#4-tối-ưu-hoá-nợ-settlement)
5. [Quản lý thành viên & Liên kết tài khoản](#5-quản-lý-thành-viên--liên-kết-tài-khoản)
6. [Offline-First & Đồng bộ](#6-offline-first--đồng-bộ)
7. [Đa tiền tệ](#7-đa-tiền-tệ)
8. [Danh mục chi tiêu](#8-danh-mục-chi-tiêu)
9. [Thống kê & Biểu đồ](#9-thống-kê--biểu-đồ)
10. [Chia sẻ & Share View Bill](#10-chia-sẻ--share-view-bill)
11. [Xác thực & Tài khoản](#11-xác-thực--tài-khoản)
12. [Thông báo](#12-thông-báo)

---

## 1. Tạo & Quản lý Trip

### Mô tả

Cho phép người dùng tạo chuyến đi mới, thiết lập thông tin cơ bản và mời bạn bè tham gia.

### Chức năng chi tiết

| Chức năng          | Mô tả                                              | Ưu tiên  |
| ------------------ | -------------------------------------------------- | -------- |
| Tạo trip mới       | Nhập tên, mô tả, ngày bắt đầu/kết thúc, ảnh bìa    | Bắt buộc |
| Mời thành viên     | Chia sẻ link mời hoặc mã QR                        | Bắt buộc |
| Chỉnh sửa trip     | Cập nhật thông tin trip bất cứ lúc nào             | Bắt buộc |
| Xoá / Lưu trữ trip | Xoá mềm hoặc archive trip đã kết thúc              | Bắt buộc |
| Danh sách trip     | Xem tất cả trip đang tham gia, lọc theo trạng thái | Bắt buộc |
| Trip template      | Tạo trip nhanh từ template (đi biển, đi núi, ...)  | Nên có   |
| Pinned trip        | Ghim trip đang hoạt động lên đầu                   | Nên có   |

### Luồng người dùng

```
Màn hình chính → Nhấn "Tạo Trip" → Nhập thông tin → Mời bạn bè → Trip sẵn sàng
```

### Trạng thái Trip

```
DRAFT → ACTIVE → SETTLED → ARCHIVED
```

- **DRAFT**: Mới tạo, chưa có giao dịch
- **ACTIVE**: Đang diễn ra, có thể thêm giao dịch
- **SETTLED**: Đã tất toán xong, không thêm giao dịch mới
- **ARCHIVED**: Đã lưu trữ

---

## 2. Tạo Giao dịch

### Mô tả

Ghi nhận mọi khoản chi tiêu trong chuyến đi: ai trả, trả cho ai, bao nhiêu.

### Chức năng chi tiết

| Chức năng            | Mô tả                                             | Ưu tiên   |
| -------------------- | ------------------------------------------------- | --------- |
| Thêm giao dịch       | Nhập số tiền, người trả, người thụ hưởng, ghi chú | Bắt buộc  |
| Chỉnh sửa giao dịch  | Sửa thông tin giao dịch đã tạo                    | Bắt buộc  |
| Xoá giao dịch        | Xoá giao dịch sai                                 | Bắt buộc  |
| Danh sách giao dịch  | Timeline giao dịch theo ngày                      | Bắt buộc  |
| Đính kèm ảnh hoá đơn | Chụp/chọn ảnh hoá đơn kèm giao dịch               | Nên có    |
| Giao dịch nhanh      | Tạo nhanh với ít thông tin nhất                   | Nên có    |
| Giao dịch định kỳ    | Tự tạo giao dịch lặp lại (thuê xe theo ngày, ...) | Tương lai |

### Loại giao dịch

| Loại                             | Ví dụ                                   | Mô tả                                                 |
| -------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| **Chi chung (Shared Expense)**   | Ăn trưa cả nhóm, vé tham quan cùng nhau | 1 người trả, chia cho tất cả hoặc một số thành viên   |
| **Chi riêng (Personal Expense)** | Mua đồ cá nhân, ăn món khác             | 1 người trả, chỉ tính cho chính người đó (không chia) |
| **Chuyển khoản (Transfer)**      | A trả lại B                             | 1 người gửi → 1 người nhận                            |
| **Thu nhập (Income)**            | Hoàn tiền, bán đồ thừa                  | Tiền vào chung cho trip                               |

> **Chi chung vs Chi riêng**: Mặc định giao dịch là "chi chung" (chia cho nhiều người). Người dùng có thể đánh dấu "chi riêng" để khoản đó không bị chia cho ai khác nhưng vẫn được ghi nhận vào tổng chi tiêu của trip.

### Luồng tạo giao dịch

```
1. Chọn loại giao dịch (chi chung / chi riêng / chuyển khoản)
2. Nhập số tiền + loại tiền
3. Chọn người trả (paid by)
4. Chọn cách chia (split method) — bỏ qua nếu chi riêng
5. Chọn người tham gia: tất cả hoặc chọn từng người
6. Thêm ghi chú / ảnh (tuỳ chọn)
7. Chọn danh mục (tuỳ chọn)
8. Xác nhận
```

---

## 3. Chia tiền thông minh

### Mô tả

Hỗ trợ nhiều phương thức chia tiền linh hoạt cho mỗi giao dịch.

### Phương thức chia

| Phương thức           | Mô tả                                       | Ví dụ                           |
| --------------------- | ------------------------------------------- | ------------------------------- |
| **Chia đều**          | Chia bằng nhau cho tất cả hoặc một số người | 300k ÷ 3 = 100k/người           |
| **Chia theo số tiền** | Mỗi người chịu số tiền cụ thể               | A: 150k, B: 100k, C: 50k        |
| **Chia theo tỉ lệ**   | Mỗi người chịu theo tỉ lệ %                 | A: 50%, B: 30%, C: 20%          |
| **Chia theo phần**    | Mỗi người chịu theo số phần (shares)        | A: 2 phần, B: 1 phần, C: 1 phần |

### Phạm vi chia

| Phạm vi               | Mô tả                                             | Uu tiên  |
| --------------------- | ------------------------------------------------- | -------- |
| **Tất cả thành viên** | Mặc định — chia cho toàn bộ thành viên trong trip | Bắt buộc |
| **Một số thành viên** | Chọn những người tham gia khoản chi này           | Bắt buộc |

> Mặc định khi tạo giao dịch, tất cả thành viên đều được check. Người dùng bỏ chọn những người không tham gia khoản chi đó.

### Quy tắc

- Tổng số tiền chia phải bằng đúng số tiền giao dịch
- Làm tròn thông minh: phần lẻ sẽ được cộng vào người trả
- Mặc định chia cho tất cả thành viên, có thể bỏ chọn người không tham gia
- Preview số tiền mỗi người trước khi xác nhận
- Giao dịch "chi riêng" không cần chia — chỉ ghi nhận cho người trả

---

## 4. Tối ưu hoá nợ (Settlement)

### Mô tả

Sau khi kết thúc trip, hệ thống tính toán số nợ ròng giữa các thành viên và đưa ra phương án thanh toán tối ưu (ít giao dịch nhất).

### Thuật toán

```
Bước 1: Tính balance ròng mỗi người
        balance = tổng đã trả - tổng phải trả

Bước 2: Phân thành 2 nhóm
        creditors (balance > 0): người được nhận lại tiền
        debtors   (balance < 0): người cần trả thêm

Bước 3: Tối ưu hoá bằng Greedy algorithm
        Ghép debtor lớn nhất với creditor lớn nhất
        Lặp lại cho đến khi tất cả balance = 0
```

### Ví dụ

```
Trước tối ưu (6 giao dịch):
  A → B: 50k    B → C: 30k    C → A: 20k
  A → C: 40k    B → A: 10k    C → B: 10k

Sau tối ưu (2 giao dịch):
  A → B: 30k
  A → C: 30k
```

### Chức năng

| Chức năng              | Mô tả                              | Ưu tiên   |
| ---------------------- | ---------------------------------- | --------- |
| Xem bảng nợ            | Ma trận ai nợ ai bao nhiêu         | Bắt buộc  |
| Tối ưu nợ              | Giảm thiểu số giao dịch thanh toán | Bắt buộc  |
| Đánh dấu đã thanh toán | Check từng khoản đã trả xong       | Bắt buộc  |
| Nhắc nhở thanh toán    | Gửi thông báo nhắc trả tiền        | Nên có    |
| Tích hợp chuyển khoản  | Deep link đến app ngân hàng        | Tương lai |

---

## 5. Quản lý nhóm & Thành viên

### Mô tả

Quản lý danh sách bạn bè, tạo nhóm để tái sử dụng cho nhiều chuyến đi.

### Chức năng

| Chức năng                     | Mô tả                                       | Ưu tiên  |
| ----------------------------- | ------------------------------------------- | -------- |
| Thêm thành viên vào trip      | Qua link mời hoặc thêm tay                  | Bắt buộc |
| Thành viên không có tài khoản | Thêm tên người chưa đăng ký (guest)         | Bắt buộc |
| Tạo nhóm bạn bè               | Lưu nhóm thường đi cùng nhau                | Nên có   |
| Xoá thành viên                | Chỉ khi chưa có giao dịch liên quan         | Nên có   |
| Vai trò                       | Owner (tạo trip) / Member (thành viên)      | Nên có   |
| Merge thành viên              | Gộp guest vào tài khoản thật khi họ đăng ký | Nên có   |

### Luồng mời thành viên

```
Owner tạo trip → Nhấn "Mời" → Tạo invite link/QR
→ Gửi cho bạn bè qua Zalo/Messenger/...
→ Bạn nhấn link → Tham gia trip (có/không cần đăng ký)
```

---

## 6. Offline-First & Đồng bộ

### Mô tả

Ứng dụng hoạt động hoàn toàn offline. Mọi thao tác được lưu local trước, sau đó đồng bộ lên server khi có mạng.

### Chức năng

| Chức năng             | Mô tả                                              | Ưu tiên  |
| --------------------- | -------------------------------------------------- | -------- |
| Lưu trữ offline       | Toàn bộ data trip/giao dịch lưu trong IndexedDB    | Bắt buộc |
| Auto sync             | Tự động đồng bộ khi phát hiện có mạng              | Bắt buộc |
| Conflict resolution   | Xử lý xung đột khi 2 người sửa cùng lúc            | Bắt buộc |
| Sync status indicator | Hiển thị trạng thái đồng bộ (synced/pending/error) | Bắt buộc |
| Installable PWA       | Cài về màn hình chính như app native               | Nên có   |
| Background sync       | Đồng bộ ngầm khi có mạng trở lại                   | Nên có   |

> Chi tiết chiến lược offline & sync tại [offline-sync.md](offline-sync.md)

---

## 7. Đa tiền tệ

### Mô tả

Hỗ trợ giao dịch bằng nhiều loại tiền tệ khác nhau — hữu ích khi đi du lịch nước ngoài.

### Chức năng

| Chức năng                      | Mô tả                                          | Ưu tiên |
| ------------------------------ | ---------------------------------------------- | ------- |
| Chọn tiền tệ mặc định cho trip | VND, USD, THB, ...                             | Nên có  |
| Giao dịch bằng tiền khác       | Nhập giao dịch bằng bất kỳ loại tiền nào       | Nên có  |
| Tỷ giá tự động                 | Lấy tỷ giá từ API, cho phép chỉnh tay          | Nên có  |
| Quy đổi khi settlement         | Tất cả nợ quy đổi về tiền tệ mặc định của trip | Nên có  |

---

## 8. Danh mục chi tiêu

### Mô tả

Phân loại giao dịch theo danh mục để dễ theo dõi và thống kê.

### Danh mục mặc định

| Icon | Danh mục     | Ví dụ                      |
| ---- | ------------ | -------------------------- |
| 🍜   | Ăn uống      | Nhà hàng, quán ăn, cafe    |
| 🏨   | Lưu trú      | Khách sạn, homestay        |
| 🚗   | Di chuyển    | Xe, xăng, grab, vé máy bay |
| 🎫   | Vé/Tham quan | Vé vào cổng, tour          |
| 🛒   | Mua sắm      | Đặc sản, quà lưu niệm      |
| 🎉   | Giải trí     | Karaoke, bar, trò chơi     |
| 💊   | Y tế         | Thuốc, khẩu trang          |
| 📦   | Khác         | Các khoản khác             |

### Chức năng

| Chức năng                | Mô tả                        | Ưu tiên   |
| ------------------------ | ---------------------------- | --------- |
| Chọn danh mục khi tạo GD | Dropdown chọn nhanh          | Nên có    |
| Tạo danh mục tuỳ chỉnh   | Thêm danh mục riêng cho trip | Tương lai |
| Thống kê theo danh mục   | Biểu đồ tròn tỷ lệ chi tiêu  | Nên có    |

---

## 9. Thống kê & Biểu đồ

### Mô tả

Dashboard tổng quan giúp nhóm nắm được tình hình chi tiêu.

### Chức năng

| Chức năng              | Mô tả                                           | Ưu tiên   |
| ---------------------- | ----------------------------------------------- | --------- |
| Tổng chi tiêu trip     | Tổng tiền cả chuyến đi                          | Bắt buộc  |
| Chi tiêu theo người    | Mỗi người đã trả bao nhiêu / phải trả bao nhiêu | Bắt buộc  |
| Chi tiêu theo danh mục | Biểu đồ tròn (pie chart)                        | Nên có    |
| Chi tiêu theo ngày     | Biểu đồ cột/đường (bar/line chart)              | Nên có    |
| Top chi tiêu           | Khoản chi lớn nhất, người chi nhiều nhất        | Nên có    |
| So sánh giữa các trip  | Đi lần này tốn hơn hay ít hơn lần trước         | Tương lai |

---

## 10. Chia sẻ & Share View Bill

### Mô tả

Cho phép chia sẻ trang **chỉ xem (read-only)** chi tiết chuyến đi cho bất kỳ ai, **không cần đăng nhập**.

### Chức năng

| Chức năng               | Mô tả                                                         | Ưu tiên   |
| ----------------------- | ------------------------------------------------------------- | --------- |
| Share View Bill         | Tạo link chỉ-xem cho trip, ai có link đều xem được            | Bắt buộc  |
| Trang chỉ xem           | Hiển thị: tên trip, thành viên, danh sách giao dịch, ai nợ ai | Bắt buộc  |
| Không cần đăng nhập     | Guest view — chỉ xem, không sửa/xóa được                      | Bắt buộc  |
| Bật/Tắt share           | Owner có thể bật/tắt link share bất cứ lúc nào                | Bắt buộc  |
| Tóm tắt trip            | Trang tổng kết: tổng tiền, ai nợ ai                           | Nên có    |
| Xuất PDF                | Báo cáo PDF đầy đủ giao dịch                                  | Tương lai |
| Xuất CSV                | Xuất data dạng bảng tính                                      | Tương lai |
| Chia sẻ qua mạng xã hội | Nút share nhanh qua Zalo, Messenger                           | Tương lai |

### Share View Bill — Chi tiết

**Link format:**

```
https://taha-trip-split.app/share/{share_token}
```

**Trang chỉ xem bao gồm:**

- Tên trip, ngày, thành viên
- Danh sách giao dịch (timeline)
- Tổng chi tiêu
- Bảng ai nợ ai (settlement)
- **Không có** nút sửa/xóa/thêm
- **Không cần** đăng nhập

### Luồng chia sẻ

```
Owner mở trip → Cài đặt trip → Bật "Share View Bill"
→ Hệ thống tạo share_token duy nhất
→ Owner copy link / share qua Zalo, Messenger
→ Bất kỳ ai có link → Mở → Xem toàn bộ chi tiết trip (read-only)
```

### Bảo mật

- Share token là random string dài (đủ khó đoán)
- Owner có thể tắt share bất cứ lúc nào → link cũ không còn hoạt động
- Owner có thể tạo lại token mới (invalidate token cũ)
- Trang share không reveal email/sđt của thành viên, chỉ hiện display name

---

## 11. Xác thực & Tài khoản

### Mô tả

Hệ thống chỉ hỗ trợ đăng nhập qua **Google** và **Facebook** (OAuth). Không có đăng ký bằng email/mật khẩu. Người dùng có thể liên kết nhiều provider vào cùng 1 tài khoản.

### Chức năng

| Chức năng                   | Mô tả                                                  | Ưu tiên  |
| --------------------------- | ------------------------------------------------------ | -------- |
| Sử dụng không cần đăng nhập | Dùng local, tạo trip cá nhân, thêm thành viên bằng tên | Bắt buộc |
| Đăng nhập Google            | OAuth qua Google account                               | Bắt buộc |
| Đăng nhập Facebook          | OAuth qua Facebook account                             | Bắt buộc |
| Liên kết tài khoản          | Link cả Google + Facebook vào cùng 1 account           | Bắt buộc |
| Quản lý profile             | Tên hiển thị, avatar (lấy từ provider)                 | Nên có   |
| Merge data local            | Khi đăng nhập, dữ liệu offline được gắn vào tài khoản  | Bắt buộc |

### Luồng đăng nhập

```
Mở app lần đầu → Dùng offline (tạo trip, thêm thành viên bằng tên)
→ Khi cần sync/chia sẻ → Đăng nhập bằng Google hoặc Facebook
→ Dữ liệu local được merge lên cloud
→ Có thể link thêm provider khác trong Settings
```

### Luồng liên kết tài khoản (Account Linking)

```
Đã đăng nhập bằng Google → Settings → "Liên kết Facebook"
→ OAuth Facebook → Xác nhận
→ Lần sau có thể đăng nhập bằng cả Google hoặc Facebook
```

### Tại sao chỉ Google + Facebook?

- Đơn giản cho user: không cần nhớ mật khẩu
- Hầu hết người dùng Việt Nam có ít nhất 1 trong 2 tài khoản này
- Giảm chi phí bảo mật: không cần quản lý password, reset password, v.v.
- Avatar và tên sẵn có từ provider

---

## 12. Thông báo

### Mô tả

Thông báo cho thành viên về các hoạt động trong trip.

### Chức năng

| Chức năng               | Mô tả                         | Ưu tiên   |
| ----------------------- | ----------------------------- | --------- |
| In-app notification     | Thông báo trong ứng dụng      | Nên có    |
| Push notification       | Thông báo đẩy qua trình duyệt | Tương lai |
| Thông báo giao dịch mới | Khi có người thêm chi tiêu    | Nên có    |
| Nhắc thanh toán         | Nhắc nhở ai chưa trả tiền     | Tương lai |

---

## Ma trận ưu tiên

| Ưu tiên       | Mô tả                                     | Phase         |
| ------------- | ----------------------------------------- | ------------- |
| **Bắt buộc**  | Tính năng cốt lõi, phải có trong v1.0     | Phase 1 (MVP) |
| **Nên có**    | Nâng cao trải nghiệm, có trong v1.x       | Phase 2       |
| **Tương lai** | Nice-to-have, phát triển khi có thời gian | Phase 3+      |

### Roadmap tổng quan

```
Phase 1 (MVP):
  ✓ Tạo trip, thêm thành viên bằng tên
  ✓ Giao dịch (chung/riêng), chia tiền (tất cả/chọn người)
  ✓ Tối ưu nợ
  ✓ Offline storage
  ✓ Auth (Google + Facebook)
  ✓ Claim/liên kết thành viên
  ✓ Share View Bill (link chỉ xem)
  ✓ Đồng bộ online

Phase 2:
  ✓ Đa tiền tệ
  ✓ Danh mục chi tiêu
  ✓ Thống kê & biểu đồ
  ✓ Quản lý nhóm
  ✓ PWA installable
  ✓ Liên kết tài khoản (Google + Facebook cùng lúc)

Phase 3+:
  ✓ Push notifications
  ✓ Tích hợp chuyển khoản
  ✓ Xuất PDF/CSV
  ✓ Đa ngôn ngữ
```
