# VocabExtend — Khung Dự Án Browser Extension Học Từ Vựng

> Chrome Manifest V3 Extension giúp đọc tài liệu tiếng Anh, tra từ điển Cambridge, ghi chú ngữ cảnh/nghĩa thực tế, lưu trữ Offline IndexedDB và đồng bộ sang Anki qua AnkiConnect.

---

## 1. Cấu Trúc Monorepo

```text
vocab_extend/
├── apps/
│   └── extension/                     # Chrome Extension Manifest V3 (Vite + React + TS)
│       ├── public/
│       │   ├── manifest.json          # Cấu hình MV3 (SidePanel, ContextMenu, Storage)
│       │   └── icons/                 # Icons (16, 48, 128)
│       ├── src/
│       │   ├── background/            # Service Worker & Context Menu handlers
│       │   ├── db/                    # Dexie (IndexedDB) Database & Vocabulary Repository
│       │   ├── services/              # Application logic, Cambridge Adapter, Anki Client
│       │   ├── sidepanel/             # Quick Capture Editor UI (Chrome Side Panel)
│       │   ├── dashboard/             # Review Dashboard UI (Lọc theo ngày, chọn từ export)
│       │   └── components/            # Form components (MeaningEditor, ExampleEditor...)
│       └── dist/                      # Thư mục build sẵn sàng load vào Chrome
│
├── packages/
│   └── shared/                        # Package dùng chung types & Zod validation
│       └── src/
│           ├── domain/                # VocabularyEntry, Anki domain models
│           └── schemas/               # Zod validation schema (vocabularyFormSchema)
│
├── pnpm-workspace.yaml
└── package.json
```

---

## 2. Hướng Dẫn Cài Đặt & Chạy Thử

### Bước 1: Cài đặt dependencies và build dự án
```bash
# Cài đặt toàn bộ packages qua pnpm
pnpm install

# Build dự án (sinh thư mục apps/extension/dist)
pnpm build
```

### Bước 2: Load Extension vào Chrome / Brave / Chromium
1. Mở trình duyệt và truy cập `chrome://extensions/`.
2. Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Nhấn **Load unpacked** (Tải tiện ích đã giải nén).
4. Chọn đường dẫn: `/data/projects/web-apps/vocab_extend/apps/extension/dist`.

---

## 3. Luồng Hoạt Động Cốt Lõi Đã Implement Sơ Bộ

1. **Chuột phải bắt từ (Context Menu):**
   - Người dùng bôi đen từ trên web -> Click chuột phải -> Chọn *"Tra từ & Lưu vào VocabExtend"*.
   - Service Worker tự động kích hoạt **Chrome Side Panel** và truyền dữ liệu từ vựng + URL nguồn.
2. **Quick Capture Editor:**
   - Quản lý Form động bằng **React Hook Form** + **Zod resolver**.
   - Tự động tra Cambridge (kết nối Java backend local hoặc fallback trực tiếp từ Cambridge).
   - Điền sẵn POS, phiên âm IPA UK/US, audio, nghĩa & ví dụ mẫu.
   - Người dùng nhập nhanh nghĩa tiếng Việt, ví dụ thực tế và mẹo nhớ (Memory Hint).
3. **Lưu trữ Cục bộ (IndexedDB):**
   - Sử dụng **Dexie** lưu trữ offline vào bảng `vocabulary`.
   - Chuẩn hóa từ (`normalizedWord`), tự động gán `dateKey` theo ngày đọc (`YYYY-MM-DD`).
4. **Review Dashboard:**
   - Xem toàn bộ từ đã thu thập theo ngày.
   - Tìm kiếm từ vựng, lọc trạng thái (`enriched`, `exported`).
   - Chọn nhiều từ cùng lúc (Batch selection).
5. **Đồng bộ Anki (AnkiConnect):**
   - Kết nối API `http://127.0.0.1:8765`.
   - Kiểm tra kết nối Anki, tự động lấy danh sách Decks và Models.
   - Tạo Note hàng loạt và cập nhật trạng thái đã xuất (`exported`).

---

## 4. Kế Hoạch Cho Các Bước Tiếp Theo (Next Steps Roadmap)

Xem chi tiết kế hoạch các giai đoạn tiếp theo trong tài liệu kiến trúc:
👉 [`vocab_extend_architecture.md`](./vocab_extend_architecture.md)
