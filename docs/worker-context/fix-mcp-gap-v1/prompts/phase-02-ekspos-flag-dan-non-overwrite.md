# Phase 02 — Ekspos Flag yang Hilang + Jalur Non-Overwrite `codegen_create_endpoint`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02. Sumber kebenaran: issue-47
(`packages/platform/docs/issues/issue-47-mcp-flag-cli-tidak-diekspos-dan-force-hardcode.md`)
dan report phase 00
(`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-00-verifikasi-kontrak-cli.md`,
khususnya section 3.10 temuan 2-3). Baca keduanya sebelum mengubah apa pun.

## Tujuan (Objective)

Menutup issue-47: flag CLI terdokumentasi yang hilang diekspos di input schema tool
MCP, `codegen_create_endpoint` punya jalur non-overwrite, dan tool ber-hardcode
destruktif memuat peringatan di deskripsinya.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di repo `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current` sebelum mengubah apa pun; dilarang
pindah branch. JANGAN menyentuh repo lain.

## Spesifikasi Perubahan

Semua di `packages/mcp-server/src/tools/`. Seluruh parameter baru bersifat OPSIONAL
agar backward compatible; gaya penamaan camelCase mengikuti parameter existing di tool
yang sama; flag hanya dikirim ke CLI bila di-set (ikuti pola existing di codebase,
mis. `codegen_dbschema_template`).

1. `codegen/generate-payload.ts` — tambah parameter `output` (`--output`),
   `schemaPath` (`--schema-path`), `detail` (`--detail`). Semantik mengikuti
   `restforge-handbook/commands/restforge-backend/payload/generate.md`.
2. `setup/validate-config.ts` — tambah parameter `autoCreateDb` (`--auto-create-db`).
3. `codegen/create-endpoint.ts`:
   - Tambah parameter `skipSchemaCheck` (`--skip-schema-check`) dan `verbose`
     (`--verbose`). Keduanya dikonfirmasi phase 00 ada di contract CLI.
   - Jalur non-overwrite: tambah parameter `force` dengan default `true`
     (mempertahankan perilaku sekarang). Bila `force=false`, JANGAN kirim
     `--force=true`. **PRASYARAT WAJIB sebelum wiring:** selidiki apa yang dilakukan
     CLI `endpoint create` tanpa `--force` saat module target sudah ada — baca
     `packages/platform/generators/cli/endpoint/create.js` (cari pemakaian readline /
     prompt) dan periksa konfigurasi stdin subprocess di
     `packages/mcp-server/src/lib/exec.ts`. Hardcode lama dibuat untuk menghindari
     prompt readline pada subprocess tanpa TTY. Bila jalur non-force bisa menggantung
     menunggu stdin, pastikan eksekusi tidak bisa hang (stdin tertutup sehingga prompt
     langsung gagal) dan deskripsikan perilakunya dengan jujur di description. Bila
     hasil penyelidikan menunjukkan jalur non-force TIDAK aman di-wire, JANGAN
     dipaksakan: laporkan temuan di report dan biarkan `force` default `true` sebagai
     satu-satunya jalur, dengan penjelasan di description.
   - Deskripsi tool diperbarui: default `force=true` bersifat destruktif (menimpa
     module existing) dan cara mendapatkan perilaku non-overwrite (bila di-wire).
4. `codegen/dbschema-init.ts` — tambah parameter `force` (`--force`), default tidak
   dikirim.
5. Peringatan destruktif pada deskripsi (hanya bila belum ada; jangan duplikasi):
   - `key/revoke.ts` (`--yes` hardcode)
   - `project/delete.ts` (`--yes` hardcode)
   - `designer/auth-remove.ts` (`--force` hardcode)
   - `codegen/create-dashboard.ts` (`--force=true` hardcode)
   Satu-dua kalimat per tool, gaya bahasa Inggris mengikuti deskripsi existing.

Di luar daftar ini JANGAN mengubah tool lain. Bila menemukan defect sekelas di file
lain, laporkan di report tanpa mengerjakannya (beda dengan phase 01; scope phase ini
sudah cukup besar).

## Aturan Implementasi

- DO: cek `restforge-handbook/commands/restforge-backend/` untuk semantik tiap flag
  sebelum menulis deskripsi parameternya.
- DON'T: mengubah nilai default perilaku tool existing (panggilan tanpa parameter baru
  harus menghasilkan command CLI yang identik dengan sebelumnya).
- DON'T: bump version, changelog, artefak rilis.
- DON'T: commit file `docs/worker-context/`.
- DON'T: `npm publish`/`npm login`.

## Test yang Wajib Dijalankan

1. `npm run build` di `packages/mcp-server` — lolos tanpa error.
2. Tidak ada script test di package ini (temuan phase 01); nyatakan itu di report.

## Verifikasi Mandiri

1. Bukti backward-compatible: untuk `create-endpoint`, tunjukkan (dari kode) bahwa
   panggilan tanpa parameter baru menghasilkan array argumen CLI yang sama persis
   dengan sebelum phase ini.
2. Bukti temuan readline: kutip baris relevan `endpoint/create.js` platform dan
   `lib/exec.ts` mcp-server yang mendasari keputusan wiring `force=false`.
3. Uji CLI read-only di `smoke-test-home/`: `npx restforge endpoint create --help`,
   `npx restforge payload generate --help`, `npx restforge schema init --help` —
   konfirmasi nama flag yang diekspos memang terdaftar.
4. `git -C packages/mcp-server status --porcelain` sebelum commit: hanya file scope
   phase ini; `docs/` tidak di-stage.

## Kontrak Laporan

Selesaikan kode dan test, **commit dulu** di branch campaign (pesan menyebut
`fix-mcp-gap-v1 phase-02`, TANPA trailer co-author), baru tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02-ekspos-flag-dan-non-overwrite.md`

Report memuat 7 section standar (status checklist; file + hash commit; hasil test;
verifikasi mandiri; keputusan penting; hal belum diverifikasi; pertanyaan untuk
orchestrator). Paste isi report sebagai response, tutup dengan baris path lengkap file
report.

## Strict Per-Phase

Kerjakan HANYA phase 02. Tool baru (issue-46), skills, dan handbook milik phase lain.
