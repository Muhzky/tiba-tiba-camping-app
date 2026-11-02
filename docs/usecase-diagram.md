# Use Case Diagram — Tiba Tiba Camping

Dokumen ini memetakan **aktor**, **use case**, dan **relasinya** untuk aplikasi Tiba Tiba Camping
(e-commerce alat outdoor: beli, sewa, pre-order, rekomendasi CBF, panel admin + POS).

- **Sumber kebenaran fitur:** [`agents.md`](../agents.md), [`docs/decisions.md`](./decisions.md)
- **Sumber kebenaran implementasi:** `src/routes/**`, `src/server/fn/**`, `src/server/db/schema.ts`
- **Status:** sesuai implementasi saat ini (Oktober 2026)
- **Cara render:** GitHub/GitLab merender blok `mermaid` otomatis; di VS Code gunakan ekstensi
  _Markdown Preview Mermaid Support_, atau tempel ke <https://mermaid.live>.

> Mermaid tidak punya tipe diagram UML _use case_ khusus. Diagram di bawah memakai `flowchart`
> dengan bentuk **stadium** `([ ... ])` sebagai use case dan `classDef` sebagai pembeda aktor.
> Notasi tetap mengikuti UML: garis solid = asosiasi aktor, garis putus-putus = `«include»` /
> `«extend»`.

**Cakupan:** 68 use case dalam 5 modul — 10 publik/katalog, 11 akun, 15 transaksi,
22 admin/POS, dan 10 rekomendasi.

**Daftar isi**

1. [Aktor](#1-aktor)
2. [Peta use case](#2-peta-use-case-overview)
3. [Modul publik dan katalog](#3-modul-publik-dan-katalog)
4. [Akun, profil, dan preferensi](#4-akun-profil-dan-preferensi)
5. [Transaksi](#5-transaksi-keranjang-checkout-pembayaran-struk)
   - [Keranjang dan checkout](#51-keranjang-dan-checkout)
   - [Pembayaran, riwayat, dan struk](#52-pembayaran-riwayat-dan-struk)
6. [Panel admin dan POS](#6-panel-admin-dan-pos)
7. [Rekomendasi CBF](#7-rekomendasi-content-based-filtering-cbf)
8. [Status pesanan](#8-lampiran-a--status-pesanan)
9. [Urutan checkout dan webhook](#9-lampiran-b--urutan-checkout-dan-webhook)
10. [Matriks use case dan implementasi](#10-matriks-use-case-dan-implementasi)
11. [Aturan bisnis](#11-aturan-bisnis-yang-membatasi-use-case)

---

## 1. Aktor

| Aktor                           | Tipe                        | Hak akses ringkas                                                                                                                                                                   |
| ------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guest**                       | Primer                      | Melihat homepage, katalog, detail produk, katalog sewa, mencari/memfilter, newsletter. Keranjang disimpan di cookie `ttc_cart`. Tidak bisa checkout, favorit, atau melihat pesanan. |
| **Customer**                    | Primer                      | Semua akses Guest, ditambah daftar/masuk, profil, alamat, favorit, preferensi rekomendasi, keranjang, checkout, pembayaran, riwayat pesanan, struk.                                 |
| **Admin**                       | Primer                      | Seluruh operasional: overview, produk & varian, gambar, transaksi, status order, pengembalian sewa, POS kasir, pengguna (termasuk mengubah role), atribut & kamus, pengaturan situs, rekomendasi.            |
| **Midtrans**                    | Sekunder (sistem eksternal) | Menerima pembuatan transaksi Snap, mengirim webhook notifikasi pembayaran.                                                                                                          |
| **Cloudflare R2**               | Sekunder (sistem eksternal) | Menerima upload gambar via presigned PUT URL; menyajikan gambar dari CDN.                                                                                                           |
| **Scheduler / sistem internal** | Sekunder                    | Menjalankan rebuild vektor rekomendasi (otomatis saat admin menyimpan, atau manual).                                                                                                |

**Generalisasi aktor:** `Customer` mewarisi semua use case `Guest`. Garis warisan tidak digambar
agar diagram tetap terbaca — hubungkan aktor turunan hanya ke use case tambahannya.

**Guard keamanan (bukan use case UI):**

- `requireAdmin()` → hanya `admin` (`src/server/fn/admin.ts`).
- `requireUser()` pada checkout, favorit, alamat, preferensi, pesanan, dan struk.
- Guard dicek di **server function**, bukan hanya `beforeLoad` route.

---

## 2. Peta use case (overview)

```mermaid
flowchart LR
  Guest([Guest]):::actor
  Customer([Customer]):::actor
  Admin([Admin]):::actor
  MT([Midtrans]):::external
  R2([Cloudflare R2]):::external

  subgraph SYS["Sistem Tiba Tiba Camping"]
    direction TB
    M1(["Situs publik<br/>homepage, katalog, detail produk, sewa, tentang"])
    M2(["Akun<br/>daftar, masuk, profil, alamat, favorit, preferensi"])
    M3(["Transaksi<br/>keranjang, checkout, bayar, riwayat, struk"])
    M4(["Panel admin dan POS<br/>overview, produk, transaksi, pengguna, atribut"])
    M5(["Rekomendasi CBF<br/>vektor produk, profil, kemiripan"])
  end

  Guest --- M1
  Guest -.-> M2
  Customer --- M1
  Customer --- M2
  Customer --- M3
  Customer -.-> M5
  Admin --- M4
  M3 -->|"Snap token dan webhook"| MT
  M4 -->|"upload gambar"| R2
  M4 -.->|"rebuild dan debug"| M5
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Rekomendasi tampil di homepage, detail produk, dan opsi sort katalog (lihat bagian 7).

---

## 3. Modul publik dan katalog

```mermaid
flowchart LR
  Guest([Guest]):::actor

  subgraph PUB["Modul publik dan katalog"]
    direction TB
    PUB01(["PUB-01<br/>Melihat homepage"])
    PUB02(["PUB-02<br/>Menjelajah katalog"])
    PUB03(["PUB-03<br/>Mencari produk"])
    PUB04(["PUB-04<br/>Memfilter dan mengurutkan"])
    PUB05(["PUB-05<br/>Melihat detail produk"])
    PUB06(["PUB-06<br/>Melihat terlaris, baru, populer"])
    PUB07(["PUB-07<br/>Melihat katalog sewa"])
    PUB08(["PUB-08<br/>Cek ketersediaan sewa"])
    PUB09(["PUB-09<br/>Berlangganan newsletter"])
    PUB10(["PUB-10<br/>Membaca tentang dan kontak"])
  end

  Guest --- PUB01
  Guest --- PUB02
  Guest --- PUB03
  Guest --- PUB04
  Guest --- PUB05
  Guest --- PUB06
  Guest --- PUB07
  Guest --- PUB08
  Guest --- PUB09
  Guest --- PUB10

  PUB03 -.->|«extend»| PUB02
  PUB04 -.->|«extend»| PUB02
  PUB08 -.->|«extend»| PUB05
  PUB08 -.->|«extend»| PUB07
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Catatan:

- Pencarian memperluas query memakai `pg_trgm` **dan** kamus sinonim/stopword dari admin
  (`src/server/fn/katalog.ts` → `expandSearchTerms`).
- Filter dan sort disimpan di URL search params dan divalidasi Zod (`src/lib/katalog-schema.ts`),
  sehingga tautan katalog bisa dibagikan.
- Sort **paling relevan** hanya untuk user login dan memakai skor rekomendasi — lihat REC-07.
- Detail produk menampilkan galeri, varian, stok, spesifikasi, favorit, serta **produk serupa**
  (REC-06).

---

## 4. Akun, profil, dan preferensi

```mermaid
flowchart LR
  Guest([Guest]):::actor
  Customer([Customer]):::actor
  R2([Cloudflare R2]):::external

  subgraph AKN["Modul akun dan profil"]
    direction TB
    AKN01(["AKN-01<br/>Mendaftar akun"])
    AKN02(["AKN-02<br/>Masuk"])
    AKN03(["AKN-03<br/>Keluar"])
    AKN04(["AKN-04<br/>Melihat ringkasan akun"])
    AKN05(["AKN-05<br/>Mengubah profil dan avatar"])
    AKN06(["AKN-06<br/>Mengelola alamat"])
    AKN07(["AKN-07<br/>Mengelola favorit"])
    AKN08(["AKN-08<br/>Mengatur preferensi rekomendasi"])
    AKN09(["AKN-09<br/>Melihat riwayat pesanan"])
    AKN10(["AKN-10<br/>Membayar ulang pesanan"])
    AKN11(["AKN-11<br/>Mengunggah gambar ke R2"])
  end

  Guest --- AKN01
  Guest --- AKN02
  Customer --- AKN03
  Customer --- AKN04
  Customer --- AKN05
  Customer --- AKN06
  Customer --- AKN07
  Customer --- AKN08
  Customer --- AKN09
  Customer --- AKN10

  AKN05 -.->|«include»| AKN11
  AKN11 ---|"presigned PUT"| R2
  AKN10 -.->|«extend»| AKN09
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Catatan:

- Login memakai **Better Auth** (email + password, session cookie httpOnly). Setelah login,
  admin diarahkan ke `/admin`, customer ke `/akun` (`src/routes/(public)/masuk.tsx`).
- Preferensi rekomendasi: kategori, budget, jumlah orang, kondisi/medan, gaya, dan mode
  beli/sewa/apa saja (`user_preferences`).
- Favorit bersifat idempoten per `(user, produk)`; toggle juga mencatat event rekomendasi.
- Avatar memakai presigned upload ke R2 (`src/server/fn/storage.ts`).

---

## 5. Transaksi: keranjang, checkout, pembayaran, struk

### 5.1 Keranjang dan checkout

```mermaid
flowchart LR
  Guest([Guest]):::actor
  Customer([Customer]):::actor

  subgraph TRXA["Keranjang dan checkout"]
    direction TB
    TRX01(["TRX-01<br/>Mengelola keranjang"])
    TRX02(["TRX-02<br/>Melihat ringkasan checkout"])
    TRX03(["TRX-03<br/>Checkout produk ready (beli)"])
    TRX04(["TRX-04<br/>Checkout pre-order (DP)"])
    TRX05(["TRX-05<br/>Checkout sewa"])
    TRX06(["TRX-06<br/>Membuat order"])
    TRX14(["TRX-14<br/>Memilih alamat atau ambil di toko"])
    TRX15(["TRX-15<br/>Menghitung ongkir per zona"])
  end

  Guest --- TRX01
  Customer --- TRX01
  Customer --- TRX02
  Customer --- TRX03
  Customer --- TRX04
  Customer --- TRX05
  Customer --- TRX14

  TRX02 -.->|«include»| TRX14
  TRX02 -.->|«include»| TRX15
  TRX03 -.->|«include»| TRX06
  TRX04 -.->|«include»| TRX06
  TRX05 -.->|«include»| TRX06
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Setelah `TRX-06` membuat order, alur berlanjut ke **TRX-07** (pembayaran) pada diagram berikutnya.

### 5.2 Pembayaran, riwayat, dan struk

```mermaid
flowchart LR
  Customer([Customer]):::actor
  Admin([Admin]):::actor
  MT([Midtrans Snap]):::external

  subgraph TRXB["Pembayaran, riwayat, dan struk"]
    direction TB
    TRX07(["TRX-07<br/>Membayar via Midtrans Snap"])
    TRX08(["TRX-08<br/>Menangani webhook pembayaran"])
    TRX09(["TRX-09<br/>Memverifikasi signature dan idempotensi"])
    TRX10(["TRX-10<br/>Mengembalikan stok saat batal atau expire"])
    TRX11(["TRX-11<br/>Melihat riwayat pesanan"])
    TRX12(["TRX-12<br/>Membayar ulang pesanan"])
    TRX13(["TRX-13<br/>Mencetak struk A4 atau thermal"])
  end

  Customer --- TRX07
  Customer --- TRX11
  Customer --- TRX12
  Customer --- TRX13
  Admin --- TRX13
  MT --- TRX07
  MT --- TRX08

  TRX08 -.->|«include»| TRX09
  TRX10 -.->|«extend»| TRX08
  TRX12 -.->|«include»| TRX07
  TRX12 -.->|«extend»| TRX11
  TRX13 -.->|«extend»| TRX11
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Catatan penting:

- Checkout **wajib login** (`beforeLoad` route + `requireUser()` di server), tetapi keranjang guest
  tetap ada di cookie dan otomatis dipakai setelah login.
- Satu checkout dapat menghasilkan **maksimal 3 order** — `buy`, `rent`, `preorder` — karena item
  PO tidak dicampur dengan stok ready. Ongkir hanya dikenakan sekali.
- Stok dikurangi saat checkout; dipulihkan saat webhook `cancel` / `deny` / `expire` atau refund.
- Nomor order berformat `TTC-YYYYMMDD-XXXX`; struk bisa dibuka pemilik order atau admin.
- `TRX-09` memverifikasi SHA512 `order_id + status_code + gross_amount + server_key`; status dari
  client tidak pernah dipercaya.

---

## 6. Panel admin dan POS

```mermaid
flowchart LR
  Admin([Admin]):::actor
  R2([Cloudflare R2]):::external

  subgraph ADM["Panel admin Stisla"]
    direction TB
    subgraph ADMO["Ringkasan"]
      ADM01(["ADM-01<br/>Melihat overview dashboard"])
    end
    subgraph ADMP["Produk"]
      ADM02(["ADM-02<br/>Mengelola produk"])
      ADM03(["ADM-03<br/>Mengelola varian dan stok"])
      ADM04(["ADM-04<br/>Mengunggah gambar produk"])
      ADM05(["ADM-05<br/>Mengatur atribut produk"])
      ADM06(["ADM-06<br/>Menduplikasi produk"])
      ADM07(["ADM-07<br/>Mengaktifkan atau menonaktifkan produk"])
    end
    subgraph ADMT["Transaksi"]
      ADM08(["ADM-08<br/>Menelusuri dan mengekspor transaksi"])
      ADM09(["ADM-09<br/>Melihat detail dan timeline order"])
      ADM10(["ADM-10<br/>Mengubah status pesanan"])
      ADM11(["ADM-11<br/>Mencatat pengembalian sewa"])
      ADM12(["ADM-12<br/>Memproses refund"])
      ADM13(["ADM-13<br/>Mencetak struk A4 atau thermal"])
    end
    subgraph ADMC["POS kasir"]
      ADM14(["ADM-14<br/>Mencari varian produk"])
      ADM15(["ADM-15<br/>Membuat order walk-in tunai atau QRIS"])
    end
    subgraph ADMS["Pengguna dan sistem"]
      ADM16(["ADM-16<br/>Mengelola pengguna"])
      ADM17(["ADM-17<br/>Mereset password pengguna"])
      ADM18(["ADM-18<br/>Mengelola atribut dan kamus"])
      ADM19(["ADM-19<br/>Mengatur pengaturan situs"])
      ADM20(["ADM-20<br/>Membangun ulang rekomendasi"])
      ADM21(["ADM-21<br/>Melihat debug vektor dan skor"])
      ADM22(["ADM-22<br/>Mengubah role pengguna"])
    end
  end

  Admin --- ADM01
  Admin --- ADM02
  Admin --- ADM08
  Admin --- ADM09
  Admin --- ADM10
  Admin --- ADM11
  Admin --- ADM13
  Admin --- ADM15
  Admin --- ADM16
  Admin --- ADM18
  Admin --- ADM19
  Admin --- ADM20
  Admin --- ADM21
  Admin --- ADM22

  ADM02 -.->|«include»| ADM03
  ADM02 -.->|«include»| ADM04
  ADM02 -.->|«include»| ADM05
  ADM02 -.->|«include»| ADM06
  ADM02 -.->|«include»| ADM07
  ADM04 ---|"presigned PUT"| R2
  ADM08 -.->|«include»| ADM09
  ADM12 -.->|«extend»| ADM09
  ADM16 -.->|«include»| ADM17
  ADM15 -.->|«include»| ADM14
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Catatan:

- `ADM-22` mengubah role pengguna antara `customer` dan `admin`.
- `ADM-10` tunduk pada tabel transisi status. Contoh: `pending_payment` hanya boleh ke `paid` atau
  `cancelled`; `processing` boleh ke `shipped`, `ready_pickup`, `completed`, atau `cancelled`;
  status final tidak bisa diubah. Kirim barang **wajib** nomor resi.
- `ADM-11` mencatat `returned_at`, denda telat, biaya kerusakan, dan deposit yang dikembalikan;
  unit sewa dibebaskan dan order langsung menjadi `completed`.
- `ADM-15` membuat order POS berstatus `paid` (beli) atau `rented` (sewa), mengurangi stok /
  mengunci unit sewa, mencatat baris `payments`, lalu bisa langsung mencetak struk thermal.
- Setiap aksi sensitif admin ditulis ke `audit_logs` (status order, produk, pengguna, POS, refund).

---

## 7. Rekomendasi Content-Based Filtering (CBF)

```mermaid
flowchart LR
  Guest([Guest]):::actor
  Customer([Customer]):::actor
  Admin([Admin]):::actor
  SCH([Scheduler internal]):::external

  subgraph REC["Modul rekomendasi CBF"]
    direction TB
    REC01(["REC-01<br/>Mencatat event produk"])
    REC02(["REC-02<br/>Membangun vektor produk"])
    REC03(["REC-03<br/>Menghitung profil pengguna"])
    REC04(["REC-04<br/>Menghitung kemiripan produk"])
    REC05(["REC-05<br/>Menampilkan rekomendasi Untuk Kamu"])
    REC06(["REC-06<br/>Menampilkan produk serupa"])
    REC07(["REC-07<br/>Mengurutkan katalog paling relevan"])
    REC08(["REC-08<br/>Menangani cold start"])
    REC09(["REC-09<br/>Menjalankan rebuild vektor"])
    REC10(["REC-10<br/>Melihat debug vektor dan skor"])
  end

  Guest --- REC05
  Customer --- REC01
  Customer --- REC05
  Customer --- REC06
  Customer --- REC07
  Admin --- REC09
  Admin --- REC10
  SCH --- REC09

  REC03 -.->|«include»| REC01
  REC04 -.->|«include»| REC02
  REC05 -.->|«include»| REC03
  REC06 -.->|«include»| REC04
  REC07 -.->|«include»| REC03
  REC08 -.->|«extend»| REC05
  REC09 -.->|«include»| REC02
  REC09 -.->|«include»| REC04
  classDef actor fill:#0A0A0A,stroke:#0A0A0A,color:#FFFFFF
  classDef external fill:#FFFFFF,stroke:#457AA0,stroke-dasharray:4 3,color:#0A0A0A
```

Catatan:

- Event yang dicatat: `view`, `add_cart`, `favorite`. Sinyal pembelian (`purchase`) diambil dari
  `order_items` pada order yang sudah selesai, bukan dari tabel event.
- Profil user = rata-rata berbobot vektor produk (beli 1.0, sewa 0.8, favorit 0.7, add_cart 0.4,
  view 0.2) + preferensi eksplisit ×1.0, dengan _time decay_ half-life 90 hari.
- Vektor produk = TF-IDF teks (setelah normalisasi kamus) + fitur numerik yang dinormalisasi,
  dikali bobot atribut dari admin. Disimpan padat di `product_vectors`.
- Kemiripan item-item = cosine similarity, diprekomputasi top-N ke `product_similarity`.
- Cold start (guest / user tanpa histori) memakai produk populer lalu terbaru; alasan kartu hanya
  `personal`, `popular`, atau `baru`.
- Bila user sudah pernah membeli produk, produk itu tidak direkomendasikan lagi; hasil dibatasi
  maksimal 3 produk per kategori pada setiap pengambilan.
- Rebuild dipicu otomatis (non-blocking) saat admin menyimpan produk/atribut/kamus, dan tersedia
  tombol manual di `/admin/rekomendasi`. Halaman debug menampilkan vektor dan skor per produk.

---

## 8. Lampiran A — Status pesanan

```mermaid
stateDiagram-v2
  direction TB

  [*] --> pending_payment: Checkout web
  [*] --> paid: POS beli
  [*] --> rented: POS sewa

  pending_payment --> paid: Admin konfirmasi
  pending_payment --> processing: Webhook settlement beli
  pending_payment --> awaiting_stock: Webhook settlement PO
  pending_payment --> rented: Webhook settlement sewa
  pending_payment --> cancelled: Webhook atau admin batal
  pending_payment --> expired: Webhook expire

  paid --> processing: Admin proses
  paid --> cancelled: Admin batal
  processing --> shipped: Admin kirim dan isi resi
  processing --> ready_pickup: Admin siap ambil
  processing --> completed: Admin selesai
  processing --> cancelled: Admin batal
  shipped --> completed
  ready_pickup --> completed

  awaiting_stock --> processing: Stok PO masuk
  awaiting_stock --> cancelled: Admin batal

  rented --> overdue: Melewati tenggat
  rented --> completed: Pengembalian dicatat
  overdue --> completed: Pengembalian dicatat

  returned --> completed
  returned --> refunded

  completed --> [*]
  cancelled --> [*]
  expired --> [*]
  refunded --> [*]

  note right of refunded
    Webhook refund atau partial_refund
    dapat mengubah order non-final
    menjadi refunded.
  end note
```

Catatan: `returned` hanya dipertahankan untuk data lama; alur baru mencatat pengembalian lalu
langsung mengubah status menjadi `completed` (`docs/decisions.md` #33).

---

## 9. Lampiran B — Urutan checkout dan webhook

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant UI as Halaman Checkout
  participant SF as Server Function checkout.ts
  participant DB as PostgreSQL
  participant MT as Midtrans Snap
  participant WH as Webhook API

  C->>UI: Pilih alamat, ongkir, dan metode
  UI->>SF: getCheckoutPreview(input)
  SF->>DB: Baca keranjang, stok, unit sewa, tarif zona
  DB-->>SF: Baris dan total
  SF-->>UI: Preview buy, rent, preorder dan item invalid

  C->>UI: Klik Buat pesanan
  UI->>SF: createOrder(input)
  SF->>DB: Transaksi insert orders, order_items, payments
  SF->>DB: Kunci unit sewa dengan FOR UPDATE
  SF->>MT: POST snap transaksi
  MT-->>SF: token dan redirect_url
  SF-->>UI: Daftar order dan snapToken
  UI->>MT: Buka popup Snap
  C->>MT: Bayar

  MT->>WH: POST notifikasi pembayaran
  WH->>WH: Verifikasi signature dan idempotensi
  WH->>DB: Update payment, order, dan status log
  WH-->>MT: 200 OK

  UI->>SF: Ambil riwayat atau struk terbaru
  SF->>DB: Baca status terbaru
  SF-->>UI: Status terbayar
```

---

## 10. Matriks use case dan implementasi

### 10.1 Publik dan katalog

| ID     | Use case                        | Aktor           | Implementasi utama                                                            |
| ------ | ------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| PUB-01 | Melihat homepage                | Guest, Customer | `src/routes/(public)/index.tsx`, `src/components/site/*`                      |
| PUB-02 | Menjelajah katalog              | Guest, Customer | `src/routes/(public)/katalog/index.tsx`                                       |
| PUB-03 | Mencari produk                  | Guest, Customer | `src/server/fn/katalog.ts` (`searchProducts`, `expandSearchTerms`)            |
| PUB-04 | Memfilter dan mengurutkan       | Guest, Customer | `src/lib/katalog-schema.ts`, `src/server/fn/katalog.ts`                       |
| PUB-05 | Melihat detail produk           | Guest, Customer | `src/routes/(public)/produk/$slug.tsx`, `src/server/fn/product.ts`            |
| PUB-06 | Melihat terlaris, baru, populer | Guest, Customer | `src/server/fn/product.ts` (`getBestSellers`, `getNewArrivals`, `getPopular`) |
| PUB-07 | Melihat katalog sewa            | Guest, Customer | `src/routes/(public)/sewa.tsx`, `src/server/fn/rental.ts`                     |
| PUB-08 | Cek ketersediaan sewa           | Guest, Customer | `checkRentalAvailability` di `src/server/fn/rental.ts`                        |
| PUB-09 | Berlangganan newsletter         | Guest           | `src/server/fn/newsletter.ts`, `src/components/site/Newsletter.tsx`           |
| PUB-10 | Membaca tentang dan kontak      | Guest           | `src/routes/(public)/tentang.tsx`, `src/server/fn/settings.ts`                |

### 10.2 Akun dan profil

| ID     | Use case                        | Aktor    | Implementasi utama                                    |
| ------ | ------------------------------- | -------- | ----------------------------------------------------- |
| AKN-01 | Mendaftar akun                  | Guest    | `src/routes/(public)/daftar.tsx`, `src/lib/auth.ts`   |
| AKN-02 | Masuk                           | Guest    | `src/routes/(public)/masuk.tsx`                       |
| AKN-03 | Keluar                          | Customer | `logout` di `src/server/fn/auth.ts`                   |
| AKN-04 | Melihat ringkasan akun          | Customer | `src/routes/(public)/akun/index.tsx`                  |
| AKN-05 | Mengubah profil dan avatar      | Customer | `updateProfile` di `src/server/fn/account.ts`         |
| AKN-06 | Mengelola alamat                | Customer | `saveAddress`, `deleteAddress`, `listAddresses`       |
| AKN-07 | Mengelola favorit               | Customer | `toggleFavorite`, `getFavorites`                      |
| AKN-08 | Mengatur preferensi rekomendasi | Customer | `savePreferences`, `getRecommendationProfile`         |
| AKN-09 | Melihat riwayat pesanan         | Customer | `src/routes/(public)/akun/pesanan.tsx`, `getMyOrders` |
| AKN-10 | Membayar ulang pesanan          | Customer | `repayOrder` di `src/server/fn/checkout.ts`           |
| AKN-11 | Mengunggah gambar ke R2         | Customer | `getAvatarUploadUrl` di `src/server/fn/storage.ts`    |

### 10.3 Transaksi

| ID     | Use case                             | Aktor              | Implementasi utama                                         |
| ------ | ------------------------------------ | ------------------ | ---------------------------------------------------------- |
| TRX-01 | Mengelola keranjang                  | Guest, Customer    | `src/server/fn/cart.ts`, cookie `ttc_cart`                 |
| TRX-02 | Melihat ringkasan checkout           | Customer           | `getCheckoutPreview` di `src/server/fn/checkout.ts`        |
| TRX-03 | Checkout produk ready                | Customer           | `createOrder` (grup `buy`)                                 |
| TRX-04 | Checkout pre-order                   | Customer           | `createOrder` (grup `preorder`), `src/lib/order-totals.ts` |
| TRX-05 | Checkout sewa                        | Customer           | `createOrder` (grup `rent`), `pickRentUnits`               |
| TRX-06 | Membuat order                        | Customer           | `createOrder`, `orderCode()`, transaksi DB                 |
| TRX-07 | Membayar via Midtrans Snap           | Customer, Midtrans | `createSnap`, `repayOrder`                                 |
| TRX-08 | Menangani webhook pembayaran         | Midtrans           | `src/routes/api/midtrans/notification.ts`                  |
| TRX-09 | Verifikasi signature dan idempotensi | Sistem             | `verifyMidtransSignature`, `processMidtransNotification`   |
| TRX-10 | Mengembalikan stok saat batal/expire | Sistem             | `restockBuyOrder`, `RESTOCK_FROM`                          |
| TRX-11 | Melihat riwayat pesanan              | Customer           | `getMyOrders` di `src/server/fn/order.ts`                  |
| TRX-12 | Membayar ulang pesanan               | Customer           | `repayOrder`                                               |
| TRX-13 | Mencetak struk A4/thermal            | Customer, Admin    | `src/routes/struk/$code.tsx`, `src/server/fn/receipt.ts`   |
| TRX-14 | Memilih alamat atau ambil di toko    | Customer           | `getCheckoutPreview`, tabel `addresses`                    |
| TRX-15 | Menghitung ongkir per zona           | Sistem             | `shippingFee` di `src/server/fn/checkout.ts`               |

### 10.4 Admin dan POS

| ID     | Use case                            | Aktor | Implementasi utama                                         |
| ------ | ----------------------------------- | ----- | ---------------------------------------------------------- |
| ADM-01 | Melihat overview dashboard          | Admin | `src/routes/admin/index.tsx`, `getAdminOverview`           |
| ADM-02 | Mengelola produk                    | Admin | `src/routes/admin/produk/*`, `saveProduct`                 |
| ADM-03 | Mengelola varian dan stok           | Admin | `saveVariant`, `deleteVariant`                             |
| ADM-04 | Mengunggah gambar produk            | Admin | `addProductImage`, `getR2UploadUrl`                        |
| ADM-05 | Mengatur atribut produk             | Admin | `saveProductAttributes`                                    |
| ADM-06 | Menduplikasi produk                 | Admin | `duplicateProduct`                                         |
| ADM-07 | Mengaktifkan/menonaktifkan produk   | Admin | `toggleProductActive`                                      |
| ADM-08 | Menelusuri dan mengekspor transaksi | Admin | `getAdminOrders`, `exportAdminOrders`                      |
| ADM-09 | Melihat detail dan timeline order   | Admin | `getAdminOrder`, `order_status_logs`                       |
| ADM-10 | Mengubah status pesanan             | Admin | `updateOrderStatus`, `ORDER_TRANSITIONS`                   |
| ADM-11 | Mencatat pengembalian sewa          | Admin | `returnRental`, `returnRentalCore`                         |
| ADM-12 | Memproses refund                    | Admin | `updateOrderStatus` ke `refunded`, webhook refund          |
| ADM-13 | Mencetak struk                      | Admin | `/struk/$code?paper=thermal&print=true`                    |
| ADM-14 | Mencari varian produk               | Admin | `searchPosVariants`                                        |
| ADM-15 | Membuat order walk-in               | Admin | `createPosOrder`, `createPosOrderCore`                     |
| ADM-16 | Mengelola pengguna                  | Admin | `getAdminUsers`, `setUserActive`                           |
| ADM-17 | Mereset password pengguna           | Admin | `resetUserPassword`                                        |
| ADM-18 | Mengelola atribut dan kamus         | Admin | `getAttributes`, `saveAttribute`, `saveTerm`, `deleteTerm` |
| ADM-19 | Mengatur pengaturan situs           | Admin | `updateSiteSettings`, `src/routes/admin/pengaturan.tsx`    |
| ADM-20 | Membangun ulang rekomendasi         | Admin | `rebuildRecommenderNow`, `scheduleRebuild`                 |
| ADM-21 | Melihat debug vektor dan skor       | Admin | `getRecommenderStats`, `getRecommenderProductDebug`        |
| ADM-22 | Mengubah role pengguna              | Admin | `setUserRole`, `requireAdmin`                              |

### 10.5 Rekomendasi

| ID     | Use case                           | Aktor            | Implementasi utama                                          |
| ------ | ---------------------------------- | ---------------- | ----------------------------------------------------------- |
| REC-01 | Mencatat event produk              | Sistem           | `recordProductEvent` di `src/server/recommender/profile.ts` |
| REC-02 | Membangun vektor produk            | Sistem           | `src/server/recommender/vectorize.ts`                       |
| REC-03 | Menghitung profil pengguna         | Sistem           | `profile.ts`, tabel `user_profile_vectors`                  |
| REC-04 | Menghitung kemiripan produk        | Sistem           | `similarity.ts`, `product_similarity`                       |
| REC-05 | Menampilkan rekomendasi Untuk Kamu | Guest, Customer  | `getRecommendations`, `pickForUser`                         |
| REC-06 | Menampilkan produk serupa          | Customer         | `getRelatedProducts`                                        |
| REC-07 | Mengurutkan katalog paling relevan | Customer         | `rankActiveProductIds` di `src/server/fn/recommend.ts`      |
| REC-08 | Menangani cold start               | Sistem           | `pickForUser` (alasan `popular` / `baru`)                   |
| REC-09 | Menjalankan rebuild vektor         | Admin, Scheduler | `rebuildRecommenderNow`, `scheduleRebuild`                  |
| REC-10 | Melihat debug vektor dan skor      | Admin            | `src/routes/admin/rekomendasi.tsx`                          |

---

## 11. Aturan bisnis yang membatasi use case

1. **Checkout wajib login.** Keranjang guest tetap tersimpan di cookie dan dilanjutkan otomatis.
2. **Maksimal 3 order per checkout** (`buy`, `rent`, `preorder`), karena item PO tidak boleh
   dicampur dengan stok ready.
3. **Ongkir sekali per checkout** — dikenakan pada order `buy`, atau `rent` bila tidak ada `buy`;
   PO tidak dikenai ongkir.
4. **Stok** dikurangi saat checkout dan dipulihkan saat pembayaran batal/expire/refund.
5. **Unit sewa** dikunci dengan `SELECT … FOR UPDATE` dan cek tumpang tindih periode; deposit 50%
   dari subtotal sewa per order.
6. **Denda sewa** = `late_days × harga sewa harian`, dihitung memakai tanggal kalender
   `Asia/Jakarta`; deposit dikembalikan setelah unit diperiksa.
7. **Status order** hanya boleh berpindah sesuai `ORDER_TRANSITIONS`; status final tidak bisa
   diubah. Transisi ke `shipped` wajib nomor resi.
8. **Pembayaran** diverifikasi lewat signature webhook, bukan status dari client. Notifikasi
   idempoten dan `raw_notification` disimpan untuk audit.
9. **Struk** hanya bisa diakses pemilik order atau admin; struk belum lunas diberi watermark
   "BELUM DIBAYAR".
10. **Admin guard ada di server** (`requireAdmin`), bukan hanya di UI.
11. **Rekomendasi tidak memakai data user lain** (bukan collaborative filtering); produk yang sudah
    dibeli disaring, hasil didiversifikasi maksimal 3 per kategori.
