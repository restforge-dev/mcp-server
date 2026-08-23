# Phase 07 — Handbook: Koreksi Drift Indeks, Contoh, dan Kontrak Command (Issue-51 + Akumulasi Campaign)

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 07. Gate konfirmasi user sudah
dibuka (Q14=A). Sumber kebenaran:

- `packages/platform/docs/issues/issue-51-handbook-indeks-command-stale-dan-flag-drift.md`
- Report phase 00 (section 3.2, 3.3, 3.8, 3.9, 3.10 butir 1), 02e (flag baru), 02g
  (konvensi payload), 04, 06 (section 7 butir 1) di
  `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/`
- Keputusan campaign: Q11=A (klaim `--format json` dikoreksi; wire `--json` jadi issue
  platform terpisah, BUKAN dikerjakan di sini)

## Tujuan (Objective)

Menutup issue-51 dan seluruh drift handbook yang terkumpul selama campaign: indeks
mencerminkan file aktual, tidak ada contoh dengan flag di luar spec, dan kontrak
command yang berubah (flag baru `--validate-only`) terdokumentasi.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `restforge-handbook` (lanjutan phase 06, HEAD `a074d31`).
Verifikasi `git -C restforge-handbook branch --show-current`; dilarang pindah branch.
**File dirty pra-existing JANGAN disentuh/di-stage:** `api-spec/README.md`,
`catalogs/rdf/README.md` (modified), `api-spec/endpoint-upload.md`,
`catalogs/rdf/upload-config.md`, `features/file-storage/` (untracked).

## Spesifikasi Perubahan

Seluruhnya di `restforge-handbook/`. Untuk tiap butir, verifikasi dulu keadaan
aktual file sebelum mengubah (issue bisa stale).

### A. Indeks (issue-51 butir 1-3 + temuan 06)

1. `commands/README.md`: hitung ulang command publik dari file yang benar-benar ada
   dan perbaiki angka + tabel quick-reference. JANGAN menambahkan verb yang belum
   terdokumentasi (`endpoint list`, `processor list`, `project tenant` adalah issue
   terpisah). Tambahkan juga satu baris/paragraf rujukan silang ke section `mcp/`
   (tool MCP membungkus mayoritas verb di sini).
2. `commands/restforge-frontend/README.md`: tambahkan verb `auth` ke tabel Daftar
   Verb (file `auth.md` sudah ada); selaraskan total verb.
3. `commands/restforge-backend/README.md`: penamaan verb license menjadi bentuk dua
   kata (`license info`, `license deactivate`) konsisten dengan halaman detailnya.
4. `README.md` root: tambahkan baris `features/` dan `quickstart/` ke tabel Navigasi
   Repo (pre-existing gap, temuan phase 06).

### B. Contoh dengan flag salah (issue-51 butir 4-5, terverifikasi phase 00)

5. `catalogs/sdf/maintenance/sync-database.md`: `--path` menjadi `--schema-path`.
6. `examples/rdf/README.md`: `--resource` menjadi `--payload`.
7. `catalogs/sdf/validation-rules.md` baris klaim `--format json`: koreksi sesuai
   Q11=A. CLI 5.5.5 TIDAK punya flag itu (kapabilitas `reportJson` ada di library,
   belum ter-wire). Ubah kalimat agar tidak menjanjikan flag yang tidak ada; boleh
   menyebut output JSON sebagai rencana/roadmap bila kalimat sekitarnya menuntut,
   tetapi jangan mendokumentasikan flag fiktif.

### C. Kontrak command yang berubah/terkoreksi selama campaign

8. `commands/restforge-backend/dashboard/create.md` (atau file spec verb dashboard
   yang setara): dokumentasikan flag baru `--validate-only` (perilaku: pipeline
   validasi penuh, berhenti sebelum menulis file/registry, exit 0 valid; pemeriksaan
   konflik registry dilewati). CATATAN VERSI: flag ini ada di source setelah rilis
   5.5.5; beri keterangan ketersediaan versi dengan jujur tanpa mengarang nomor
   rilis.
9. `commands/restforge-backend/internal-binary.md`: `--config` pada
   `restforge-consumer` adalah WAJIB (CLI menolak tanpa itu, exit 1); perbaiki tabel
   dan contoh kedua yang tanpa `--config`. Tegaskan juga kedua binary hanya menerima
   bentuk `--flag=value`.
10. `commands/restforge-backend/query/validate.md`: `--config` berstatus opsional
    dengan fallback `.restforge/defaults.json` (bukti help CLI phase 00/01), bukan
    wajib.
11. Konvensi nama payload per verb (temuan 02g, bukti CLI live): tambahkan catatan
    singkat pada deskripsi flag `--payload` di `endpoint/create.md` dan
    `processor/create.md` (nama file, dengan atau tanpa `.json`, di-lowercase, bentuk
    path ditolak) serta `kafka/consumer-create.md` (nama atau path, `.json`
    ditambahkan otomatis pada nama telanjang). Satu-dua kalimat per file, jangan
    menulis ulang halaman.

### D. Verifikasi path `data pull` (pertanyaan phase 06)

12. Telusuri source platform (read-only) untuk bentuk default keluaran `data pull`:
    `data-storage/<table>.json` atau `data-storage/<schema>/<table>.json`. Kutip
    bukti barisnya. Koreksi sel di `mcp/data.md` bila perlu, dan periksa
    `commands/restforge-backend/data/pull.md` konsisten dengan temuan.

### E. Kebersihan (issue-51 butir 6)

13. Hapus file `.report.md` sisa siklus doc-review yang berdampingan dengan sumbernya
    (mis. `commands/restforge-backend/catalog/dashboard.report.md`, beberapa di
    `features/dashboard/`). Daftar semua yang dihapus di report. HANYA file berpola
    `*.report.md`; jangan menyentuh file lain.

## Aturan Bahasa

Sama dengan phase 06: bahasa Indonesia konvensi handbook, heading Indonesia murni,
tanpa em dash dalam kalimat, istilah teknis bentuk asli.

## Test yang Wajib Dijalankan

Tidak ada test suite. Verifikasi berbentuk audit silang.

## Verifikasi Mandiri

1. Hitungan command baru di `commands/README.md` cocok dengan jumlah file verb aktual
   (tunjukkan perhitungannya).
2. Grep pasca-koreksi: `--path=` di sync-database.md → nol; `--resource` di
   examples/rdf → nol; `--format json` pada schema validate → tidak lagi
   didokumentasikan sebagai flag yang ada; `license-info`/`license-deactivate`
   (bentuk tanda hubung sebagai nama verb) → nol di commands README backend.
3. Kutipan bukti source untuk butir 12.
4. `git status --porcelain`: hanya file scope phase ini yang berubah/di-stage
   (termasuk deleted `.report.md`); lima entri dirty pra-existing utuh dan tidak
   di-stage.

## Kontrak Laporan

Commit dulu di branch campaign handbook (pesan menyebut `fix-mcp-gap-v1 phase-07`,
TANPA trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-07-handbook-koreksi-drift.md`

Report 7 section standar, dengan tabel butir A-E → status + bukti. Paste isi report
sebagai response, tutup dengan baris path lengkap file report.

## Strict Per-Phase

Kerjakan HANYA butir A-E. Dokumentasi verb yang belum ada halamannya, wire
`--json` di platform, dan perubahan repo lain adalah pekerjaan lain. Temuan baru
dilaporkan, tidak dikerjakan.
