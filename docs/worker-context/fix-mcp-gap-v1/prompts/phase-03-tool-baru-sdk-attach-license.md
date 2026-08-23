# Phase 03 — Tool Baru: `project_sdk_generate`, `designer_auth_attach`, `license_info`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 03. Sumber kebenaran:

- `packages/platform/docs/issues/issue-46-mcp-coverage-gap-project-sdk-auth-attach-license.md`
  (butir 1-3 dan usulan perbaikan 1-3)
- Report phase 00 section 3.5 (project sdk), 3.6 (auth --attach), 3.7 (license)
  (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-00-verifikasi-kontrak-cli.md`)
- Keputusan campaign di `plan.md`: `license_info` meneruskan output teks CLI apa
  adanya; `license_deactivate` TIDAK di-wrap (mutasi aktivasi lintas mesin), dicatat
  eksplisit di SERVER_INSTRUCTIONS.

Baca semuanya sebelum menulis kode.

## Tujuan (Objective)

Tiga tool MCP baru yang menutup gap coverage issue-46 butir 1-3, terdaftar dan
berfungsi, plus catatan keputusan `license_deactivate` di SERVER_INSTRUCTIONS.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current`; dilarang pindah branch; repo lain
hanya boleh DIBACA.

## Spesifikasi Perubahan

Pelajari dulu pola file tool existing di domain yang sama (struktur registerTool,
precondition §-style, fact block, annotations, guidance) dan ikuti konsisten.

1. **`project_sdk_generate`** (`src/tools/project/sdk-generate.ts`, register di
   `project/index.ts`):
   - Wrap `npx restforge project sdk --generate --project=<project>` + opsional
     `--sdk-path=<sdkPath>`, `--base-url=<baseUrl>`, `--force` (kirim bila true).
   - Parameter: `cwd`, `project` (wajib), `sdkPath`, `baseUrl`, `force` (opsional).
   - Flag terverifikasi phase 00 section 3.5 cocok 100% dengan handbook
     (`restforge-handbook/commands/restforge-backend/project/sdk.md`); baca halaman
     itu untuk semantik (default sdk-path `<project-root>/sdk`, base-url derive dari
     config) dan tulis di deskripsi.
   - Menulis file → `readOnlyHint: false`; jelaskan perilaku overwrite `--force` di
     deskripsi (baca handler `packages/platform/generators/cli/project/sdk.js` untuk
     perilaku saat target sudah ada; kutip buktinya di report).
2. **`designer_auth_attach`** (`src/tools/designer/auth-attach.ts`, register di
   `designer/index.ts`):
   - Wrap `npx restforge-designer auth --attach --project=<project>` + opsional
     `--frontend-path`, `--api-base-url`, `--overwrite`.
   - Cermin struktur `auth-create.ts` (termasuk pre-flight probe
     `restforge-designer --version` dan pola precondition), dengan deskripsi yang
     menjelaskan beda attach vs create (retrofit ke frontend existing; rujuk
     `restforge-handbook/commands/restforge-frontend/auth.md`).
   - Deskripsi harus membantu agent memilih antara `designer_auth_create` dan tool
     ini; perbarui juga kalimat di deskripsi `auth-create.ts` bila perlu rujukan
     silang (perubahan minimal).
3. **`license_info`** (`src/tools/license/info.ts` + `license/index.ts` baru,
   register domain di `server.ts` mengikuti pola domain lain):
   - Wrap `npx restforge license info` (dua token, TANPA flag; ini runtime parser
     `server.js`, bukan cli-entry; lihat report 00 section 3.7).
   - Read-only (`readOnlyHint: true`). Output teks CLI diteruskan apa adanya di
     respons (keputusan campaign), dengan fact minimal (exit code, cwd).
   - Precondition: platform ter-install di `node_modules` project target (pola
     existing).
   - Deskripsi menyebut kegunaan diagnosis (mis. saat `setup_validate_config` gagal
     di lisensi) dan bahwa `license deactivate` sengaja tidak tersedia via MCP.
4. **SERVER_INSTRUCTIONS di `server.ts`:** tambahkan penjelasan singkat konsisten
   gaya existing: domain `license_*` (info saja), `project sdk` kini ter-wrap, auth
   attach tersedia; dan catatan eksplisit verb yang SENGAJA tidak di-wrap:
   `license deactivate` (mutasi aktivasi lintas mesin; arahkan user menjalankannya
   manual). Jangan menulis ulang bagian lain.

## Aturan Implementasi

- DO: nama tool persis `project_sdk_generate`, `designer_auth_attach`, `license_info`.
- DO: seluruh teks user-facing bahasa Inggris (kebijakan repo).
- DON'T: menyentuh tool existing di luar rujukan silang minimal butir 2.
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Bukti registrasi: hitung `registerTool` sebelum dan sesudah (65 → 68), dan
   tunjukkan ketiga tool muncul saat server di-instantiate (mis. lewat harness stub
   McpServer pola report 02b-02g yang me-list nama tool terdaftar).
2. Harness argumen terhadap hasil build untuk ketiga tool: array argumen persis
   sesuai spesifikasi, flag opsional hanya muncul bila di-set.
3. Uji CLI live di `smoke-test-home/` (read-only):
   - `npx restforge project sdk --help` (flag terdaftar) dan satu run
     `project sdk --generate --project=<nama-yang-tidak-ada>` → error bersih tanpa
     mutasi; tunjukkan output.
   - `npx restforge license info` → output info lisensi (fakta run, boleh redact
     nilai kunci di report).
   - `npx restforge-designer auth --help` → mode `--attach` terdaftar.
4. `git status --porcelain` sebelum commit: hanya file scope (file baru + index +
   server.ts); `docs/` tidak di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-03`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-03-tool-baru-sdk-attach-license.md`

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA tiga tool + SERVER_INSTRUCTIONS di atas. Launcher consumer adalah
phase 04; skills/handbook phase lain. Temuan baru dilaporkan, tidak dikerjakan.
