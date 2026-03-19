# Công nghệ sử dụng — TAHA TripSplit

---

## Tổng quan

TAHA TripSplit được xây dựng theo kiến trúc **offline-first PWA** với backend-as-a-service. Mục tiêu công nghệ:

- **Offline-first**: Ứng dụng phải hoạt động hoàn toàn không cần mạng
- **Mobile-first**: Giao diện tối ưu cho điện thoại, responsive trên desktop
- **Developer Experience**: Type-safe, hot reload nhanh, dễ maintain
- **Chi phí thấp**: Sử dụng free tier / open-source nhiều nhất có thể

---

## Frontend

### Vue 3 + TypeScript

| Tiêu chí       | Chi tiết                                                                     |
| -------------- | ---------------------------------------------------------------------------- |
| **Phiên bản**  | Vue 3.5+ (Composition API)                                                   |
| **Ngôn ngữ**   | TypeScript 5.x (strict mode)                                                 |
| **Lý do chọn** | Learning curve thấp, Composition API mạnh, bundle nhẹ, phù hợp dự án vừa/nhỏ |

#### So sánh React vs Vue cho dự án này

| Tiêu chí                      | React                                    | Vue                                                          | Đánh giá         |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------ | ---------------- |
| **Learning curve**            | Trung bình — JSX, hooks pattern phức tạp | Thấp — template-based, dễ tiếp cận                           | ✅ Vue           |
| **Bundle size**               | ~44KB (react + react-dom)                | ~33KB (vue)                                                  | ✅ Vue nhẹ hơn   |
| **Performance**               | Tốt (Virtual DOM)                        | Tốt hơn (Reactivity system, compiler optimizations)          | ✅ Vue nhỉnh hơn |
| **Ecosystem**                 | Rất lớn, nhiều lựa chọn (phải tự chọn)   | Đủ lớn, các lib chính thức chất lượng cao                    | Hoà              |
| **Offline/PWA**               | Nhiều thư viện, cộng đồng lớn            | Hỗ trợ tốt qua Vite PWA Plugin (giống nhau)                  | Hoà              |
| **State Management**          | Zustand / Redux — external lib           | Pinia — chính thức, tích hợp sẵn DevTools                    | ✅ Vue (Pinia)   |
| **DX (Developer Experience)** | Linh hoạt nhưng phải config nhiều        | Convention rõ ràng, single-file component (.vue)             | ✅ Vue           |
| **TypeScript**                | Tốt nhưng cần setup thêm                 | First-class support, type inference tốt với `<script setup>` | ✅ Vue           |
| **Community VN**              | Lớn                                      | Lớn, nhiều dev VN dùng Vue                                   | Hoà              |

**Kết luận: Chọn Vue 3** vì:

1. **Dự án vừa/nhỏ** — Vue phù hợp hơn, không cần ecosystem khổng lồ của React
2. **Single-file component** — HTML/CSS/JS trong 1 file `.vue`, trực quan hơn
3. **Pinia** — state management chính thức, tích hợp tốt offline persist
4. **Composition API** — tương đương React Hooks nhưng reactive system mạnh hơn
5. **Bundle nhẹ hơn** — quan trọng cho PWA, đặc biệt trên 3G/4G yếu
6. **Compiler optimizations** — Vue compiler tối ưu render tự động, ít cần memo thủ công

### Vite

| Tiêu chí       | Chi tiết                                                |
| -------------- | ------------------------------------------------------- |
| **Phiên bản**  | Vite 6.x                                                |
| **Lý do chọn** | Build nhanh nhất hiện tại, HMR tức thì, config đơn giản |

**Tại sao Vite thay vì:**

- **Next.js**: Không cần SSR/SSG cho offline-first app, Vite nhẹ hơn
- **Create React App**: Deprecated, chậm hơn Vite nhiều lần

### Tailwind CSS + shadcn/ui

| Tiêu chí       | Chi tiết                                                       |
| -------------- | -------------------------------------------------------------- |
| **Tailwind**   | v4.x — utility-first CSS framework                             |
| **shadcn/ui**  | Component library dựa trên Radix UI                            |
| **Lý do chọn** | Mobile-first, dễ tuỳ biến, accessible, không phụ thuộc runtime |

**Tại sao thay vì:**

- **MUI / Ant Design**: Nặng hơn, khó tuỳ biến sâu, bundle size lớn
- **CSS Modules**: Tailwind nhanh hơn khi prototyping, consistent design tokens

### Pinia

| Tiêu chí       | Chi tiết                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| **Phiên bản**  | v2.x                                                                                     |
| **Lý do chọn** | State management chính thức của Vue, type-safe, DevTools tích hợp, hỗ trợ persist plugin |

**Tại sao Pinia thay vì:**

- **Vuex**: Pinia là thế hệ kế tiếp, API đơn giản hơn, TypeScript tốt hơn
- **Zustand / Redux**: Dành cho React ecosystem
- **Composables thuần**: Pinia có DevTools, persist plugin, SSR ready

---

## Offline Storage

### Dexie.js (IndexedDB)

| Tiêu chí           | Chi tiết                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| **Phiên bản**      | v4.x                                                                        |
| **Storage engine** | IndexedDB (browser native)                                                  |
| **Dung lượng**     | Hàng trăm MB, đủ cho mọi use case                                           |
| **Lý do chọn**     | API dễ dùng hơn raw IndexedDB, hỗ trợ schema versioning, observable queries |

**Tại sao thay vì:**

- **localStorage**: Giới hạn 5-10MB, chỉ lưu string, không có indexing
- **SQLite (WASM)**: Phức tạp hơn, Dexie.js đủ cho structured data
- **PouchDB**: Nặng hơn, CouchDB ecosystem phức tạp

### Service Worker + Workbox

| Tiêu chí       | Chi tiết                                                    |
| -------------- | ----------------------------------------------------------- |
| **Plugin**     | vite-plugin-pwa (dùng Workbox bên dưới)                     |
| **Lý do chọn** | Cache app shell, cho phép offline access, precaching assets |

---

## Backend

### Supabase

| Tiêu chí           | Chi tiết                                          |
| ------------------ | ------------------------------------------------- |
| **Database**       | PostgreSQL 15 (managed)                           |
| **Auth**           | Supabase Auth (Google & Facebook OAuth)           |
| **Realtime**       | Supabase Realtime (WebSocket)                     |
| **Edge Functions** | Deno runtime (cho business logic phức tạp)        |
| **Storage**        | Supabase Storage (ảnh hoá đơn)                    |
| **Lý do chọn**     | All-in-one BaaS, free tier hào phóng, open-source |

**Tại sao Supabase thay vì:**

- **Firebase**: Vendor lock-in với Google, Firestore query hạn chế hơn PostgreSQL
- **Tự build backend (Express/NestJS)**: Tốn thời gian, phải tự quản lý infra
- **Appwrite**: Supabase có realtime tốt hơn, community lớn hơn

### Supabase Free Tier

| Tài nguyên     | Giới hạn                   |
| -------------- | -------------------------- |
| Database       | 500MB                      |
| Auth Users     | 50,000 MAU                 |
| Storage        | 1GB                        |
| Edge Functions | 500K invocations/month     |
| Realtime       | 200 concurrent connections |
| Bandwidth      | 5GB/month                  |

→ **Hoàn toàn miễn phí cho giai đoạn phát triển và nhóm người dùng nhỏ.**

> ⚠️ **Quan trọng**: Supabase free tier giới hạn **2 projects**. Nếu project bị inactive >1 tuần, có thể bị pause (cần resume thủ công). Khi scale lên production, plan Pro bắt đầu từ $25/tháng.

### Chi phí ước tính

| Giai đoạn          | Người dùng           | Chi phí/tháng      |
| ------------------ | -------------------- | ------------------ |
| **Phát triển**     | 1-5 dev              | $0 (free tier)     |
| **MVP / Beta**     | < 1,000 users        | $0 (free tier đủ)  |
| **Production nhỏ** | 1,000 - 10,000 users | $25 (Supabase Pro) |
| **Production lớn** | > 10,000 users       | $25+ (tuỳ usage)   |

---

## PWA (Progressive Web App)

### vite-plugin-pwa

| Tiêu chí           | Chi tiết                                              |
| ------------------ | ----------------------------------------------------- |
| **Manifest**       | Tự generate web app manifest                          |
| **Service Worker** | Workbox strategies (StaleWhileRevalidate, CacheFirst) |
| **Installable**    | Prompt "Add to Home Screen"                           |
| **Update**         | Prompt reload khi có version mới                      |

### PWA Capabilities

| Capability         | Hỗ trợ                            |
| ------------------ | --------------------------------- |
| Installable        | ✅ iOS, Android, Desktop          |
| Offline            | ✅ Full offline operation         |
| Push Notifications | ✅ Android, Desktop (iOS hạn chế) |
| Camera access      | ✅ Chụp hoá đơn                   |
| Share API          | ✅ Share nội dung native          |
| Background Sync    | ✅ Sync khi có mạng lại           |

---

## Thư viện phụ trợ

| Thư viện                   | Mục đích                                          | Phiên bản   |
| -------------------------- | ------------------------------------------------- | ----------- |
| **Vue Router**             | Client-side routing                               | v4.x        |
| **TanStack Query (Vue)**   | Server state management, caching                  | v5.x        |
| **VueUse**                 | Collection of essential Vue composition utilities | v12.x       |
| **Vee-Validate**           | Form management cho Vue                           | v4.x        |
| **Zod**                    | Schema validation (form + API)                    | v3.x        |
| **date-fns**               | Xử lý ngày tháng (tree-shakable)                  | v4.x        |
| **Chart.js + vue-chartjs** | Biểu đồ (pie, bar, line)                          | v4.x / v5.x |
| **uuid**                   | Generate unique ID cho offline records            | v11.x       |
| **Lucide Vue Next**        | Icon library (tree-shakable)                      | Latest      |

---

## DevOps & Tooling

### Deployment

| Tiêu chí    | Chi tiết                           |
| ----------- | ---------------------------------- |
| **Hosting** | Vercel                             |
| **CI/CD**   | Vercel auto-deploy on git push     |
| **Preview** | Mỗi PR có preview deployment riêng |
| **Domain**  | Custom domain qua Vercel           |

### Development Tools

| Tool                    | Mục đích                        |
| ----------------------- | ------------------------------- |
| **ESLint**              | Linting TypeScript/Vue          |
| **Prettier**            | Code formatting                 |
| **Vitest**              | Unit testing (tương thích Vite) |
| **Vue Test Utils**      | Component testing               |
| **Playwright**          | E2E testing                     |
| **Husky + lint-staged** | Pre-commit hooks                |

---

## Tổng kết dependencies

### Production

```json
{
  "vue": "^3.5.0",
  "vue-router": "^4.4.0",
  "@tanstack/vue-query": "^5.0.0",
  "@supabase/supabase-js": "^2.0.0",
  "pinia": "^2.2.0",
  "pinia-plugin-persistedstate": "^4.0.0",
  "dexie": "^4.0.0",
  "vee-validate": "^4.0.0",
  "@vee-validate/zod": "^4.0.0",
  "zod": "^3.0.0",
  "@vueuse/core": "^12.0.0",
  "date-fns": "^4.0.0",
  "chart.js": "^4.0.0",
  "vue-chartjs": "^5.0.0",
  "uuid": "^11.0.0",
  "lucide-vue-next": "latest",
  "tailwind-merge": "^2.0.0",
  "clsx": "^2.0.0"
}
```

### Development

```json
{
  "typescript": "^5.6.0",
  "vite": "^6.0.0",
  "@vitejs/plugin-vue": "^5.0.0",
  "vite-plugin-pwa": "^0.21.0",
  "tailwindcss": "^4.0.0",
  "eslint": "^9.0.0",
  "prettier": "^3.0.0",
  "vitest": "^2.0.0",
  "@vue/test-utils": "^2.4.0",
  "@playwright/test": "^1.0.0",
  "husky": "^9.0.0",
  "lint-staged": "^15.0.0"
}
```

---

## Browser Support

| Browser          | Phiên bản tối thiểu  |
| ---------------- | -------------------- |
| Chrome           | 90+                  |
| Safari           | 15.4+ (PWA trên iOS) |
| Firefox          | 100+                 |
| Edge             | 90+                  |
| Samsung Internet | 15+                  |

> **Note**: IndexedDB và Service Worker được hỗ trợ trên tất cả browser hiện đại. iOS Safari có một số hạn chế với PWA (không có push notification đầy đủ, storage limit).
