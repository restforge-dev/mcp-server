# Phase 02d — `--database` Kondisional + Enum `sqlite` pada Dua Tool Dashboard

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02d. Sumber kebenaran: report
phase 02c (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02c-database-autodetect-dan-sqlite.md`)
sebagai pola rujukan, plus handler CLI dashboard di
`packages/platform/generators/cli/dashboard/create.js`.

## Tujuan (Objective)

Menerapkan pola perbaikan phase 02c (disetujui user, Q12=A) ke dua tool yang punya
pemaksaan default identik:

- `packages/mcp-server/src/tools/codegen/create-dashboard.ts` (baris ~112 `dbType =
  database ?? 'postgres'`, baris ~176 push tanpa syarat)
- `packages/mcp-server/src/tools/codegen/validate-dashboard-payload.ts` (baris ~103,
  ~167, pola sama)

Untuk masing-masing: kirim `--database` hanya bila parameter di-set; samakan enum
`database` dengan CLI (termasuk `sqlite` bila CLI dashboard menerimanya); perbarui
deskripsi parameter/tool dan fact string mengikuti pola `dbTypeLabel` phase 02c.

## GATE Verifikasi Sebelum Wiring (WAJIB)

Sebelum mengubah apa pun, verifikasi di source platform bahwa `dashboard create`
punya resolusi database yang setara `endpoint create` (eksplisit > auto-deteksi
config > fallback postgres). Kutip barisnya di report. Bila TERNYATA `dashboard
create` mewajibkan `--database` atau tidak punya auto-deteksi, JANGAN paksakan pola
02c: laporkan temuan, biarkan pengiriman tanpa syarat, dan cukup perbaiki
enum/deskripsi sesuai fakta. Periksa juga enum database yang diterima validator
dashboard.

Ingat: `codegen_validate_dashboard_payload` memakai verb yang sama (`dashboard
create --validate-only=...`?) — TIDAK; phase 00 membuktikan CLI menolak
`--validate-only`. Baca dulu bagaimana tool itu benar-benar membentuk argumennya
sekarang dan pastikan perubahanmu tidak mengubah mekanisme validate-only-nya, hanya
perilaku `--database`.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current`; dilarang pindah branch; jangan
menyentuh repo lain.

## Aturan Implementasi

- DO: ikuti persis idiom phase 02c (`if (database !== undefined)`, `dbTypeLabel`,
  deskripsi prioritas + "LEAVE IT UNSET").
- DON'T: mengubah parameter/perilaku lain kedua tool; jangan menyentuh file lain.
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Harness argumen terhadap hasil build (pola report 02b/02c) untuk KEDUA tool:
   tanpa `database` → flag absen dan elemen lain tidak bergeser; `database="sqlite"`
   → diterima dan muncul; nilai lama (mis. `mysql`) → identik perilaku lama.
2. Kutipan baris resolusi database di `dashboard/create.js` (hasil GATE).
3. Uji CLI read-only di `smoke-test-home/`: `npx restforge dashboard create --help`
   (bukti flag opsional/daftar nilai), plus satu run gagal-karena-payload dengan
   `--database=sqlite` bila validator menerimanya.
4. `git status --porcelain` sebelum commit: hanya kedua file scope; `docs/` tidak
   di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-02d`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02d-database-kondisional-dashboard.md`

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA dua tool di atas. Temuan baru dilaporkan, tidak dikerjakan.
