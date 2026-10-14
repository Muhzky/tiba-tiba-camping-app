# AGENTS.md — Tiba Tiba Camping (PRD & Panduan Implementasi)

> Dokumen ini adalah sumber kebenaran (source of truth) untuk AI agent dan developer.
> Baca seluruh dokumen sebelum menulis kode. Jika ada konflik, urutan prioritas: **Bagian 2 (Keputusan Final) > Bagian lain**.

---

## 1. Ringkasan Produk

**Nama:** Tiba Tiba Camping
**Tagline / Quote homepage:** *"Outdoor gear — rencana boleh dadakan, gear harus matang."*
**Jenis:** Web e-commerce alat outdoor (jual, pre-order/PO, dan sewa) — **official distributor satu merek saja**.

### Tujuan
1. Menjual & menyewakan alat outdoor resmi dari 1 merek dengan pengalaman belanja modern.
2. Membantu user menemukan produk yang cocok lewat **katalog + filter + rekomendasi Content-Based Filtering (CBF)**.
3. Memberi admin panel bergaya POS untuk mengelola produk, transaksi, user, dan atribut.

### Target Pengguna
| Peran | Deskripsi |
|---|---|
| Guest | Melihat katalog, detail produk, rekomendasi umum (tanpa profil). |
| User (Customer) | Membeli, PO, menyewa, favorit, riwayat order, preferensi rekomendasi. |
| Admin | Mengelola seluruh operasional lewat panel Stisla. |

### Di Luar Cakupan (v1)
- Multi-brand / marketplace multi-seller.
- Aplikasi mobile native.
- Ongkir real-time multi-kurir (v1 memakai ongkir flat/manual per zona; integrasi RajaOngkir = v2).
- Collaborative filtering (hanya CBF).

---

## 2. Keputusan Final (Wajib Diikuti)

| Topik | Keputusan |
|---|---|
| Framework | **TanStack Start** (React, SSR, server functions) + **TypeScript strict** |
| Styling publik | **Tailwind CSS** + **shadcn/ui** (dikustom mengikuti referensi desain) |
| Admin UI | **Stisla** (Bootstrap-based), **dipisah total** dari layout publik (lihat 2.1) |
| Data fetching | **TanStack Query** |
| Form | **TanStack Form** + validasi **Zod** |
| Tabel | **TanStack Table** (dibungkus komponen tabel bergaya Stisla di admin) |
| ORM / DB | **Drizzle ORM** + **PostgreSQL** |
| Storage | **Cloudflare R2** (S3-compatible, presigned upload) |
| Pembayaran | **Midtrans** (Snap + webhook notifikasi) |
| Rekomendasi | **Content-Based Filtering** (TF-IDF + fitur numerik, cosine similarity) |
| Palet warna | **Hitam** sebagai warna utama (lihat Bagian 5) |
| Bahasa UI | Bahasa Indonesia (default) |
| Mata uang | IDR, format `Rp 220.000` |
| Timezone | `Asia/Jakarta` (simpan UTC di DB) |

### 2.1 Strategi Stisla + Tailwind (penting)
Stisla memakai Bootstrap yang bentrok dengan reset Tailwind. Aturan isolasi:
1. Route publik: `src/routes/(public)/**` → memakai `app.css` (Tailwind + shadcn).
2. Route admin: `src/routes/admin/**` → memakai layout sendiri yang memuat **CSS/JS Stisla** hanya di route ini (via `head().links` pada route `admin`), **tidak** memuat Tailwind global.
3. Jangan mencampur class Bootstrap dan Tailwind dalam satu halaman.
4. Komponen admin (tabel, form, modal) ditulis dengan markup/class Stisla; logika tetap TanStack Table/Form/Query.
5. Aset Stisla ditaruh di `public/stisla/` (atau dipasang via npm) dan tidak diimpor dari kode publik.

---

## 3. Arsitektur & Struktur Proyek

```
.
├── AGENTS.md
├── drizzle/                     # migrasi SQL
├── public/
│   ├── stisla/                  # aset Stisla (khusus admin)
│   └── images/hero-tent.webp
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── (public)/
│   │   │   ├── index.tsx                # Homepage
│   │   │   ├── katalog/index.tsx        # Katalog + filter
│   │   │   ├── produk/$slug.tsx         # Detail produk
│   │   │   ├── keranjang.tsx
│   │   │   ├── checkout.tsx
│   │   │   ├── masuk.tsx / daftar.tsx
│   │   │   └── akun/
│   │   │       ├── index.tsx            # Ringkasan profil
│   │   │       ├── favorit.tsx
│   │   │       ├── pesanan.tsx          # Riwayat beli/sewa
│   │   │       ├── pesanan.$id.tsx
│   │   │       └── preferensi.tsx       # Preferensi rekomendasi
│   │   ├── admin/
│   │   │   ├── route.tsx                # Layout Stisla + guard role admin
│   │   │   ├── index.tsx                # Overview
│   │   │   ├── produk/…                 # CRUD produk
│   │   │   ├── transaksi/…              # Order, sewa, PO
│   │   │   ├── pengguna/…               # Akun user
│   │   │   └── atribut/…                # Atribut & kamus
│   │   └── api/
│   │       ├── midtrans.notification.ts # Webhook
│   │       └── r2.presign.ts
│   ├── components/
│   │   ├── ui/                  # shadcn (dikustom)
│   │   ├── site/                # Navbar, Footer, Hero, ProductCard, dst
│   │   └── admin/               # Wrapper Stisla
│   ├── server/
│   │   ├── db/ (schema.ts, index.ts, seed.ts)
│   │   ├── fn/                  # createServerFn per domain
│   │   ├── services/            # order, rental, payment, storage
│   │   └── recommender/         # vectorize.ts, similarity.ts, profile.ts
│   ├── lib/ (zod schemas, utils, format, env)
│   └── styles/app.css
└── drizzle.config.ts
```

**Prinsip kode**
- Semua input server divalidasi Zod (skema dibagi antara client form dan server function).
- Logika bisnis di `server/services`, bukan di komponen.
- Tidak ada secret di client; env divalidasi Zod saat boot.
- Query key TanStack Query terpusat di `lib/query-keys.ts`.
- Aksesibilitas: semua interaktif dapat diakses keyboard, kontras memadai, `prefers-reduced-motion` dihormati.

---

## 4. Fitur Detail

### 4.1 Situs Publik

#### Homepage (mengikuti referensi, berurutan)
1. **Navbar** — logo kiri, menu pill di tengah (Katalog, Sewa, Tentang, Kontak), kanan: tombol bulat search, keranjang, akun.
2. **Hero** — background foto tenda di pegunungan (full-bleed, overlay gradient lembut agar teks terbaca), judul besar, sub-teks, tombol pill hitam "Mulai Belanja". Quote **"Outdoor gear — rencana boleh dadakan, gear harus matang."** tampil sebagai headline atau kutipan utama. Elemen pelengkap seperti referensi: avatar "800+ Pelanggan Puas" kiri bawah, ikon sosial vertikal kanan, tombol outline "Selengkapnya" kanan bawah.
3. **Intro** — judul kiri, paragraf + tombol "Belanja Sekarang" kanan.
4. **4 kartu fitur** — kartu abu muda rounded; kartu aktif/hover berwarna aksen. Isi: Beli, Sewa, Pre-Order, Rekomendasi Untukmu.
5. **Koleksi Serbaguna** — 2 kartu besar (satu terang, satu hitam) dengan gambar produk dan tombol "Jelajahi". Dapat diganti kategori utama (mis. Tenda 4 Musim, Tenda Ringkas).
6. **Terlaris** — carousel kartu produk (badge diskon merah, gambar, nama, harga merah, swatch warna, tombol keranjang bulat), panah kiri/kanan.
7. **Jalur "Official Distributor"** — pengganti marquee logo brand referensi. Karena hanya 1 merek, pita hitam ini menampilkan logo merek berulang, lini produk, badge "Garansi Resmi", dan metode pembayaran.
8. **Rekomendasi untuk Kamu** — hanya jika login & ada profil; guest melihat "Populer".
9. **Newsletter** — input email + tombol Subscribe (pill).
10. **Footer** — logo tengah, tautan, copyright, ikon sosial.

#### Katalog & Filter
- Grid produk (4 kolom desktop, 2 tablet, 1–2 mobile) + sidebar/drawer filter.
- Filter (state disimpan di URL search params, tervalidasi Zod, agar shareable):
  - Kategori (tenda, sleeping bag, kompor, carrier, dll.)
  - Tipe transaksi: **Beli**, **Sewa**, **Pre-Order**
  - Rentang harga (beli / harga sewa per hari)
  - Kapasitas orang, musim/kondisi cuaca, berat, bahan, warna
  - Tersedia saja (stok / ketersediaan tanggal sewa)
  - Diskon saja
- Sort: Terbaru, Terlaris, Harga naik/turun, **Paling Relevan** (skor rekomendasi, jika login).
- Pencarian teks (Postgres `ILIKE` + `pg_trgm`; kamus sinonim dari admin ikut memperluas query).
- Pagination/infinite scroll; skeleton loading.

#### Detail Produk
- Galeri gambar, varian warna/ukuran, harga & diskon, stok.
- Panel tipe transaksi: **Beli** / **Sewa** (pilih tanggal mulai–selesai, cek ketersediaan, tampil deposit) / **Pre-Order** (estimasi tersedia, DP jika diaktifkan).
- Spesifikasi (dari atribut), deskripsi, tombol favorit.
- Blok **"Produk Serupa"** (CBF item-to-item) dan **"Cocok Dipasangkan"** (kategori komplementer).

#### Keranjang & Checkout
- Keranjang mendukung item beli, sewa (dengan periode), dan PO. Item PO tidak dicampur dengan item ready dalam satu order (dipecah otomatis menjadi order terpisah).
- Alamat pengiriman/ambil di toko, ongkir flat per zona, kode voucher (opsional v1.1).
- Bayar via **Midtrans Snap**. Status order diperbarui lewat webhook.

#### Profil User (`/akun`)
| Halaman | Isi |
|---|---|
| Ringkasan | Data akun, alamat, ringkasan aktivitas |
| **Favorit** | Daftar produk favorit; tambah/hapus; pindah ke keranjang |
| **Riwayat Pesanan** | Tab: Semua / Beli / Sewa / PO; status, tanggal, total, invoice, tombol bayar ulang jika pending, perpanjang sewa (jika diizinkan) |
| **Preferensi Rekomendasi** | Kategori favorit, kisaran budget, jumlah orang, kondisi cuaca/medan, gaya (ultralight/family/dll.), preferensi beli vs sewa; tombol reset profil rekomendasi |

### 4.2 Admin (Stisla) — "Admin POS"

| Menu | Fitur |
|---|---|
| **Overview** | Kartu ringkas (omzet hari ini/bulan, jumlah order, sewa aktif, PO menunggu, stok menipis), grafik penjualan 30 hari, tabel order terbaru, produk terlaris |
| **Kelola Produk** | CRUD produk & varian, harga jual, harga sewa/hari, deposit, stok, mode PO, upload gambar ke R2, aktif/nonaktif, atur atribut produk, duplikat produk, import CSV (v1.1) |
| **Transaksi** | Daftar semua transaksi (TanStack Table: filter status/tipe/tanggal, search, export CSV). Detail order + timeline status. Aksi: konfirmasi, proses, kirim (resi), selesai; untuk sewa: serah-terima, pengembalian, cek kondisi, hitung denda, kembalikan deposit. **Order manual/POS kasir** (walk-in): pilih produk, tipe beli/sewa, bayar tunai/QRIS |
| **Akun User** | Daftar user, detail, riwayat order, nonaktifkan/aktifkan, reset password, ubah role (super-admin saja) |
| **Atribut & Kamus** | Atribut produk (nama, tipe, nilai, bobot rekomendasi) dan **kamus** (sinonim/tag/normalisasi istilah, stopword) — lihat 6.4 |

Role admin: `admin` (operasional) dan `owner` (semua akses + kelola role). Semua aksi sensitif dicatat di `audit_logs`.

---

## 5. Desain & UI

### 5.1 Prinsip
UI publik harus **identik dengan referensi** (layout, proporsi, radius, tipografi, jarak, komponen). Jangan menambah gaya lain. Yang boleh berbeda hanya konten (nama merek, teks, gambar) dan penyesuaian palet ke hitam.

### 5.2 Design Tokens (definisikan di `app.css` sebagai CSS variables shadcn)
| Token | Nilai | Pemakaian |
|---|---|---|
| `--background` | `#FFFFFF` | Latar halaman |
| `--foreground` | `#0A0A0A` | Teks utama |
| `--primary` | `#000000` | Tombol utama, navbar aktif, kartu gelap |
| `--primary-foreground` | `#FFFFFF` | Teks di atas primary |
| `--surface` | `#EFF2F5` | Kartu fitur, kartu produk, input |
| `--accent` | `#457AA0` | Kartu fitur aktif/hover (diambil dari referensi) |
| `--sale` | `#E11D1D` | Harga, badge diskon |
| `--muted-foreground` | `#6B7280` | Teks sekunder |
| `--border` | `#E5E7EB` | Garis |

Catatan: palet dominan hitam–putih–abu. Aksen biru hanya untuk satu state kartu fitur agar sama dengan referensi.

### 5.3 Tipografi & Bentuk
- Font sans geometris modern (mis. **DM Sans**, weight 400/500/600/700), di-load via `@fontsource`. Logo memakai font tulisan tangan/brush (SVG logo).
- Judul section besar (40–56px desktop, semi-bold), body 13–16px.
- Radius: kartu `16–24px`, tombol & input **pill (9999px)**, tombol ikon **bulat**.
- Shadow sangat halus; mengandalkan warna permukaan, bukan bayangan.

### 5.4 Komponen (shadcn dikustom agar sama dengan referensi)
Navbar pill, Button (pill hitam / outline / ikon bulat), Badge diskon, ProductCard, FeatureCard, CollectionCard (terang & gelap), Carousel (Embla), ColorSwatch, Avatar group, Newsletter input, Footer, Skeleton, Drawer filter, Dialog, Toast (Sonner), DatePicker rentang (sewa).

### 5.5 Animasi (lebih halus dari referensi)
Pakai library **Motion** (`motion/react`) + CSS transition. Aturan:
- Easing default `cubic-bezier(0.22, 1, 0.36, 1)`, durasi 300–600 ms.
- Hero: fade + scale-in halus pada background (parallax ringan saat scroll), teks stagger masuk.
- Section: reveal on scroll (fade-up 16–24px), sekali saja.
- Kartu produk/koleksi: hover lift + zoom gambar 1.04×; tombol keranjang mengalami micro-interaction (ikon + badge count bounce).
- Carousel: drag/inertia, transisi panah halus.
- Navbar: berubah menjadi glass/solid saat scroll.
- Transisi antarhalaman: fade pendek.
- Wajib menghormati `prefers-reduced-motion` (nonaktifkan parallax & stagger).
- Hanya animasi `transform` dan `opacity` agar tetap 60 fps.

### 5.6 Hero — spesifikasi
- Background: foto tenda di pegunungan (`hero-tent.webp`, ≥1920px, versi 1280 dan 768 untuk `srcset`), `object-fit: cover`, `fetchpriority="high"`.
- Overlay gradient putih transparan di atas agar teks hitam terbaca seperti referensi, atau ubah teks ke putih dengan overlay gelap jika kontras kurang (uji WCAG AA).
- Quote wajib tampil persis: **"Outdoor gear — rencana boleh dadakan, gear harus matang."**

### 5.7 Responsif
Breakpoint Tailwind default. Mobile: navbar menjadi hamburger + drawer, hero menyusut, filter menjadi drawer bawah, carousel swipe.

---

## 6. Sistem Rekomendasi — Content-Based Filtering

### 6.1 Prinsip
Rekomendasi dihitung dari **kemiripan konten produk** dan **profil preferensi user**. Tidak memakai data user lain (bukan collaborative filtering).

### 6.2 Representasi Produk (vektor fitur)
Setiap produk diubah menjadi vektor gabungan:
1. **Fitur kategorikal/teks** (kategori, subkategori, bahan, tag, musim, use-case, kata dari nama & deskripsi) → **TF-IDF** (setelah normalisasi kamus: lowercase, sinonim, stopword, stemming ringan Indonesia).
2. **Fitur numerik** (harga, harga sewa, kapasitas orang, berat, ukuran) → **min-max normalisasi** 0–1 (harga pakai skala log).
3. **Pembobotan** per atribut (`attribute.weight`, diatur admin) dikalikan pada blok fiturnya.
4. Vektor akhir disimpan di tabel `product_vectors` (kolom `jsonb`/`real[]`, atau `vector` bila memakai pgvector).

Dihitung ulang (job) saat produk/atribut/kamus berubah; bobot IDF dihitung ulang berkala.

### 6.3 Profil User
Vektor profil = rata-rata berbobot dari vektor produk yang berinteraksi + preferensi eksplisit:

| Sinyal | Bobot awal (konfigurasi) |
|---|---|
| Preferensi eksplisit (form preferensi) | 1.0 |
| Order selesai (beli) | 1.0 |
| Order selesai (sewa) | 0.8 |
| Favorit | 0.7 |
| Tambah ke keranjang | 0.4 |
| Lihat detail produk | 0.2 |

- **Time decay** (mis. half-life 90 hari) agar preferensi lama menurun.
- Preferensi eksplisit dipetakan menjadi vektor pseudo-produk (kategori/kapasitas/budget/cuaca) dan digabung.
- Profil dihitung ulang saat ada event baru (async) dan di-cache.

### 6.4 Atribut & Kamus (dikelola admin)
- **Atribut**: `nama`, `tipe` (text/enum/number/boolean), `nilai yang diizinkan`, `bobot rekomendasi`, `bisa difilter?`, `tampil di spesifikasi?`.
- **Kamus**: pasangan istilah → kanonik (mis. "dome" = "kubah"), tag terkontrol, daftar stopword. Dipakai untuk normalisasi vektor **dan** memperluas pencarian.
- Perubahan atribut/kamus memicu re-vektorisasi (job).

### 6.5 Skoring & Output
- `score(user, produk) = cosine(profil_user, vektor_produk)`.
- **Item-to-item**: `cosine(vektor_A, vektor_B)`; tabel `product_similarity(product_id, similar_id, score)` diprekomputasi top-N (mis. 20).
- Filter pasca-skor: buang produk nonaktif/stok habis, opsional buang yang baru dibeli, beri sedikit diversifikasi (batasi max 3 per kategori dalam 12 hasil).
- **Cold start**: guest/user tanpa histori → produk terlaris + preferensi eksplisit (bila ada) + produk baru.
- Tampil di: Homepage "Untuk Kamu", Detail Produk "Serupa", Katalog sort "Paling Relevan", Halaman Favorit/Pesanan (opsional).
- Sertakan alasan singkat (explainability): "Mirip tenda yang kamu favoritkan".

### 6.6 Evaluasi
- Halaman debug admin: lihat vektor, produk mirip, dan skor untuk produk tertentu.
- Metrik internal: CTR kartu rekomendasi, add-to-cart dari rekomendasi, dan uji offline sederhana (precision@k dengan histori order).

---

## 7. Model Data (Drizzle / PostgreSQL)

Gunakan `uuid` (UUIDv7 bila tersedia) sebagai PK, `timestamptz` untuk waktu, uang dalam **integer rupiah** (bukan float).

### Identitas
- `users` (id, name, email unique, phone, password_hash / provider, role enum[`customer`,`admin`,`owner`], is_active, created_at)
- `sessions` / `accounts` (sesuai library auth)
- `addresses` (id, user_id, label, recipient, phone, street, city, province, postal_code, is_default)
- `user_preferences` (user_id PK, categories text[], budget_min, budget_max, party_size, conditions text[], style text[], prefer_mode enum[`buy`,`rent`,`any`], updated_at)

### Katalog
- `categories` (id, parent_id, name, slug)
- `products` (id, category_id, name, slug unique, description, brand_line, sale_price, discount_percent, rent_price_per_day, rent_deposit, is_sellable, is_rentable, is_preorder, preorder_eta, preorder_dp_percent, is_active, created_at)
- `product_variants` (id, product_id, sku unique, color_name, color_hex, size, stock, sale_price_override)
- `product_images` (id, product_id, variant_id?, r2_key, sort, alt)
- `attributes` (id, name, key unique, type, allowed_values jsonb, weight real, is_filterable, show_in_spec)
- `product_attribute_values` (product_id, attribute_id, value jsonb)
- `dictionary_terms` (id, term, canonical, kind enum[`synonym`,`tag`,`stopword`])
- `rental_units` (id, variant_id, serial_code, condition, status enum[`available`,`rented`,`maintenance`]) — unit fisik sewa

### Interaksi
- `favorites` (user_id, product_id, created_at, PK gabungan)
- `cart_items` (id, user_id, variant_id, mode enum[`buy`,`rent`,`preorder`], qty, rent_start, rent_end)
- `product_events` (id, user_id?, session_id, product_id, type enum[`view`,`add_cart`,`favorite`,`purchase`], created_at)
- `product_vectors` (product_id PK, vector, version, updated_at)
- `product_similarity` (product_id, similar_id, score, PK gabungan)
- `user_profile_vectors` (user_id PK, vector, updated_at)

### Transaksi
- `orders` (id, code unique `TTC-YYYYMMDD-XXXX`, user_id?, channel enum[`web`,`pos`], type enum[`buy`,`rent`,`preorder`], status, subtotal, discount, shipping_fee, deposit_total, grand_total, payment_status, midtrans_order_id, paid_at, shipping_address jsonb, notes, created_at)
- `order_items` (id, order_id, variant_id, rental_unit_id?, name_snapshot, unit_price, qty, rent_start, rent_end, rent_days)
- `payments` (id, order_id, provider, gross_amount, status, raw_notification jsonb, signature_valid bool, created_at)
- `rental_returns` (id, order_item_id, returned_at, condition_note, late_days, late_fee, damage_fee, deposit_refund)
- `order_status_logs` (id, order_id, from_status, to_status, actor_id, note, created_at)
- `audit_logs` (id, actor_id, action, entity, entity_id, diff jsonb, created_at)
- `newsletter_subscribers` (email unique, created_at)

Indeks wajib: `products(slug)`, `products(category_id, is_active)`, `orders(user_id, created_at)`, `orders(status)`, `favorites(user_id)`, GIN/trgm pada `products.name`.

---

## 8. Alur Bisnis Kunci

### 8.1 Status Order
`pending_payment → paid → processing → shipped/ready_pickup → completed`
Cabang: `cancelled`, `expired`, `refunded`.
Sewa menambah: `rented (in_use) → returned → completed` (+ `overdue`).
PO menambah: `paid (DP/lunas) → awaiting_stock → processing → …`.

### 8.2 Penyewaan
- Ketersediaan dihitung dari `rental_units` yang tidak bentrok periode dengan order aktif.
- Harga = `rent_price_per_day × jumlah_hari` + deposit (refundable).
- Denda keterlambatan = `late_days × rent_price_per_day × faktor` (konfigurasi).
- Reservasi unit dikunci saat order dibuat; dilepas otomatis jika pembayaran kedaluwarsa.
- Mencegah race condition: gunakan transaksi DB + `SELECT … FOR UPDATE`.

### 8.3 Pre-Order
Produk `is_preorder` menerima order tanpa stok; status `awaiting_stock` sampai admin menandai stok masuk. DP opsional.

### 8.4 Stok
Pengurangan stok saat pembayaran **berhasil** (atau saat order dibuat dengan reservasi berbatas waktu — pilih satu dan konsisten: **reservasi 30 menit saat checkout, kurangi permanen saat paid**).

### 8.5 Midtrans
1. Server membuat transaksi Snap → mengembalikan `token`/`redirect_url`.
2. Client membuka Snap popup.
3. Webhook `/api/midtrans/notification`: **verifikasi `signature_key`** (SHA512 `order_id + status_code + gross_amount + server_key`), cek idempotensi, petakan `transaction_status` (`settlement/capture`, `pending`, `deny/cancel/expire`) ke status order.
4. Jangan percaya status dari client; selalu verifikasi ke server/webhook.
5. Simpan `raw_notification` untuk audit. Sandbox untuk dev, production via env.

### 8.6 Cloudflare R2
- Upload gambar produk lewat **presigned PUT URL** (server function memvalidasi tipe/ukuran).
- Simpan hanya `r2_key`; URL publik dibangun dari domain CDN (`R2_PUBLIC_URL`).
- Gambar: maks 5 MB, `webp/jpeg/png`; buat varian ukuran (thumb/medium/large) via Cloudflare Images/Transform atau saat upload.

---

## 9. Autentikasi & Keamanan
- Auth berbasis session cookie (`httpOnly`, `secure`, `sameSite=lax`). Library disarankan: **Better Auth** dengan adapter Drizzle (asumsi; boleh diganti bila tim memilih lain, tapi tetap session-based).
- Login email+password; login Google (opsional v1.1).
- Guard role di server (`beforeLoad` route + cek di setiap server function admin), bukan hanya UI.
- Rate limit login, checkout, newsletter, dan webhook.
- Proteksi CSRF, sanitasi input, header keamanan (CSP, HSTS), hash password Argon2id/bcrypt.
- Data pribadi minimal; jangan log data kartu/secret.

---

## 10. Non-Fungsional
| Aspek | Target |
|---|---|
| Performa | LCP < 2.5 s (4G), CLS < 0.1; gambar lazy + `srcset`; SSR halaman katalog & detail |
| SEO | Meta, OpenGraph, sitemap, JSON-LD `Product`, URL slug bersih |
| Aksesibilitas | WCAG 2.1 AA |
| Ketersediaan | Deploy dengan backup harian DB |
| Observabilitas | Log terstruktur, error tracking (Sentry opsional) |
| Testing | Vitest (unit: recommender, harga sewa, status order), Playwright (alur checkout), test webhook Midtrans |

---

## 11. Environment Variables
```
DATABASE_URL=
AUTH_SECRET=
APP_URL=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=
```
Validasi dengan Zod di `lib/env.ts`; aplikasi gagal start bila ada yang kurang.

---

## 12. Roadmap & Milestone

| Fase | Cakupan | Kriteria Selesai |
|---|---|---|
| **M0 Setup** | Repo, TanStack Start, Tailwind, shadcn, Drizzle, Postgres, env, CI, token desain | App berjalan, migrasi & seed jalan |
| **M1 UI Publik** | Homepage persis referensi, navbar/footer, animasi, katalog statis | Visual cocok referensi (review side-by-side) |
| **M2 Katalog** | Skema produk, filter URL-based, detail produk, upload R2 | Filter & pencarian berfungsi |
| **M3 Auth & Profil** | Daftar/masuk, favorit, alamat, preferensi | Profil user lengkap |
| **M4 Transaksi** | Keranjang, checkout beli, Midtrans, webhook, riwayat | Order end-to-end (sandbox) |
| **M5 Sewa & PO** | Ketersediaan sewa, deposit, pengembalian, denda, PO | Alur sewa & PO tervalidasi |
| **M6 Admin** | Layout Stisla, overview, produk, transaksi, user, atribut & kamus, POS kasir | Semua menu admin fungsional |
| **M7 Rekomendasi** | Vektorisasi, profil user, similarity, UI rekomendasi, halaman debug | Rekomendasi tampil di 3 lokasi, cold start aman |
| **M8 Hardening** | Test, performa, SEO, keamanan, seed demo | Checklist Bagian 13 lulus |

---

## 13. Definition of Done
- [ ] TypeScript tanpa error, lint bersih, semua Zod schema terpasang di server function.
- [ ] Tampilan publik cocok dengan referensi di desktop & mobile.
- [ ] Animasi halus, patuh `prefers-reduced-motion`.
- [ ] Homepage memuat background tenda + quote yang benar.
- [ ] Webhook Midtrans terverifikasi signature dan idempoten.
- [ ] Tidak ada bentrok CSS antara Stisla dan Tailwind.
- [ ] Rekomendasi: unit test cosine/TF-IDF, cold start, dan filter stok.
- [ ] Tidak ada secret di repo/client.
- [ ] Migrasi Drizzle dapat dijalankan dari nol + seed demo.

---

## 14. Aturan untuk AI Agent
1. Ikuti **Bagian 2** tanpa mengganti stack atau library tanpa persetujuan eksplisit.
2. Kerjakan per milestone; jangan melompat ke fitur fase lain.
3. Setiap perubahan skema DB → buat migrasi Drizzle, jangan edit DB manual.
4. Jangan mengarang aset merek; gunakan placeholder dan tandai jelas (`TODO: aset resmi`).
5. Komponen UI publik harus mengikuti Bagian 5; bila ragu, cocokkan dengan gambar referensi.
6. Tulis test untuk logika bisnis (harga sewa, status order, rekomendasi).
7. Jika ada ambiguitas bisnis (ongkir, denda, kebijakan refund), tanyakan atau catat sebagai asumsi di `docs/decisions.md`.
8. Bahasa antarmuka Indonesia; kode, nama variabel, dan komentar teknis dalam Bahasa Inggris.

---

## 15. Asumsi Terbuka (Perlu Konfirmasi Pemilik Produk)
- Nama merek resmi yang didistribusikan & aset logonya.
- Kebijakan sewa: durasi min/maks, besaran deposit, formula denda, perpanjangan.
- Kebijakan PO: DP wajib atau tidak, batas waktu pelunasan.
- Metode pengiriman & ongkir (flat/zona vs integrasi kurir).
- Pilihan library auth (default disarankan: Better Auth).
- Apakah POS kasir walk-in perlu cetak struk/printer thermal di v1.