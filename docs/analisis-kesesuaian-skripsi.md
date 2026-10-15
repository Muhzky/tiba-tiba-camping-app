# Analisis Kesesuaian Proyek dengan Rumusan Masalah & Tujuan Penelitian

Dokumen ini memetakan implementasi **Tiba-Tiba Camping** terhadap 4 rumusan masalah dan 4 tujuan penelitian skripsi (metode *Content-Based Filtering* / CBF). Analisis berbasis pembacaan kode pada commit saat ini, dengan bukti lokasi `file:line`.

---

## 1. Ringkasan Produk

Tiba-Tiba Camping adalah web e-commerce alat outdoor (jual, sewa, pre-order) yang menyertakan **sistem rekomendasi Content-Based Filtering**. Stack: TanStack Start (React/SSR) + Drizzle ORM + PostgreSQL + Tailwind/shadcn (publik) + Stisla (admin).

Fitur rekomendasi inti:
- Representasi produk sebagai vektor (TF-IDF teks + fitur numerik ternormalisasi).
- Profil pengguna dari interaksi + preferensi eksplisit.
- Skoring kemiripan via *cosine similarity* (user-to-item dan item-to-item).
- Integrasi hasil ke homepage, detail produk, dan katalog.

---

## 2. Analisis per Rumusan Masalah

### RM1 — Implementasi metode CBF untuk rekomendasi berbasis web

**Status: SESUAI ✅**

| Komponen | Implementasi | Bukti |
|---|---|---|
| Tokenisasi & normalisasi kamus (sinonim, stopword, stemming ringan) | `normalizeWord`, `tokenize`, `stem`, `loadDictionary` | `src/server/recommender/vectorize.ts:20-93` |
| Pembobotan teks **TF-IDF** | `termFreq`, `idfMap` | `src/server/recommender/vectorize.ts:48-63` |
| Fitur numerik ternormalisasi (harga log, sewa, atribut) | `logMinmax`, `minmax` | `src/server/recommender/vectorize.ts:65-75, 207-221` |
| Bobot atribut dari admin | `def.weight` dikalikan ke vektor | `src/server/recommender/vectorize.ts:220` |
| **Cosine similarity** | `cosine`, `cosineArrays` | `src/server/recommender/similarity.ts:6-37` |
| Item-to-item top-N | `rebuildSimilarity` | `src/server/recommender/similarity.ts:41-77` |
| Tahapan rebuild terpadu | `rebuildRecommender` | `src/server/recommender/similarity.ts:79-87` |

Kesimpulan: metode CBF diimplementasikan lengkap (vektorisasi → kemiripan → penyimpanan `product_vectors` & `product_similarity`).

---

### RM2 — Rekomendasi berdasarkan kesesuaian atribut produk dengan preferensi pengguna

**Status: SESUAI (sebagian besar) ✅**

- **Preferensi eksplisit** tersimpan di tabel `user_preferences` (`src/server/db/schema.ts:137-149`): kategori, budget, jumlah orang, kondisi cuaca/medan, gaya, mode transaksi.
- Form pengisian: `src/routes/(public)/akun/preferensi.tsx`.
- **Pemetaan preferensi ke ruang vektor yang sama** dengan produk: `src/server/recommender/profile.ts:111-137`
  - kategori → `c:<slug>` (`profile.ts:112-119`)
  - budget → `n:price` skala log (`profile.ts:120-123`)
  - jumlah orang → `n:attr:kapasitas_orang` (`profile.ts:124-130`)
  - kondisi/gaya → token teks `t:<term>` (`profile.ts:131-136`)
- **Profil dari interaksi**: order beli/sewa, favorit, add-to-cart, view — dengan bobot dan *time decay* (`profile.ts:16-29, 74-104`).
- Skoring akhir = `cosine(profil_user, vektor_produk)` (`src/server/fn/recommend.ts:49-52`).

Catatan keterbatasan (lihat §4): `preferMode` (beli/sewa/bebas) tersimpan tetapi belum digunakan dalam skoring.

---

### RM3 — Integrasi hasil rekomendasi ke sistem berbasis web

**Status: SESUAI ✅**

Rekomendasi tampil di tiga lokasi sesuai `agents.md §6.5`:

| Lokasi | Implementasi | Bukti |
|---|---|---|
| Homepage — "Untuk Kamu" (personal) / "Populer" (cold start) | `Recommendations` | `src/components/site/Recommendations.tsx`, dipakai di `src/routes/(public)/index.tsx:24` |
| Detail produk — "Produk Serupa" (item-to-item CBF) | `getRelatedProducts` → `similarProductIds` | `src/server/fn/katalog.ts:262-297` |
| Katalog — sort "Paling relevan" | `rankActiveProductIds` + `array_position` | `src/server/fn/katalog.ts:207-226` |

Ditambah **explainability** (alasan singkat: "Sesuai preferensimu" / "Populer minggu ini" / "Baru masuk toko") di `src/server/fn/recommend.ts:21-27`, serta **halaman debug admin** (`/admin/rekomendasi`) untuk inspeksi vektor dan skor (`src/routes/admin/rekomendasi.tsx`, `src/server/fn/admin.ts:1445-1492`).

---

### RM4 — Uji kinerja sistem rekomendasi (relevansi)

**Status: BELUM MEMADAI ⚠️**

Yang **sudah** ada — pengujian **kebenaran** (correctness), bukan **kinerja relevansi**:
- Unit test murni: `cosine`, TF-IDF, tokenisasi, normalisasi numerik, decay, `pickForUser`, arah vektor profil — `src/server/recommender/recommender.test.ts`.
- Test integrasi DB: jumlah vektor = produk aktif, skor similar valid (0–1), profil condong ke produk favorit — `recommender.test.ts:149-230`.
- Halaman debug admin menampilkan kata berbobot teratas + 10 produk serupa beserta skornya.

Yang **belum** ada (padahal disebut di `agents.md §6.6`):
- Metrik evaluasi kuantitatif: **precision@k / recall@k / NDCG / MAP**. (Hasil pencarian kode untuk `precision|recall|ctr|ndcg` = kosong.)
- Pelacakan **CTR** kartu rekomendasi dan **add-to-cart dari rekomendasi** (atribusi asal klik).
- Uji offline berbasis histori order (ground-truth relevansi).

Akibatnya, rumusan "menguji kinerja … rekomendasi yang relevan" belum terjawab secara kuantitatif — bagian ini perlu ditutup (lihat §5).

---

## 3. Matriks Kesesuaian

| Rumusan Masalah | Tujuan Penelitian | Status | Bukti Utama |
|---|---|---|---|
| 1. Implementasi CBF | 1. Mengimplementasikan CBF | ✅ Sesuai | `vectorize.ts`, `similarity.ts` |
| 2. Atribut vs preferensi | 2. Membangun rekomendasi sesuai preferensi | ✅ Sebagian besar | `profile.ts:111-137`, `user_preferences` |
| 3. Integrasi ke web | 3. Mengintegrasikan ke web | ✅ Sesuai | `index.tsx`, `katalog.ts`, `$slug.tsx` |
| 4. Uji kinerja relevansi | 4. Menguji kinerja rekomendasi | ⚠️ Belum memadai | `recommender.test.ts` (correctness saja) |

**Kesimpulan singkat:** RM1, RM2, RM3 **sudah sesuai**. RM4 **belum** memenuhi standar pengujian kinerja karena belum ada metrik evaluasi kuantitatif.

---

## 4. Gap & Catatan Teknis

1. **Metrik evaluasi belum ada** — tidak ada precision@k/recall/NDCG/CTR; hanya unit test kebenaran. Ini gap utama untuk RM4.
2. **`preferMode` tidak dipakai** — tersimpan (`schema.ts:147`) dan diisi (`preferensi.tsx`), tetapi tidak memengaruhi skoring maupun filter. Rekomendasi belum membedakan preferensi beli vs sewa.
3. **Perilaku guest tidak terekam** — `product_events.sessionId` (`schema.ts:317`) ada tetapi belum diisi, sehingga sinyal pengguna anonim (belum login) tidak tertangkap.
4. **Pemetaan teks preferensi bergantung kosakata produk** — kondisi/gaya hanya berpengaruh bila tokennya muncul di deskripsi/atribut produk (`profile.ts:131-136`).
5. **Skalabilitas** — vektor disimpan sebagai `jsonb` array padat (tanpa pgvector), rebuild item-to-item **O(n²)**; aman sampai ~5k produk (ditandai `ponytail:` di `similarity.ts:39-40`).
6. **Rebuild otomatis non-blocking** — simpan produk/atribut/kamus memicu `scheduleRebuild()`; ada tombol rebuild manual di admin (`admin.ts:740-743, 1494-1497`).

---

## 5. Rekomendasi Penutup (untuk memenuhi RM4)

Untuk menutup rumusan "menguji kinerja", tambahkan evaluasi kuantitatif. Usulan minimal:

**A. Evaluasi offline (paling relevan untuk skripsi)**
- Bentuk *ground truth* dari histori: produk yang benar-benar dibeli/disewai/favorit user sebagai item relevan.
- Split data: gunakan interaksi lama sebagai "input profil", interaksi terbaru sebagai "target".
- Hitung **precision@k** dan **recall@k** (mis. k = 4, 8, 12) untuk tiap user, lalu rata-ratakan.
- Bandingkan terhadap **baseline** (mis. popularitas / acak) sebagai pembanding kinerja.
- Opsional: NDCG@k untuk memperhitungkan urutan.
- Tempat implementasi yang disarankan: skrip baru `src/server/recommender/evaluate.ts` (fungsi murni `precisionAtK` dapat diuji seperti pola `recommend.ts`).

**B. Evaluasi online (pelengkap)**
- Catat klik kartu rekomendasi sebagai `product_events` tipe baru + kolom sumber (mis. `source='recommendation'`), untuk menghitung **CTR** dan **add-to-cart rate** dari rekomendasi.
- Halaman ringkasan metrik di `/admin/rekomendasi`.

**C. Perbaikan cepat lain (opsional)**
- Pakai `preferMode` untuk memfilter/menaikkan skor produk beli vs sewa.
- Isi `sessionId` agar sinyal guest terekam (cold start lebih baik).

---

## 6. Kesimpulan

- **RM1, RM2, RM3 dan tujuan 1–3: SUDAH SESUAI.** Implementasi CBF (TF-IDF + fitur numerik + cosine), pemetaan preferensi pengguna, dan integrasi ke antarmuka web terbukti lengkap di kode.
- **RM4 dan tujuan 4: BELUM SEPENUHNYA.** Pengujian saat ini hanya mengukur kebenaran fungsi, belum mengukur **kinerja/relevansi** secara kuantitatif.
- **Langkah kunci:** tambahkan modul evaluasi (precision@k/recall@k terhadap baseline) agar pertanyaan penelitian ke-4 terjawab dan siap dipertanggungjawabkan saat sidang.
