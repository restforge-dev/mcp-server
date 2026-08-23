# Phase 00 — Verifikasi Kontrak CLI Platform (Read-Only)

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 00.

## Tujuan (Objective)

Memverifikasi delapan klaim tentang kontrak CLI platform yang menjadi dasar keputusan
phase 01 sampai 07. Phase ini murni investigasi: TIDAK ada perubahan kode, TIDAK ada
commit. Satu-satunya file yang boleh ditulis adalah file report.

## Branch

Phase read-only. JANGAN checkout, membuat branch, atau mengubah working tree di repo
mana pun. Sebelum mulai, verifikasi `git -C <repo> branch --show-current` untuk
`packages/mcp-server` (harus `campaign/fix-mcp-gap-v1`) dan `packages/platform` (catat
apa adanya, jangan diubah).

## Konteks

Sumber kebenaran campaign: `packages/platform/docs/issues/issue-46-*.md` sampai
`issue-51-*.md`, plus `issue-45-mcp-dashboard-create-validate-tidak-kompatibel-cli-5-4-4.md`
sebagai konteks. Baca keenam issue tersebut lebih dulu.

Fakta awal yang sudah diketahui (verifikasi ulang, jangan diasumsikan benar):

- `packages/mcp-server/src/tools/codegen/validate-sql.ts:105` mengeksekusi
  `npx restforge query:validate` (bentuk kolon).
- `packages/platform/generators/lib/validators/argument-validator.js:175-176` mem-parse
  `--validate-only` menjadi `parsed.validateOnly`, tetapi grep `validateOnly` di
  `generators/` tidak menemukan konsumen.
- Komentar `packages/platform/generators/cli/dashboard/create.js:10-11` menyatakan flag
  legacy `--validate-only` tidak di-expose pada kontrak Fase 04.
- Memory project: anti-tamper platform bisa memblokir CLI yang dijalankan dari working
  tree source; uji CLI live harus lewat project yang meng-install package platform
  (mis. `smoke-test-home/` atau project di `D:\restforge-playground\`), bukan dari
  `packages/platform` langsung.

## Klaim yang Diverifikasi

Untuk tiap klaim, tentukan verdict `CONFIRMED` / `REFUTED` / `PARTIAL` disertai bukti
`file:baris` dari source dan, bila memungkinkan, output CLI live.

1. **Bentuk verb query.** Apakah CLI menerima `npx restforge query validate` (bentuk
   spasi, sesuai handbook), `query:validate` (bentuk kolon, dipakai mcp-server), atau
   keduanya? Telusuri routing command di `packages/platform/generators/cli/` (atau
   entry CLI yang sebenarnya; temukan sendiri lokasinya).
2. **`schema validate --format json`.** Ada atau tidak di implementasi saat ini
   (rujukan klaim: `restforge-handbook/catalogs/sdf/validation-rules.md:41` vs
   `commands/restforge-backend/schema/validate.md`).
3. **Perilaku `dashboard create --validate-only` saat ini.** Parser mana yang dipakai
   `dashboard create`; bila flag dikirim, apakah ditolak, diterima-lalu-diabaikan
   (bahaya: tool "validate" malah generate penuh), atau berfungsi validate-only.
   Sertakan jejak kode lengkap dari parsing sampai konsumsi.
4. **Verb `project sdk`.** Ada di source? Flag aktual vs dokumentasi handbook
   (`--generate`, `--project`, `--sdk-path`, `--base-url`, `--force`).
5. **`restforge-designer auth --attach`.** Ada di source designer (periksa
   `packages/designer/src/cli/` dan/atau distribusi binary designer di platform)?
   Paritas parameternya dengan `--create`.
6. **Verb `license info` dan `license deactivate`.** Ada di source? Flag aktual.
7. **Binary `restforge-consumer` dan `restforge-consumer-deploy`.** Terdaftar sebagai
   bin di `package.json` platform? Flag aktual vs
   `restforge-handbook/commands/restforge-backend/internal-binary.md`.
8. **Dua klaim flag issue-51:** apakah `--path` diterima `schema apply` (alias atau
   tidak), dan apakah `--resource` diterima `endpoint create`. Bukti dari parser.

Uji CLI live bersifat pelengkap: lakukan hanya bila ada project playground dengan
platform ter-install yang bisa dipakai tanpa mengubah isinya, dan catat versi package
yang ter-install di sana. Bila uji live tidak memungkinkan, verdict berbasis source
saja dan nyatakan itu di report.

## Aturan Implementasi

- DO: baca source `packages/platform` dan `packages/designer` sebanyak yang diperlukan.
- DO: catat versi platform di source (`packages/platform/package.json`) dan versi yang
  ter-install di playground yang dipakai.
- DON'T: mengubah file apa pun di repo mana pun (kecuali file report).
- DON'T: menjalankan command yang memutasi database, project playground, atau registry
  (`schema migrate`, `endpoint create` tanpa dry-run, `project delete`, dst.). Verb
  read-only (`--help`, `--version`, `validate`, `catalog`, `list`) diperbolehkan.
- DON'T: commit, checkout, `npm publish`, atau operasi git yang mengubah state.

## Test yang Wajib Dijalankan

Tidak ada suite test. Verifikasi berbentuk pembacaan source + command read-only.

## Verifikasi Mandiri

Sebelum menulis report, jalankan dan catat:

- `git -C packages/platform status --porcelain` dan `git -C packages/mcp-server status --porcelain`
  → keduanya harus tidak memuat perubahan baru yang kamu buat (worktree platform boleh
  saja sudah kotor dari sebelumnya; yang dilarang adalah perubahan tambahan darimu).

## Kontrak Laporan

Tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-00-verifikasi-kontrak-cli.md`

Report wajib memuat 7 section: (1) Status checklist per klaim 1-8, (2) File yang
Dibuat/Dimodifikasi (hanya file report; tanpa commit, sebut eksplisit "phase read-only,
tanpa commit"), (3) Hasil Test (tabel verdict per klaim + bukti file:baris + output CLI
bila ada), (4) Verifikasi Mandiri (output command di atas), (5) Keputusan Penting,
(6) Hal yang Belum Diverifikasi, (7) Pertanyaan untuk Orchestrator.

Setelah report ditulis, paste isi report sebagai response, dan tutup response dengan
baris path lengkap file report.

## Strict Per-Phase

Kerjakan HANYA phase 00. Jangan memperbaiki apa pun yang ditemukan; perbaikan adalah
milik phase 01-07.
