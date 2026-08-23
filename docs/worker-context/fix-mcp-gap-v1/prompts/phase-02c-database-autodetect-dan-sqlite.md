# Phase 02c — `--database` Kondisional (Auto-Deteksi Config) + Enum `sqlite`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02c. Sumber kebenaran: report
phase 02b (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02b-fix-create-demo-dan-ekspos-config.md`,
section 7 butir 1-2) dan handler CLI
`packages/platform/generators/cli/endpoint/create.js` (prioritas pemilihan database,
sekitar baris 226-243).

## Tujuan (Objective)

Dua perubahan pada `packages/mcp-server/src/tools/codegen/create-endpoint.ts`,
disetujui user (Q12=A):

1. **`--database` hanya dikirim bila parameter `database` di-set.** Bila kosong,
   JANGAN kirim flag sama sekali sehingga prioritas kedua CLI (auto-deteksi `DB_TYPE`
   dari config aktif) hidup kembali, dengan fallback `postgres` tetap di sisi CLI.
   Ini perubahan perilaku default yang DISENGAJA: sebelumnya parameter kosong dipaksa
   `--database=postgres`. Deskripsi parameter dan bagian deskripsi tool yang relevan
   diperbarui agar menjelaskan urutan prioritas (eksplisit > auto-deteksi config >
   fallback postgres).
2. **Tambah `sqlite` ke enum parameter `database`** agar sejajar dengan contract CLI
   (`postgres|mysql|oracle|sqlite`).

Periksa juga apakah teks hasil/fact string di tool menyebut database default; bila ada
sebutan yang kini salah (mis. selalu menulis "postgres"), sesuaikan agar mencerminkan
nilai efektif yang benar-benar dikirim atau tidak dikirim.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current` sebelum mengubah apa pun; dilarang
pindah branch; jangan menyentuh repo lain.

## Aturan Implementasi

- DO: kutip baris prioritas database di `create.js` sebagai dasar deskripsi baru.
- DON'T: mengubah parameter lain atau perilaku lain di file ini; jangan menyentuh
  file lain.
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Harness argumen terhadap hasil build (pola section 4.4 report phase 02b):
   - Panggilan tanpa `database` → array TIDAK memuat elemen `--database=...` dan
     elemen lain tidak bergeser selain hilangnya elemen itu.
   - Panggilan `database="sqlite"` → `--database=sqlite` diterima schema dan muncul
     di array.
   - Panggilan `database="mysql"` → identik dengan perilaku lama.
2. Kutip baris `create.js` yang membuktikan fallback `postgres` tetap terjadi di sisi
   CLI saat flag tidak dikirim dan config tidak menyebut `DB_TYPE`.
3. Uji CLI read-only di `smoke-test-home/`: `npx restforge endpoint create
   --project=x --name=y --payload=z.json --database=sqlite --skip-schema-check` →
   gagal karena payload tidak ada (bukan karena nilai database ditolak). Tunjukkan
   output.
4. `git status --porcelain` sebelum commit: hanya `create-endpoint.ts`; `docs/` tidak
   di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-02c`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02c-database-autodetect-dan-sqlite.md`

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA dua butir di atas. Temuan baru dilaporkan, tidak dikerjakan.
