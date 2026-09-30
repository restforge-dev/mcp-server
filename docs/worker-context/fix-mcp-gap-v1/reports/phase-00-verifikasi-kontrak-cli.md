# Report Phase 00 — Verifikasi Kontrak CLI Platform (Read-Only)

Campaign: `fix-mcp-gap-v1`. Worker phase 00. Tanggal: 2026-08-22.

Versi yang diverifikasi:

| Komponen | Versi | Sumber |
|---|---|---|
| `@restforgejs/platform` (source) | 5.5.5 | `packages/platform/package.json` |
| `@restforgejs/platform` (ter-install, dipakai uji live) | 5.5.5 | `smoke-test-home/node_modules/@restforgejs/platform` |
| `restforge-designer` (source) | 1.6.5 | `packages/designer/Cargo.toml:3` |
| `restforge-designer` (binary ter-ship di platform) | 1.6.5 | `npx restforge-designer --version` |
| `@restforgejs/mcp-server` | 1.3.0 | `packages/mcp-server/package.json` |

Uji CLI live berhasil dijalankan penuh di `smoke-test-home/` (platform ter-install 5.5.5,
persis sama dengan versi source), sehingga seluruh verdict punya bukti ganda: source dan
output CLI nyata. Tidak ada command mutasi yang dijalankan.

## 1. Status Checklist per Klaim

- [x] Klaim 1 — Bentuk verb `query validate` (spasi vs kolon)
- [x] Klaim 2 — `schema validate --format json`
- [x] Klaim 3 — Perilaku `dashboard create --validate-only`
- [x] Klaim 4 — Verb `project sdk`
- [x] Klaim 5 — `npx restforge-designer auth --attach`
- [x] Klaim 6 — Verb `license info` dan `license deactivate`
- [x] Klaim 7 — Binary `restforge-consumer` dan `restforge-consumer-deploy`
- [x] Klaim 8 — `--path` pada `schema apply` dan `--resource` pada `endpoint create`

Delapan klaim selesai diverifikasi dengan bukti source dan output CLI live.

## 2. File yang Dibuat/Dimodifikasi

Dibuat:

- `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-00-verifikasi-kontrak-cli.md` (file report ini, berikut folder `reports/`)

Tidak ada file source, konfigurasi, maupun dokumentasi yang diubah di repo mana pun.
**Phase read-only, tanpa commit.**

## 3. Hasil Test

### 3.1 Tabel Verdict

| # | Klaim | Verdict | Bukti utama |
|---|---|---|---|
| 1 | CLI menerima `query validate` (spasi), bukan `query:validate` (kolon) | **REFUTED** untuk bentuk kolon, **CONFIRMED** untuk bentuk spasi | `generators/cli-entry.js:109-134`, `generators/lib/command-discovery.js:41-67`, `generators/cli/query/validate.js` |
| 2 | `schema validate` punya `--format json` | **REFUTED** di level CLI (kapabilitas ada di library, tidak ter-wire) | `generators/cli/schema/validate.js:10-12,17-23,68`, `generators/lib/dbschema-kit/validator/validator-reporter.js:48,116` |
| 3 | `dashboard create --validate-only` diterima lalu diabaikan | **REFUTED** — flag ditolak keras, exit 2, handler tidak pernah jalan | `generators/lib/arg-parser.js:91-100`, `generators/cli-entry.js:151-162`, `generators/cli/dashboard/create.js:32-...` |
| 4 | Verb `project sdk` ada dan flag-nya cocok handbook | **CONFIRMED** — cocok 100% | `generators/cli/project/sdk.js`, `restforge-handbook/commands/restforge-backend/project/sdk.md` |
| 5 | `npx restforge-designer auth --attach` ada, paritas dengan `--create` | **CONFIRMED** | `packages/designer/src/cli/mod.rs:156-201`, `src/cli/auth.rs:629-651,674-675,848` |
| 6 | Verb `license info` dan `license deactivate` ada | **CONFIRMED** | `packages/platform/server.js:430-440,741,1744-1748,3566,3614-3617` |
| 7 | Binary `restforge-consumer` + `restforge-consumer-deploy` terdaftar sebagai bin | **CONFIRMED** dengan satu drift flag pada handbook | `packages/platform/package.json` (blok `bin`), `cli/consumer.js:157-177,591-603`, `cli/consumer-deploy.js:71-87` |
| 8 | `--path` diterima `schema apply`; `--resource` diterima `endpoint create` | **REFUTED** untuk keduanya — dua-duanya ditolak sebagai unknown flag | `generators/cli/schema/apply.js` (contract), `generators/cli/endpoint/create.js` (contract), `generators/lib/arg-parser.js:91-100` |

### 3.2 Klaim 1 — Bentuk Verb `query validate`

Routing CLI murni berbasis struktur folder, tanpa tabel alias apa pun.
`generators/lib/command-discovery.js:41-67` memetakan folder di bawah `generators/cli/`
menjadi *resource* dan file `.js` di dalamnya menjadi *verb*. `generators/cli-entry.js:109-121`
hanya mengenali dua bentuk: `<resource> <verb>` (dua token terpisah) dan global verb satu token.
Token yang tidak cocok jatuh ke `generators/cli-entry.js:122-134` yang mencetak
`Error: Unknown command: <token>` dan mengembalikan exit code 2.

Tidak ada mekanisme alias kolon di seluruh jalur dispatch. `server.js:3563-3569` (`isCliCommand`)
hanya memisahkan runtime subcommand (`serve`, `validate`, `license`) dari sisanya, lalu
`server.js:3535-3551` meneruskan argumen apa adanya ke `cli-entry.js`.

Output CLI live (`smoke-test-home/`, platform 5.5.5):

```
$ npx restforge query:validate --config=x.env --sql="SELECT 1"
Error: Unknown command: query:validate

Did you mean:
  query

Run 'npx restforge --help' for available commands.
```

```
$ npx restforge query validate --help
Command: query validate

Validate SQL statement (SELECT/CTE) against a live database using EXPLAIN (read-only, does not execute data modification)

Usage:
  npx restforge query validate --sql=<STRING> [options]

Required Flags:
  --sql <string>      SQL statement to validate (SELECT or WITH/CTE only)

Optional Flags:
  --config <string>   Database config file (.env). Fallback to `.restforge/defaults.json` ...
  --pretty            Pretty-print output JSON (default: true)
```

Kesimpulan: **hanya bentuk spasi yang didukung**. Dugaan di issue #50 bahwa bentuk kolon
"masih diterima sebagai alias" **terbantah**. `codegen_validate_sql`
(`packages/mcp-server/src/tools/codegen/validate-sql.ts:105`) saat ini pasti gagal terhadap
platform 5.5.5, dan justru jatuh ke cabang error handling-nya sendiri di
`validate-sql.ts:174`. Ini menaikkan severity issue #50 dari "drift teks" menjadi
"tool rusak fungsional".

Temuan sampingan pada verb yang sama: contract menandai `--config` sebagai **opsional**
(fallback ke `.restforge/defaults.json`), sedangkan
`restforge-handbook/commands/restforge-backend/query/validate.md` menandainya **wajib**.

### 3.3 Klaim 2 — `schema validate --format json`

Contract `schema validate` hanya mengekspos satu flag:

```
flags: { "schema-path": { type: "string", required: true, ... } }
```

Komentar `generators/cli/schema/validate.js:10-12` menyatakan eksplisit bahwa
`--format`, `--dialect`, `--strict`, dan `--strict-warnings` adalah flag legacy yang
sengaja tidak dipromosikan ke contract (keputusan Fase 3 / Phase 2 #2). Handler hanya
meng-import `reportHuman` dan `getExitCode` (`schema/validate.js:22`).

Kapabilitas JSON-nya sendiri **ada di library tetapi tidak terjangkau dari CLI**:
`generators/lib/dbschema-kit/validator/validator-reporter.js:48` mengekspor `reportJson`
yang menghasilkan persis struktur `{ schemaVersion, summary: { modelsLoaded, errorCount,
warningCount }, issues }` seperti yang dijanjikan
`restforge-handbook/catalogs/sdf/validation-rules.md:41`. Grep `reportJson` menunjukkan
satu-satunya pemanggil fungsi versi validator adalah file test
(`generators/tests/unit/lib/dbschema-kit/validator/validator-reporter.test.js`).

Pembanding yang perlu dicatat: verb serumpun `schema diff` memang punya jalur JSON,
tetapi memakai flag boolean `--json`, bukan `--format json`.

Output CLI live:

```
$ npx restforge schema validate --schema-path=./schema --format=json
Invalid usage of schema validate:
  - Unknown flag: --format
```

Kesimpulan: klaim handbook di `validation-rules.md:41` **tidak akurat untuk versi 5.5.5**.

### 3.4 Klaim 3 — Perilaku `dashboard create --validate-only`

Jejak kode lengkap dari parsing sampai konsumsi:

1. `generators/cli/dashboard/create.js` mendeklarasikan enam flag: `project`, `name`,
   `payload`, `database`, `force`, `skip-sql-validation`. Tidak ada `validate-only`.
   Komentar `dashboard/create.js:10-12` mengonfirmasi flag legacy itu memang tidak
   di-expose pada kontrak Fase 04.
2. `generators/cli-entry.js:144` memanggil `parseArgs` dari `generators/lib/arg-parser.js`.
   Parser ini **strict**: `arg-parser.js:91-100` mendorong `Unknown flag: --<name>` ke array
   `errors` untuk setiap flag di luar contract. Tidak ada tabel alias; satu-satunya bentuk
   turunan yang dikenali adalah negasi `--no-<flag>` untuk flag boolean (`arg-parser.js:79-89`).
3. `generators/cli-entry.js:151-159` memeriksa `parseResult.errors` **sebelum** memanggil
   handler. Bila ada error, CLI mencetak "Invalid usage of dashboard create" plus help,
   lalu `return 2`. `contract.handler(...)` di `cli-entry.js:162` tidak pernah tercapai.
4. Parser legacy `generators/lib/validators/argument-validator.js:175-176` yang memetakan
   `--validate-only` ke `parsed.validateOnly` berada di method statis
   `ArgumentValidator.parseArguments` (`argument-validator.js:91`). Grep `parseArguments`
   di seluruh `generators/`, `src/`, `server.js`, dan `cli/` **tidak menemukan satu pun
   call site**; sebutan yang tersisa hanya komentar historis. `dashboard/create.js` bahkan
   tidak me-require `argument-validator` sama sekali. Modul itu hanya di-require oleh
   `endpoint/create.js:25` dan `processor/create.js:24`, dan keduanya hanya memakai validator
   statis (`validateProjectName`/`validateEndpointName`/`validatePayloadName`/
   `validateDatabaseType`) di `endpoint/create.js:208-229` dan `processor/create.js:905-907`.
   Jadi `parsed.validateOnly` adalah **dead code**.

Output CLI live:

```
$ npx restforge dashboard create --project=demo --name=dash-x --payload=nope.json --validate-only
Invalid usage of dashboard create:
  - Unknown flag: --validate-only
```

Bentuk `--validate-only=true` menghasilkan error identik.

Kesimpulan: skenario paling berbahaya (tool "validate" diam-diam melakukan generate penuh)
**tidak terjadi**. CLI menolak flag tersebut lebih dulu dan tidak pernah menyentuh handler
maupun filesystem. Konsekuensi untuk phase berikutnya: MCP tidak boleh mengirim
`--validate-only` dalam bentuk apa pun, dan jalur validate-only untuk dashboard harus tetap
memakai tool terpisah `codegen_validate_dashboard_payload`.

### 3.5 Klaim 4 — Verb `project sdk`

Ada di `generators/cli/project/sdk.js`. Flag aktual (dari contract, dikonfirmasi
`npx restforge project sdk --help`):

| Flag | Type | Wajib | Default |
|---|---|---|---|
| `--project` | string | Ya | - |
| `--generate` | boolean | Ya | - |
| `--sdk-path` | string | Tidak | `null` (jatuh ke `<project-root>/sdk`) |
| `--base-url` | string | Tidak | `null` (derive dari config project) |
| `--force` | boolean | Tidak | `false` |

Handbook `restforge-handbook/commands/restforge-backend/project/sdk.md` mendaftarkan
kelima flag yang sama dengan status wajib/default yang sama. **Tidak ada drift.** Klaim
issue #46 bahwa verb ini nyata dan layak di-wrap MCP terverifikasi tanpa catatan.

### 3.6 Klaim 5 — `npx restforge-designer auth --attach`

`--attach` ada di source designer sebagai field `AuthArgs.attach`
(`packages/designer/src/cli/mod.rs:156-201`), lengkap dengan validasi XOR tiga arah di
`src/cli/auth.rs:629-651` dan dispatch ke `run_attach` di `src/cli/auth.rs:674-675`
(implementasi di `src/cli/auth.rs:848`).

Binary-nya juga benar-benar terdistribusi lewat platform: `packages/platform/bin/`
memuat `restforge-designer.exe` dan `restforge-designer-linux`, di-spawn oleh wrapper
`packages/platform/cli/designer.js` yang terdaftar sebagai bin `restforge-designer`.

Paritas parameter `--create` vs `--attach` (dikonfirmasi `npx restforge-designer auth --help`
pada binary 1.6.5):

| Parameter | `--create` | `--attach` | `--remove` |
|---|---|---|---|
| `--project` | wajib | wajib | wajib |
| `--frontend-path` | ya (default `./frontend/apps`) | ya | ya |
| `--api-base-url` | ya | ya | ya |
| `--overwrite` | relevan | relevan | tidak relevan |
| `--force` | tidak relevan | tidak relevan | relevan (skip prompt) |
| `--plugins-dir` | ya | ya | ya |

Klaim issue #46 ("parameter sama: `--project`, `--frontend-path`, `--api-base-url`,
`--overwrite`") **terverifikasi persis**. Tambahan yang tidak disebut issue: `--plugins-dir`
juga tersedia untuk ketiga mode.

### 3.7 Klaim 6 — `license info` dan `license deactivate`

Keduanya ada, tetapi ditangani **runtime parser di `server.js`**, bukan oleh `cli-entry.js`.
`server.js:3566` secara eksplisit mengecualikan token `license` dari dispatch ke CLI entry.
Parsing grup subcommand ada di `server.js:430-440`: `license info` menyetel
`config.showLicense`, `license deactivate` menyetel `config.deactivateLicense`, dan action
lain di luar keduanya diteruskan ke jalur error `main()`. Eksekusi berujung pada
`validateLicense(config)` (`server.js:741`, dipanggil di `server.js:1744-1748` dan
`server.js:3614-3617`).

Flag aktual: **tidak ada flag khusus**. Setelah `license <action>`, `argStart` diset ke 2 dan
sisa argumen tetap melewati loop flag runtime generik (`server.js:450` dan seterusnya), tetapi
jalur `validateLicense` tidak membacanya. Praktisnya flag tambahan **ditoleransi diam-diam**,
tidak ditolak. Ini berbeda dari CLI generator yang strict. Handbook
(`runtime/license-info.md`, `runtime/license-deactivate.md`) menyatakan "Command ini tidak
menerima flag tambahan" — pernyataan itu benar secara fungsional, walau CLI tidak memaksakannya.

Output CLI live (`license info` bersifat read-only, hanya membaca state aktivasi lokal):

```
==========================================
  RESTFORGE LICENSE INFO
==========================================

  License Key:  7A54-7791-B502-D9E2
  Email:        <email pemilik license>
  Type:         enterprise
  Machine ID:   5495d31bdc93a357...
  Validated:    2026-08-22 14:30:21
  Last Check:   2026-08-22 14:30:21
  Expires:      Never
```

Catatan desain untuk phase berikutnya: karena `license info` tidak lewat `cli-entry.js`,
tool MCP `license_info` harus mengeksekusi `npx restforge license info` (dua token, tanpa
flag) dan mem-parse output teks, bukan JSON. Tidak ada mode output terstruktur.

### 3.8 Klaim 7 — Binary `restforge-consumer` dan `restforge-consumer-deploy`

Keduanya terdaftar di `packages/platform/package.json`:

```json
"bin": {
  "restforge": "server.js",
  "restforge-consumer": "cli/consumer.js",
  "restforge-consumer-deploy": "cli/consumer-deploy.js",
  "restforge-designer": "cli/designer.js"
}
```

**`restforge-consumer`** (`cli/consumer.js:157-177`) menerima: `--project`, `--module`
(alias `--project`), `--config`, `--consumer`, `--port`, `--license`, `--license-server`.
Tujuh entri ini cocok dengan tabel flag
`restforge-handbook/commands/restforge-backend/internal-binary.md`, dengan **satu drift**:
handbook menandai `--config` sebagai tidak wajib ("search standard"), sedangkan
`cli/consumer.js:599-603` menolak eksekusi tanpa `--config` (`Error: --config=<FILE.env> is
required`, exit 1). Akibatnya contoh kedua di handbook
(`npx restforge-consumer --project=my-app --consumer=order-events --port=3050`) akan gagal
apa adanya karena tidak menyertakan `--config`.

**`restforge-consumer-deploy`** (`cli/consumer-deploy.js:71-87`) menerima: `--project`,
`--module`, `--config`, `--consumer`, `--port`, `--output`, `--license`, dan `--force`/`-f`
(`consumer-deploy.js:85-86`, dikonsumsi di `consumer-deploy.js:603`). **Cocok penuh dengan
handbook**, termasuk alias `-f` dan default `./deploy/`.

Catatan bentuk argumen: kedua binary mem-parse dengan `startsWith('--flag=')`, sehingga
**hanya bentuk `--flag=value` yang dikenali**; bentuk terpisah spasi (`--project my-app`)
diabaikan diam-diam. Pengecualian hanya `--force`/`-f`, `--help`/`-h`, `--version`/`-v` yang
memang bare flag. Notasi `--project <NAME>` di tabel handbook adalah notasi tabel saja;
seluruh contoh di handbook sudah memakai bentuk `=` dan itu yang benar.

### 3.9 Klaim 8 — `--path` pada `schema apply` dan `--resource` pada `endpoint create`

Tidak ada mekanisme alias flag sama sekali di `generators/lib/arg-parser.js`. Satu-satunya
transformasi nama adalah negasi boolean `--no-<flag>` (`arg-parser.js:79-89`). Flag di luar
contract selalu menjadi error (`arg-parser.js:91-100`).

Contract `schema apply`: `schema-path` (wajib), `config`, `table`, `dry-run`, `allow-drop`,
`allow-modify`. Tidak ada `path`.

Contract `endpoint create`: `project`, `name`, `payload` (ketiganya wajib), `database`,
`config`, `skip-schema-check`, `force`, `create-examples`, `skip-sql-validation`,
`no-audit-migration`, `verbose`. Tidak ada `resource`.

Output CLI live:

```
$ npx restforge schema apply --path=./schema --config=nope.env
Invalid usage of schema apply:
  - Unknown flag: --path
  - Missing required flag: --schema-path

$ npx restforge endpoint create --project=demo --name=x --resource=nope.json
Invalid usage of endpoint create:
  - Unknown flag: --resource
  - Missing required flag: --payload
```

Kesimpulan: kedua contoh handbook yang dilaporkan issue #51 butir 4 memang salah, dan usulan
koreksinya (`--path` → `--schema-path`, `--resource` → `--payload`) **benar**.

### 3.10 Temuan Sampingan yang Relevan untuk Phase Berikutnya

1. **Tiga verb generator ada di source tetapi tidak punya halaman handbook:**
   `endpoint list` (`generators/cli/endpoint/list.js`), `processor list`
   (`generators/cli/processor/list.js`), dan `project tenant`
   (`generators/cli/project/tenant.js`, deskripsi contract: "Activate or deactivate
   multi-tenant mode on a project (config guard + SDF mutation + requestScope payload)",
   sepuluh flag: `activate`, `deactivate`, `project`, `name`, `schema-path`, `payload-path`,
   `config`, `default-tenant`, `dry-run`, `force`). Grep `project tenant` di seluruh
   `restforge-handbook/` menghasilkan nol hasil.

   Rekonsiliasi hitungan untuk issue #51 butir 1: source punya 44 verb generator + 2 global
   verb (`init`, `fast-track`) + 4 runtime subcommand = **50**. Handbook punya 41 halaman
   verb generator + 2 global + 4 runtime = **47** (cocok dengan hitungan issue #51). Selisih
   3 persis sama dengan ketiga verb tak terdokumentasi di atas. Jadi angka 43 di
   `commands/README.md` salah, angka 47 di issue #51 benar untuk *isi handbook*, tetapi
   target sebenarnya adalah **50** bila handbook mau lengkap terhadap source.

2. **`endpoint create --force` default `false` di CLI.** Hardcode `--force=true` di
   `codegen_create_endpoint` (issue #47) benar-benar mengubah default CLI, bukan sekadar
   mempertahankannya. Jalur non-overwrite memang tersedia di level CLI, jadi usulan
   perbaikan issue #47 bisa dijalankan tanpa perubahan platform.

3. **`--skip-schema-check` dan `--verbose` memang ada di contract `endpoint create`**, jadi
   gap yang dilaporkan issue #47 murni di sisi input schema MCP, bukan di CLI.

4. **Empat deskripsi tool bentuk kolom kolon (issue #50 butir 1) terkonfirmasi masih ada**:
   `get-dashboard-catalog.ts:39`, `get-field-validation-catalog.ts:32`,
   `get-query-declarative-catalog.ts:35`, `setup/get-config-schema.ts:29`. Selain itu
   `validate-sql.ts` menyebut bentuk kolon di tiga tempat tambahan di luar baris eksekusi:
   baris 16 (deskripsi), 36, dan 40.

## 4. Verifikasi Mandiri

```
$ git -C packages/platform branch --show-current
main

$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/designer branch --show-current
main
```

```
$ git -C packages/platform status --porcelain
?? docs/issues/issue-46-mcp-coverage-gap-project-sdk-auth-attach-license.md
?? docs/issues/issue-47-mcp-flag-cli-tidak-diekspos-dan-force-hardcode.md
?? docs/issues/issue-48-handbook-tanpa-dokumentasi-mcp-server.md
?? docs/issues/issue-49-restforge-skills-19-tool-tanpa-jalur-pemakaian-dan-drift-internal.md
?? docs/issues/issue-50-mcp-deskripsi-verb-kolon-lama-dan-query-validate-kolon-di-kode.md
?? docs/issues/issue-51-handbook-indeks-command-stale-dan-flag-drift.md

$ git -C packages/mcp-server status --porcelain
?? docs/

$ git -C packages/designer status --porcelain
(kosong)
```

Enam file issue di `packages/platform` sudah untracked **sebelum** phase ini dimulai (itu
adalah artefak audit 2026-08-21 yang menjadi input campaign); tidak ada satu pun yang
disentuh worker ini. Entri `?? docs/` di `packages/mcp-server` mencakup folder
`docs/worker-context/` tempat prompt dan report campaign berada; satu-satunya tambahan dari
worker ini di dalamnya adalah file report ini. Working tree `packages/designer` bersih.
Tidak ada checkout, tidak ada commit, tidak ada perubahan file source.

## 5. Keputusan Penting

1. **Bentuk kolon sudah mati, bukan alias.** Ini mengubah sifat issue #50 dari kosmetik
   menjadi fungsional untuk `codegen_validate_sql`. Perbaikan yang benar adalah mengganti
   argumen eksekusi ke `['query', 'validate']` (opsi 2a di issue #50), bukan mencatat deviasi
   di handbook. Pesan error "Unknown command 'query:validate'" di `validate-sql.ts:174` juga
   harus diperbarui karena teks itu justru akan cocok dengan kegagalan yang sekarang terjadi
   dan menyesatkan agent ke saran "upgrade package".
2. **Tidak ada risiko destruktif tersembunyi di `dashboard create`.** Parser strict membuat
   flag tak dikenal selalu gagal sebelum handler jalan. Tidak perlu mitigasi darurat; cukup
   pastikan MCP tidak pernah mengirim `--validate-only`.
3. **`--format json` pada `schema validate` harus diselesaikan sebagai koreksi handbook,
   bukan sebagai asumsi kapabilitas.** Kapabilitas library-nya ada (`reportJson`), jadi ini
   kandidat feature request platform yang sah, tetapi selama flag belum di-wire, dokumentasi
   `catalogs/sdf/validation-rules.md:41` harus dikoreksi atau diberi penanda status.
4. **Semua prasyarat issue #46 valid.** `project sdk`, `auth --attach`, `license info`,
   `license deactivate`, dan kedua binary consumer benar-benar ada dengan flag seperti yang
   diklaim. Phase 01+ bisa langsung membangun wrapper tanpa verifikasi ulang, dengan catatan
   `license info` hanya menghasilkan output teks.
5. **Koreksi flag issue #51 butir 4 sah dijalankan** (`--schema-path`, `--payload`).
6. **`smoke-test-home/` layak dijadikan lingkungan uji live standar campaign ini** karena
   versi platform ter-install-nya identik dengan source (5.5.5) dan tidak terhalang
   anti-tamper.

## 6. Hal yang Belum Diverifikasi

1. **Perilaku `codegen_validate_sql` end-to-end terhadap platform 5.5.5.** Yang diverifikasi
   adalah CLI menolak `query:validate`; tool MCP-nya sendiri belum dijalankan lewat MCP
   client, sehingga bentuk persis pesan error yang sampai ke agent belum diamati.
2. **Kompatibilitas mundur bentuk spasi.** Belum diuji sejak versi platform berapa
   `query validate` bentuk spasi tersedia. Catatan `>= 2.4.8` di `validate-sql.ts:40` merujuk
   ke bentuk kolon, bukan bentuk spasi. Bila mcp-server perlu mendukung platform lama,
   ambang versi minimum yang benar belum diketahui. Playground lain yang tersedia berisi
   platform 5.2.3, 5.2.4, 5.2.13, dan 5.5.2 dan bisa dipakai untuk bisection bila diperlukan.
3. **Perilaku runtime `project sdk --generate` dan `auth --attach`.** Hanya kontrak flag yang
   diverifikasi; eksekusi nyata tidak dijalankan karena bersifat mutasi.
4. **`license deactivate`.** Tidak dijalankan karena memutasi state aktivasi lintas mesin.
   Keberadaan dan jalur kodenya terverifikasi dari source saja.
5. **Alasan desain di balik flag MCP yang tidak diekspos (issue #47).** Prompt phase 00 tidak
   memasukkan ini sebagai klaim, dan penelusuran `docs-developer/design` mcp-server tidak
   dilakukan.
6. **Apakah `endpoint list`, `processor list`, dan `project tenant` sengaja tidak
   didokumentasikan** (mis. dianggap internal) atau memang tertinggal. Tidak ada catatan
   keputusan yang ditemukan.
7. **Verifikasi flag untuk verb di luar delapan klaim.** Sisa verb (payload, catalog, config,
   data, key, kafka, test, schema selain apply/validate/diff) tidak dibandingkan terhadap
   handbook pada phase ini.

## 7. Pertanyaan untuk Orchestrator

1. **Ambang versi platform minimum untuk mcp-server.** Setelah `validate-sql.ts` diubah ke
   bentuk spasi, apakah mcp-server 1.4.x boleh mensyaratkan platform yang mendukung
   `query validate` bentuk spasi (dan menaikkan ambang di deskripsi tool), atau harus
   mempertahankan fallback ke bentuk kolon untuk platform lama? Bila fallback diperlukan,
   phase 00 lanjutan perlu melakukan bisection versi memakai playground 5.2.x.
2. **Status `--format json` pada `schema validate`.** Tiga opsi: (a) koreksi handbook saja
   (hapus/tandai klaim di `validation-rules.md:41`), (b) buka issue platform baru untuk
   mem-wire `reportJson` ke flag `--format`, atau (c) keduanya. Pilihan ini menentukan
   apakah phase handbook cukup mengoreksi teks atau harus menunggu perubahan platform.
   Perlu dicatat bahwa verb serumpun `schema diff` memakai `--json` (boolean), sehingga bila
   opsi (b) dipilih, ada pertanyaan konsistensi nama flag.
3. **Cakupan tiga verb tak terdokumentasi.** Apakah `endpoint list`, `processor list`, dan
   `project tenant` masuk scope campaign ini (dokumentasi handbook dan/atau wrapper MCP),
   atau dicatat sebagai issue terpisah? `project tenant` khususnya bersifat mutasi berat
   (mengubah SDF dan payload) sehingga keputusan wrap/tidak-wrap perlu eksplisit.
4. **Bentuk output `license_info`.** Karena CLI hanya menghasilkan teks berbingkai, apakah
   tool MCP cukup meneruskan teks apa adanya, atau perlu parsing menjadi objek terstruktur
   (dengan risiko putus bila format teks berubah)?
5. **Drift `--config` pada `restforge-consumer`.** Perbaikannya di sisi handbook (ubah status
   menjadi wajib dan perbaiki contoh) atau di sisi platform (buat `--config` benar-benar
   opsional dengan pencarian standar seperti yang dijanjikan handbook)? Ini menyentuh source
   platform, sehingga di luar scope campaign MCP kecuali diputuskan sebaliknya.
6. **Urutan phase.** Mengingat `codegen_validate_sql` terbukti rusak fungsional (bukan
   sekadar drift teks), apakah perbaikan `validate-sql.ts` dinaikkan prioritasnya ke phase
   paling awal setelah phase 00?
