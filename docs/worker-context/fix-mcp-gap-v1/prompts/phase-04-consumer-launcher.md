# Phase 04 — Tool `runtime_generate_consumer_launcher`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 04. Sumber kebenaran:

- `packages/platform/docs/issues/issue-46-mcp-coverage-gap-project-sdk-auth-attach-license.md`
  (butir 4 dan usulan perbaikan 4)
- Report phase 00 section 3.8 (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-00-verifikasi-kontrak-cli.md`):
  flag kedua binary consumer, `--config` WAJIB pada `restforge-consumer`, dan parser
  kedua binary hanya mengenali bentuk `--flag=value`
- `restforge-handbook/commands/restforge-backend/internal-binary.md`
- Struktur tool existing `src/tools/runtime/generate-launcher.ts` dan
  `check-launcher-exists.ts` sebagai pola

Baca semuanya sebelum menulis kode.

## Tujuan (Objective)

Pipeline MCP yang bisa membuat Kafka consumer (`codegen_create_kafka_consumer`) juga
bisa menyiapkan cara menjalankannya: tool baru `runtime_generate_consumer_launcher`
menghasilkan launcher untuk `restforge-consumer`, mengikuti pola "agent menyiapkan
launcher, user yang menjalankan" milik `runtime_generate_launcher`.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current`; dilarang pindah branch; repo lain
hanya boleh DIBACA.

## Spesifikasi Perubahan

1. Tool baru `runtime_generate_consumer_launcher`
   (`src/tools/runtime/generate-consumer-launcher.ts`, register di
   `runtime/index.ts`). Pelajari dulu `generate-launcher.ts`: skema parameter
   (`os` windows/linux, `mode` host/pm2, `overwrite`), konvensi nama file launcher,
   struktur respons, dan tiru konsisten.
2. **Mode `host`:** tulis skrip launcher (bat/sh sesuai `os`) yang menjalankan
   `npx restforge-consumer --project=<project> --config=<config> [--consumer=<c>]
   [--port=<p>]`. Ingat temuan phase 00: parser binary HANYA menerima bentuk
   `--flag=value`; skrip wajib memakai bentuk itu. `--config` WAJIB (CLI menolak
   tanpa itu, exit 1); jadikan parameter `config` wajib di schema dan jelaskan di
   deskripsi.
3. **Mode `pm2`:** JANGAN menulis ecosystem config manual; delegasikan ke CLI
   `npx restforge-consumer-deploy --project=<p> --config=<c> [--consumer] [--port]
   [--output] [--force]` yang memang tugasnya menghasilkan file deploy PM2 (report 00
   section 3.8: cocok penuh dengan handbook). Pada mode ini tool MENJALANKAN CLI
   tersebut (ia hanya menulis file deploy, bukan menjalankan consumer); `overwrite`
   tool dipetakan ke `--force`. Baca `packages/platform/cli/consumer-deploy.js`
   untuk memastikan output apa saja yang ditulis dan ke mana (default `./deploy/`),
   kutip barisnya, dan pastikan TIDAK ada efek samping lain (bila ternyata ada
   perilaku menjalankan proses, laporkan dan batalkan delegasi, fallback ke penulisan
   skrip manual seperti mode host).
4. Parameter yang diekspos: `cwd`, `project` (wajib), `config` (wajib), `consumer`,
   `port`, `os`, `mode`, `output` (pm2 saja), `overwrite`. Flag `--license` dan
   `--license-server` TIDAK diekspos (lisensi dibaca dari environment/config;
   konsisten dengan `runtime_generate_launcher`); sebut keputusan ini di deskripsi
   bila `generate-launcher.ts` juga mencatatnya, atau cukup di report.
5. Tool ini MENULIS file (launcher atau deploy config) tetapi TIDAK menjalankan
   consumer. Deskripsi menegaskan pola dua langkah: tool menyiapkan, user
   menjalankan. `readOnlyHint: false`.
6. SERVER_INSTRUCTIONS: perbarui bagian runtime/lifecycle seperlunya agar menyebut
   launcher consumer (minimal, konsisten gaya existing).

## Aturan Implementasi

- DO: konsisten dengan idiom `generate-launcher.ts` (penamaan file launcher,
  perilaku `overwrite`, pesan respons).
- DON'T: menjalankan `restforge-consumer` dalam bentuk apa pun (termasuk saat
  verifikasi; consumer runtime butuh Kafka hidup).
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Bukti registrasi 68 → 69 (pola harness report 03).
2. Harness terhadap hasil build: mode host → file skrip tertulis dengan isi command
   bentuk `--flag=value` (tunjukkan isi file yang dihasilkan); mode pm2 → argumen
   delegasi ke `restforge-consumer-deploy` benar; `overwrite` dipetakan ke `--force`
   hanya pada mode pm2; tanpa `overwrite`, file existing tidak ditimpa (tunjukkan
   respons precondition/penolakan sesuai pola generate-launcher).
3. Uji CLI live read-only di `smoke-test-home/`:
   `npx restforge-consumer-deploy --help` (atau `-v`) untuk bukti binary tersedia,
   plus satu run `restforge-consumer-deploy` dengan `--project` yang tidak punya
   consumer → error bersih tanpa file deploy tertulis (verifikasi filesystem sebelum/
   sesudah). Bila run ini ternyata menulis sesuatu, laporkan persis apa.
4. `git status --porcelain` sebelum commit: hanya file scope; `docs/` tidak di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-04`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-04-consumer-launcher.md`

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA tool launcher consumer di atas. Skills/handbook milik phase lain.
Temuan baru dilaporkan, tidak dikerjakan.
