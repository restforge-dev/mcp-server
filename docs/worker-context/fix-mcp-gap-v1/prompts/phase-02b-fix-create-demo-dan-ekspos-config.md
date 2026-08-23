# Phase 02b — Fix Bug `--create-demo` + Ekspos `config` pada `codegen_create_endpoint`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02b (phase lanjutan kecil hasil
temuan phase 02). Sumber kebenaran: report phase 02
(`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02-ekspos-flag-dan-non-overwrite.md`,
section 7 butir 1-2) dan contract CLI
`packages/platform/generators/cli/endpoint/create.js`.

## Tujuan (Objective)

Dua perbaikan kecil pada `packages/mcp-server/src/tools/codegen/create-endpoint.ts`:

1. **Fix bug `--create-demo`.** Tool mengirim `--create-demo=<bool>`, sedangkan CLI
   menamai flag-nya `--create-examples`; parser strict membuat setiap pemakaian
   parameter `createDemo` gagal `Unknown flag` exit 2. Perbaiki agar mengirim
   `--create-examples=<bool>`. Nama parameter MCP `createDemo` DIPERTAHANKAN
   (kompatibilitas client); deskripsi parameter diperbarui agar menyebut flag CLI yang
   sebenarnya.
2. **Ekspos parameter `config`** (`--config=<file>`), opsional. Contract CLI
   menyatakan config diperlukan untuk validasi schema payload-vs-database kecuali
   `--skip-schema-check` aktif atau ada default via `config set-default`. Flag hanya
   dikirim bila parameter di-set.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current` sebelum mengubah apa pun; dilarang
pindah branch; jangan menyentuh repo lain.

## Aturan Implementasi

- DO: pertahankan urutan argumen existing; flag baru ditambahkan dengan pola
  kondisional yang sama seperti phase 02.
- DON'T: mengubah hal lain di file ini atau file lain (termasuk parameter phase 02).
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Kutip baris contract `endpoint/create.js` yang mendefinisikan `create-examples`
   dan `config` (bukti nama flag dan tipe).
2. `grep -n "create-demo" packages/mcp-server/src/` → sisa kemunculan hanya nama
   parameter MCP `createDemo`, tidak ada lagi string flag `--create-demo`.
3. Uji CLI read-only di `smoke-test-home/`:
   `npx restforge endpoint create --project=x --name=y --payload=z.json --create-examples=false --skip-schema-check`
   → harus GAGAL karena payload tidak ada, BUKAN karena `Unknown flag` (bukti nama
   flag diterima parser). Tunjukkan outputnya.
4. Bukti backward-compatible: panggilan tanpa `createDemo` dan tanpa `config`
   menghasilkan array argumen identik dengan hasil phase 02.
5. `git status --porcelain` sebelum commit: hanya `create-endpoint.ts`; `docs/` tidak
   di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-02b`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02b-fix-create-demo-dan-ekspos-config.md`

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA dua butir di atas. Temuan baru dilaporkan, tidak dikerjakan.
