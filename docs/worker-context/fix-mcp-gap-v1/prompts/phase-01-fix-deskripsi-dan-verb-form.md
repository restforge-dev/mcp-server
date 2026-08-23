# Phase 01 — Fix Deskripsi Verb Kolon Lama + Bentuk Eksekusi `codegen_validate_sql`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 01. Sumber kebenaran: issue-50
(`packages/platform/docs/issues/issue-50-mcp-deskripsi-verb-kolon-lama-dan-query-validate-kolon-di-kode.md`)
dan report phase 00
(`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-00-verifikasi-kontrak-cli.md`).
Baca keduanya sebelum mengubah apa pun.

## Tujuan (Objective)

Menutup issue-50: tidak ada lagi deskripsi tool yang menyebut verb bentuk kolon lama,
dan `codegen_validate_sql` mengeksekusi bentuk sub-command `query validate` yang
terbukti (phase 00) sebagai satu-satunya bentuk yang diterima CLI platform 5.5.5.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di repo `packages/mcp-server`. Di awal sesi:
`git -C packages/mcp-server branch --show-current` harus menghasilkan
`campaign/fix-mcp-gap-v1` (branch sudah dibuat orchestrator; bila belum aktif, checkout
ke sana adalah satu-satunya perpindahan branch yang diizinkan). Setelah itu dilarang
pindah branch atau membuat branch lain. JANGAN menyentuh repo lain.

## Keputusan Orchestrator yang Mengikat

- TANPA fallback bentuk kolon (keputusan Q10=A). Bentuk spasi saja.
- Deskripsi `codegen_validate_sql` menyebut kebutuhan platform yang mendukung
  sub-command `query validate`. Klaim versi minimum lama `>= 2.4.8` (merujuk bentuk
  kolon) dihapus atau diganti pernyataan yang jujur; JANGAN mengarang angka versi baru
  yang tidak terverifikasi.

## Spesifikasi Perubahan

Semua di `packages/mcp-server/src/`:

1. `tools/codegen/validate-sql.ts`:
   - Argumen eksekusi (baris ~105): `'query:validate'` menjadi dua elemen
     `'query', 'validate'`.
   - Seluruh sebutan `query:validate` di deskripsi dan teks tool (baris ~16, ~36, ~40)
     diganti `query validate`.
   - Blok error handling (baris ~174) yang menafsirkan `Unknown command
     'query:validate'` sebagai "platform terlalu lama, sarankan upgrade" diperbarui:
     pesan itu kini menyesatkan. Sesuaikan dengan bentuk baru (`Unknown command: query`
     atau kegagalan verb) dan saran yang benar.
2. `tools/codegen/get-dashboard-catalog.ts` (baris ~39): `dashboard:catalog` menjadi
   `catalog dashboard`.
3. `tools/codegen/get-field-validation-catalog.ts` (baris ~32):
   `field-validation:catalog` menjadi `catalog field-validation`.
4. `tools/codegen/get-query-declarative-catalog.ts` (baris ~35):
   `query-declarative:catalog` menjadi `catalog query-declarative`.
5. `tools/setup/get-config-schema.ts` (baris ~29): `config:schema` menjadi
   `config schema`.

Nomor baris adalah petunjuk, bukan kontrak; temukan lokasi persisnya. Perbaiki HANYA
bentuk verb; jangan menulis ulang deskripsi di luar itu.

## Aturan Implementasi

- DO: pertahankan gaya penulisan deskripsi yang ada (bahasa Inggris, format kalimat).
- DON'T: mengubah input schema, parameter, atau perilaku tool lain (itu milik phase 02+).
- DON'T: bump version `package.json`, ubah changelog, atau artefak rilis.
- DON'T: commit file di `docs/worker-context/` (report TIDAK ikut commit).
- DON'T: `npm publish`/`npm login`.

## Test yang Wajib Dijalankan

1. Build TypeScript: `npm run build` di `packages/mcp-server` (atau command build yang
   ada di `package.json`; laporkan command persisnya). Harus lolos tanpa error.
2. Bila `package.json` punya script test, jalankan dan laporkan hasilnya (total, pass,
   fail, delta dari baseline sebelum perubahan).

## Verifikasi Mandiri

1. `grep -rn ":validate\|:catalog\|config:schema" packages/mcp-server/src/` tidak
   menghasilkan sebutan verb bentuk kolon yang tersisa (kecuali kemunculan sah yang
   bukan verb CLI; jelaskan bila ada).
2. Uji CLI read-only di `smoke-test-home/`: jalankan persis command yang kini dibangun
   tool, minimal `npx restforge query validate --help`, dan tunjukkan outputnya
   (bukti bentuk baru dikenali CLI). Bila `smoke-test-home` punya config database yang
   berfungsi, boleh tambah uji `--sql="SELECT 1"` (read-only via EXPLAIN); bila tidak
   ada, cukup `--help` dan nyatakan itu.
3. `git -C packages/mcp-server status --porcelain` sebelum commit: hanya file yang
   memang diubah phase ini (plus `docs/` yang untracked dari sebelumnya, jangan
   di-stage).

## Kontrak Laporan

Selesaikan kode dan test, **commit dulu** di branch campaign (pesan commit menyebut
`fix-mcp-gap-v1 phase-01`, TANPA trailer co-author), baru tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-01-fix-deskripsi-dan-verb-form.md`

Report memuat 7 section: Status checklist; File yang Dibuat/Dimodifikasi (tabel +
hash commit); Hasil Test; Verifikasi Mandiri; Keputusan Penting; Hal yang Belum
Diverifikasi; Pertanyaan untuk Orchestrator. Paste isi report sebagai response, tutup
dengan baris path lengkap file report.

## Strict Per-Phase

Kerjakan HANYA phase 01. Ekspos flag, tool baru, skills, dan handbook adalah milik
phase lain.
