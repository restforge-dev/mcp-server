# Report Phase 04 — Tool `runtime_generate_consumer_launcher`

Campaign: `fix-mcp-gap-v1`. Worker phase 04. Tanggal: 2026-08-23.

Branch kerja: `campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Repo lain hanya dibaca.
Commit: `b0c1f0f`.

## 1. Status Checklist per Butir

- [x] Butir 1 — Tool baru `runtime_generate_consumer_launcher`
      (`src/tools/runtime/generate-consumer-launcher.ts`, terdaftar di `runtime/index.ts`),
      pola `generate-launcher.ts` dipelajari lebih dulu dan diikuti
- [x] Butir 2 — Mode `host` menulis skrip bat/sh yang menjalankan
      `npx restforge-consumer --project=… --config=… [--consumer=…] [--port=…]`, seluruhnya
      bentuk `--flag=value`; `config` wajib di schema dan dijelaskan di deskripsi
- [x] Butir 3 — Mode `pm2` mendelegasikan ke `npx restforge-consumer-deploy` (tanpa menulis
      ecosystem manual); `overwrite` dipetakan ke `--force`; `consumer-deploy.js` dibaca dan
      dikutip, tidak ada efek samping menjalankan proses
- [x] Butir 4 — Parameter yang diekspos persis: `cwd`, `project`, `config`, `consumer`,
      `port`, `os`, `mode`, `output`, `overwrite`; `--license`/`--license-server` tidak
      diekspos, keputusan ditulis di deskripsi tool
- [x] Butir 5 — Tool menulis file tetapi tidak pernah menjalankan consumer; pola dua langkah
      ditegaskan di deskripsi dan di setiap respons; `readOnlyHint: false`
- [x] Butir 6 — SERVER_INSTRUCTIONS bagian `RUNTIME LIFECYCLE BOUNDARY` diperluas satu
      paragraf yang menyebut launcher consumer
- [x] Test wajib 1 — `npm run build` lolos tanpa error
- [x] Test wajib 2 — dinyatakan kembali: tidak ada script test di package ini

Seluruh teks user-facing berbahasa Inggris; komentar kode mengikuti gaya file existing.

## 2. File yang Dibuat/Dimodifikasi

Dibuat:

- `packages/mcp-server/src/tools/runtime/generate-consumer-launcher.ts`
- `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-04-consumer-launcher.md`
  (file report ini, tidak di-commit)

Dimodifikasi:

- `packages/mcp-server/src/tools/runtime/index.ts` — import + panggil
  `registerRuntimeGenerateConsumerLauncher`
- `packages/mcp-server/src/server.ts` — satu paragraf tambahan di `RUNTIME LIFECYCLE BOUNDARY`

Tidak ada bump version, tidak ada `npm publish`, tidak ada file di repo lain yang disentuh.

### 2.1 Pola yang Diikuti dari `generate-launcher.ts`

| Aspek | Rujukan | Penerapan di tool baru |
|---|---|---|
| Konstanta peta nama file per OS | `generate-launcher.ts:6-15` | `CONSUMER_LAUNCHER_FILES` dengan `consumer-start.{bat,sh}` / `consumer-stop.{bat,sh}` |
| Template start/stop terpisah per OS + `applyTemplate` `{{VAR}}` | `generate-launcher.ts:19-210` | template host identik strukturnya (header komentar, echo fakta, perintah, stop by port) |
| Helper `buildExtraArgs` untuk flag opsional | `generate-launcher.ts:195-206` | `buildExtraArgs({ consumer, port })` |
| Precondition `cwd` tidak ada, respons non-error (`isError: false`) | `generate-launcher.ts:334-351` | sama persis, plus precondition tambahan `.env` |
| Loop tulis file dengan `stat` → skip bila `existed && !overwrite` | `generate-launcher.ts:395-425` | sama persis untuk mode host |
| Envelope JSON berpagar + blok "For the assistant:" | `generate-launcher.ts:436-495` | sama, ditambah fakta `consumer_started: false` |
| Struktur deskripsi (`USE WHEN` / `DO NOT USE FOR` / `Preconditions` / `PRESENTATION GUIDANCE`) | seluruh domain | sama |
| Anotasi `readOnlyHint: false, idempotentHint: false, destructiveHint: true` berkomentar alasan | `generate-launcher.ts:295-300`, `codegen/create-endpoint.ts:161-165` | sama |
| Wrapper CLI (`execProcess`, passthrough stdout/stderr, `isError: true` saat gagal) | `codegen/create-kafka-consumer.ts:86-121` | dipakai untuk cabang pm2 |

### 2.2 Bentuk Argumen yang Dihasilkan

Mode host menulis satu baris perintah:

```
npx restforge-consumer --project={{PROJECT}} --config={{CONFIG}}{{EXTRA_ARGS}}
```

`EXTRA_ARGS` hanya berisi `--consumer=<n>` dan/atau `--port=<n>` bila di-set. Tidak ada satu
pun flag berbentuk spasi. Dasarnya temuan phase 00 section 3.8 dan pembacaan langsung
`packages/platform/cli/consumer.js:152-178`: seluruh parsing memakai
`arg.startsWith('--flag=')`, sehingga `--project my-app` diabaikan diam-diam.

Dua kewajiban `--config` yang ditegakkan tool:

1. Wajib ada — `cli/consumer.js:599-603`:

   ```js
   if (!args.config) {
     console.error('Error: --config=<FILE.env> is required');
     console.log('Use --help for usage information');
     process.exit(1);
   }
   ```

   Karena itu `config` menjadi parameter wajib di `inputSchema` (bukan opsional), dan
   deskripsi menyebut bahwa handbook yang menandainya "Tidak wajib" tidak sesuai binary.

2. Wajib berakhiran `.env` — `cli/consumer.js:163-171` menolak nilai lain sebelum apa pun
   dikerjakan. Tool memeriksa ini lebih dulu dan mengembalikan respons precondition
   (`isError: false`), sehingga skrip yang pasti gagal tidak pernah tertulis ke disk.

### 2.3 Mode `pm2` — Hasil Pembacaan `cli/consumer-deploy.js`

Kontrak phase meminta bukti bahwa delegasi aman. Seluruh efek `consumer-deploy.js` adalah
penulisan file dan pembuatan folder; tidak ada `spawn`, `exec`, `execSync`, maupun
`child_process` di file itu (grep `writeFileSync|mkdirSync|spawn|exec\(|execSync|chmodSync`
hanya mengembalikan baris penulisan file). Yang ditulis:

```js
// consumer-deploy.js:625-634
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created directory: ${outputDir}`);
}

// Create logs/pm2 directory
const logsDir = path.join(projectDir, 'logs', 'pm2');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
```

```js
// consumer-deploy.js:649-661
const ecosystemContent = generateEcosystemConfig(options);
fs.writeFileSync(ecosystemPath, ecosystemContent);
...
const shellContent = generateShellScript(options);
fs.writeFileSync(shellScriptPath, shellContent);
// Make executable on Unix
try {
  fs.chmodSync(shellScriptPath, '755');
```

Jadi output tetapnya: `<output>/ecosystem.config.js` dan `<output>/consumer-manager.sh`,
dengan `outputDir = args.output ? path.resolve(projectDir, args.output) : path.resolve(projectDir, 'deploy')`
(`consumer-deploy.js:559`) — default `./deploy/` sesuai handbook. Efek samping tambahan yang
TIDAK disebut handbook: folder `<cwd>/logs/pm2/` selalu dibuat. Tool melaporkannya sebagai
fakta `also_created` di envelope dan menyebutkannya di guidance respons.

Isi `ecosystem.config.js` yang dihasilkan CLI menjalankan `npx restforge-consumer` per
consumer, dengan port auto-increment pada mode multi-consumer (`consumer-deploy.js:216-241`);
`--license` ikut disisipkan hanya bila flag itu diberikan. Karena tool tidak mengekspos
`license`, hasilnya bergantung environment/config seperti yang diinginkan.

**Satu perilaku interaktif ditemukan** dan sudah ditangani, bukan menggagalkan delegasi:
`consumer-deploy.js:600-618` memakai `readline` bila file deploy sudah ada dan `--force`
tidak diberikan:

```js
if (existingFiles.length > 0 && !args.force) {
  ...
  const answer = await prompt('Your choice (1/2): ');
```

Server MCP tidak bisa menjawab prompt itu. Mitigasi berlapis dua di tool:

1. Pre-check keberadaan `ecosystem.config.js` dan `consumer-manager.sh` di folder output.
   Bila ada dan `overwrite=false`, tool menolak lebih dulu dan **CLI tidak pernah
   dijalankan** — sejalan dengan perilaku skip milik `generate-launcher`.
2. `execProcess(..., { stdin: 'ignore' })` sebagai pengaman kedua, memakai opsi yang memang
   didokumentasikan untuk kasus ini di `src/lib/exec.ts:27-34` (EOF langsung, bukan
   menggantung sampai timeout).

Precondition tambahan mode pm2: `node_modules/@restforgejs/platform` harus ada, karena
`consumer-deploy.js:21` memanggil `require('../src/utils/install-guard').enforceLocalInstall`
yang menolak salinan global/npx-cache.

### 2.4 Penambahan SERVER_INSTRUCTIONS

Satu paragraf disisipkan di dalam section `RUNTIME LIFECYCLE BOUNDARY` (sebelum paragraf
"If the user explicitly insists…"), bukan section baru, karena batas lifecycle-nya identik:

```
The same boundary covers the Kafka consumer runtime. "Run the consumer",
"jalankan consumer", "deploy consumer ke pm2" route to
'runtime_generate_consumer_launcher', never to a Bash-spawned
'npx restforge-consumer'. That tool writes either a consumer-start/consumer-stop
script pair (mode=host) or the PM2 deploy files under ./deploy/ (mode=pm2, by
running the deploy generator, which only writes files); the user starts the
consumer. Note that the consumer is a separate binary from the API server, so
'runtime_generate_launcher' and 'runtime_check_status' do not cover it, and
'--config' is mandatory for the consumer even though the server can search for
its config.
```

## 3. Hasil Test

### 3.1 Test Wajib

```
$ npm run build
> @restforgejs/mcp-server@1.3.0 build
> tsc

BUILD_EXIT=0
```

`tsc` lolos tanpa error maupun warning.

**Tidak ada script test di package ini.** `packages/mcp-server/package.json` hanya memuat
script `build`, `dev`, `start`, dan `inspect`; tidak ada `test` dan tidak ada test runner di
`devDependencies`. Pernyataan ini konsisten dengan report phase 01 sampai 03.

### 3.2 Bukti Registrasi (68 → 69)

Hitungan mentah:

```
$ grep -rn "server.registerTool(" src --include=*.ts | wc -l
68        # sebelum (HEAD 0651ffc)
69        # sesudah
```

Harness registrasi meng-instantiate `McpServer` ASLI dari `@modelcontextprotocol/sdk`,
menjalankan sembilan pemanggilan `register*Tools` persis seperti `src/server.ts`, lalu
membaca daftar tool yang benar-benar terdaftar pada instance (pola report 03):

```
TOTAL REGISTERED TOOLS: 69
  PRESENT: runtime_generate_consumer_launcher | title="Generate Consumer Launcher" readOnlyHint=false destructiveHint=true idempotentHint=false
  input schema keys: cwd, os, mode, project, config, consumer, port, output, overwrite

runtime_* tools : runtime_check_launcher_exists, runtime_check_status, runtime_detect_config,
                  runtime_detect_project, runtime_generate_consumer_launcher,
                  runtime_generate_launcher, runtime_validate_preflight
```

Daftar parameter cocok persis dengan butir 4 kontrak, tanpa `license` maupun
`license-server`.

### 3.3 Harness Perilaku terhadap Hasil Build

Harness me-load `dist/tools/runtime/generate-consumer-launcher.js`, memasang stub `McpServer`
untuk menangkap `inputSchema` + handler, dan mengganti modul `dist/lib/exec.js` lewat ESM
loader hook (`module.register`) sehingga `execProcess` hanya merekam argumen tanpa pernah
men-spawn CLI. Mode host dijalankan terhadap folder temporer sungguhan supaya isi file bisa
dibaca kembali. Input tiap skenario di-parse lewat `z.object(inputSchema)` lebih dulu.
Harness dihapus setelah dipakai.

```
================ mode=host ================

A. windows host, minimal (no consumer, no port)
  argv  : (no subprocess)
  isError: false
  facts : Generated 2 consumer launcher files. The consumer itself was NOT started.

B. same call again WITHOUT overwrite (must skip)
  argv  : (no subprocess)
  isError: false
  facts : Generated 0; skipped 2 (already exist, overwrite=false). The consumer itself was NOT started.
  file unchanged: true

C. linux host, all optionals (consumer + port), overwrite=true
  isError: false
  facts : Generated 2 consumer launcher files. The consumer itself was NOT started.

D. config not ending in .env
  argv  : (no subprocess)
  isError: false
  facts : Precondition not met: the config file name must end with .env (received: db-connection.ini).

E. cwd does not exist
  argv  : (no subprocess)
  isError: false
  facts : Precondition not met: cwd does not exist: …\rf-consumer-launcher-YZVx3l\ghost

================ mode=pm2 ================

F. pm2 minimal
  argv  : ["npx","restforge-consumer-deploy","--project=myapp","--config=db-connection.env"]
  opts  : cwd=…\proj-pm2 stdin=ignore
  isError: false

G. pm2 all optionals, overwrite=true -> --force
  argv  : ["npx","restforge-consumer-deploy","--project=myapp","--config=db-connection.env","--consumer=order-events","--port=3050","--output=./production","--force"]
  opts  : cwd=…\proj-pm2 stdin=ignore
  isError: false

H. pm2, deploy files exist, overwrite=false -> refuse, no CLI run
  argv  : (no subprocess)
  isError: false
  facts : Nothing generated: deploy files already exist and overwrite=false.
  existing file untouched: true

I. pm2, deploy files exist, overwrite=true -> CLI with --force
  argv  : ["npx","restforge-consumer-deploy","--project=myapp","--config=db-connection.env","--force"]
  isError: false

J. pm2 without @restforgejs/platform
  argv  : (no subprocess)
  isError: false
  facts : Precondition not met: the RESTForge package is not installed in this project.

K. pm2 CLI failure passthrough
  argv  : ["npx","restforge-consumer-deploy","--project=myapp","--config=db-connection.env","--output=./other","--force"]
  isError: true
  facts : Failed to generate the consumer deploy files.

================ files in host project ================
consumer-start.bat, consumer-start.sh, consumer-stop.bat, consumer-stop.sh
input schema keys: cwd, os, mode, project, config, consumer, port, output, overwrite
```

Isi file yang benar-benar tertulis pada skenario A (`consumer-start.bat`):

```bat
@echo off
REM RESTForge Kafka Consumer Launcher
REM Generated by restforge-mcp
REM Project:  myapp
REM Config:   db-connection.env
REM Consumer: (all consumers)
REM Port:     3001

echo Starting RESTForge Kafka Consumer...
echo Project:  myapp
echo Config:   db-connection.env
echo Consumer: (all consumers)
echo Port:     3001
echo.
echo Kafka must be reachable before this starts; the consumer exits if it is not.
echo To stop: press Ctrl+C in this window, or run consumer-stop.bat in another terminal.
echo.

npx restforge-consumer --project=myapp --config=db-connection.env
```

Pasangannya (`consumer-stop.bat`), stop by port tanpa PID file, meniru `server-stop.bat`:

```bat
@echo off
REM RESTForge Kafka Consumer Stopper
REM Generated by restforge-mcp

set PORT=3001
echo Stopping RESTForge Kafka Consumer on control port %PORT%...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Killing PID %%a
    taskkill /F /PID %%a /T
    set FOUND=1
    goto :done
)

:done
if "%FOUND%"=="0" (
    echo No process found listening on port %PORT%.
    exit /b 1
)
```

Skenario C (`consumer-start.sh`, seluruh opsional di-set) — baris perintahnya:

```bash
exec npx restforge-consumer --project=myapp --config=db-connection.env --consumer=order-events --port=3050
```

Lima hal yang dibuktikan harness:

1. Seluruh flag pada skrip memakai bentuk `--flag=value`, termasuk saat opsional di-set.
2. `--consumer` dan `--port` benar-benar hilang dari perintah bila tidak di-set (skenario A),
   sehingga default binary dipertahankan; `PORT` pada skrip stop tetap terisi 3001 karena
   itu port kontrol default `restforge-consumer`.
3. Tanpa `overwrite`, file existing tidak ditimpa: skenario B melaporkan 2 file skipped dan
   isi file terbukti identik dengan sebelumnya.
4. `overwrite` dipetakan ke `--force` **hanya** pada mode pm2 (skenario G dan I). Pada mode
   host tidak ada subprocess sama sekali, jadi tidak ada `--force` yang bisa bocor ke sana.
5. Mode pm2 tanpa `overwrite` saat file deploy sudah ada tidak menjalankan CLI sama sekali
   (skenario H), sehingga prompt interaktif `consumer-deploy.js:614` tidak pernah tersentuh.

Pada seluruh skenario tidak ada satu pun pemanggilan `restforge-consumer`; satu-satunya
binary yang pernah muncul di argv adalah `restforge-consumer-deploy`.

### 3.4 Uji CLI Live di `smoke-test-home/` (Read-Only)

**`npx restforge-consumer-deploy --help`** — binary tersedia, exit 0, dan daftar flagnya
cocok dengan yang dikirim tool:

```
RESTForge Consumer Deploy CLI
=============================

Usage:
  npx restforge-consumer-deploy --project=<PROJECT> --config=<FILE.env> [options]

Options:
  --project=<NAME>    Project name (required)
  --module=<NAME>     Alias for --project
  --config=<FILE.env> Environment configuration file (required)
  --consumer=<NAME>   Specific consumer (optional, default: all consumers)
  --license=<KEY>     License key (optional, can be set in .env)
  --port=<PORT>       Port for Control API (default: 3001)
  --output=<DIR>      Output directory (default: ./deploy/)
  --force, -f         Overwrite existing files
  --help, -h          Show this help message
  --version, -v       Show version

Output Files:
  deploy/
  ├── ecosystem.config.js    # PM2 ecosystem configuration
  └── consumer-manager.sh    # Interactive shell script for PM2 management

EXIT=0
```

**Satu run terhadap project tanpa consumer** — error bersih, tanpa file deploy tertulis.
Isi folder diperiksa sebelum dan sesudah:

```
--- BEFORE ---
. .. .restforge config demo examples hooks metadata migrations node_modules
package-lock.json package.json payload reinstall.bat src temp uploads
$ ls -d deploy logs
ls: cannot access 'deploy': No such file or directory
ls: cannot access 'logs': No such file or directory

--- RUN ---
$ npx restforge-consumer-deploy --project=ghost-project-p04 --config=db-connection.env

RESTForge Consumer Deploy Generator
====================================

Project: ghost-project-p04
Config: db-connection.env
Output: D:\workspace\03_projects\restforge-systems\smoke-test-home\deploy

Error: No consumers found in project: ghost-project-p04
Expected at: src/consumers/ghost-project-p04/
EXIT=1

--- AFTER ---
. .. .restforge config demo examples hooks metadata migrations node_modules
package-lock.json package.json payload reinstall.bat src temp uploads
$ ls -d deploy logs
ls: cannot access 'deploy': No such file or directory
ls: cannot access 'logs': No such file or directory
```

Tidak ada `deploy/` maupun `logs/` yang tertulis: `scanConsumers` gagal di
`consumer-deploy.js:583-587`, jauh sebelum blok `mkdirSync` di baris 626. Ini juga
mengonfirmasi urutan yang dipakai tool untuk menyusun pesan kegagalannya.

`restforge-consumer` sendiri **tidak dijalankan dalam bentuk apa pun**, termasuk `--help`,
sesuai larangan kontrak phase. Fakta tentang binary itu (flag, kewajiban `--config`, bentuk
`--flag=value`, port default 3001) semuanya diambil dari pembacaan `cli/consumer.js` dan
report phase 00 section 3.8.

## 4. Verifikasi Mandiri

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/platform branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/designer branch --show-current
main

$ git -C restforge-handbook branch --show-current
campaign/single-table-lookup-v1
```

Tidak ada checkout dan tidak ada perubahan di `packages/platform`, `packages/designer`,
maupun `restforge-handbook` (ketiganya hanya dibaca; branch handbook adalah kondisi
pra-existing dari campaign lain).

`git status --porcelain` di `packages/mcp-server` sebelum commit:

```
 M src/server.ts
 M src/tools/runtime/index.ts
?? docs/
?? src/tools/runtime/generate-consumer-launcher.ts
```

Sesudah `git add` selektif (hanya file scope; `docs/` tidak di-stage):

```
M  src/server.ts
A  src/tools/runtime/generate-consumer-launcher.ts
M  src/tools/runtime/index.ts
?? docs/
```

Commit: `b0c1f0f` — `feat(mcp): tambah tool runtime_generate_consumer_launcher
(fix-mcp-gap-v1 phase-04)`, 3 file, 620 insertion, 0 deletion. Tanpa trailer co-author.
`docs/worker-context/` tetap untracked. Empat file harness sementara
(`__harness-*.mjs`) dihapus sebelum staging dan tidak pernah masuk index.

## 5. Keputusan Penting

1. **Nama file launcher tetap (fixed), bukan diturunkan dari nama consumer.**
   `consumer-start.{bat,sh}` dan `consumer-stop.{bat,sh}`, meniru idiom "file names are FIXED,
   not user-customisable" milik `generate-launcher`. Konsekuensinya dicatat di section 6:
   dua consumer berbeda di satu project saling menimpa nama file; guard `overwrite`
   mencegahnya terjadi diam-diam.
2. **Mode pm2 tidak ikut menulis skrip start/stop.** Delegasi menghasilkan
   `consumer-manager.sh` yang sudah menjadi helper PM2 interaktif; menambah pasangan skrip
   sendiri akan menduplikasi peran dan membuat dua sumber kebenaran untuk cara start.
3. **Prompt interaktif CLI ditangani dengan pre-check, bukan dengan membatalkan delegasi.**
   Kontrak phase meminta delegasi dibatalkan bila ada "perilaku menjalankan proses" — dan itu
   tidak ada. Prompt overwrite bukan efek samping eksekusi, melainkan gerbang konfirmasi yang
   bisa dihindari sepenuhnya dengan memeriksa keberadaan file lebih dulu, persis seperti
   `runtime_check_launcher_exists` melayani `runtime_generate_launcher`.
4. **`.env` divalidasi di sisi tool.** Bukan gold-plating: `cli/consumer.js:163-171` menolak
   ekstensi lain, sehingga menulis skrip dengan config salah ekstensi berarti menaruh file
   yang dijamin gagal di root project user.
5. **Port efektif 3001 dipakai skrip stop meski `--port` tidak dikirim ke skrip start.**
   Skrip stop butuh angka konkret. Nilai default binary dipakai sebagai fallback dan
   dibedakan eksplisit di respons (`3001 (binary default, not passed as a flag)`) supaya
   agent tidak salah melaporkan bahwa port itu dikirim sebagai flag.
6. **`os` tetap wajib walau tidak berpengaruh pada mode pm2.** Membuatnya kondisional akan
   memutus simetri dengan `runtime_generate_launcher` dan `runtime_check_launcher_exists`
   yang keduanya selalu meminta `os`; sebagai gantinya deskripsi dan schema menyebut
   eksplisit bahwa parameter itu diabaikan di mode pm2.
7. **`--license` dan `--license-server` tidak diekspos**, sesuai butir 4 kontrak. Keputusan
   ini ditulis di deskripsi tool (bagian `REQUIRED FLAGS AND ARGUMENT FORM`), bukan hanya di
   report, karena `generate-launcher.ts` sendiri tidak mencatat alasannya di mana pun dan
   agent perlu tahu bahwa ketiadaan flag itu disengaja.

## 6. Hal yang Belum Diverifikasi

1. **Jalur sukses mode pm2 terhadap project yang benar-benar punya consumer.** Delegasi hanya
   diuji lewat harness (argumen) dan lewat satu run live pada project tanpa consumer (jalur
   error). Isi `ecosystem.config.js` dan `consumer-manager.sh` hasil generate nyata belum
   pernah diamati; klaim tentang port auto-increment diambil dari
   `consumer-deploy.js:216-241`, bukan dari file hasil.
2. **Skrip host belum pernah dieksekusi.** Sesuai larangan kontrak, `restforge-consumer` tidak
   dijalankan sama sekali (butuh Kafka hidup). Jadi belum terbukti secara empiris bahwa
   perintah di dalam skrip benar-benar menyalakan consumer, hanya bahwa bentuk argumennya
   cocok dengan parser binary.
3. **Skrip stop belum diuji terhadap proses nyata.** Mekanisme netstat/taskkill dan
   lsof/fuser disalin dari `generate-launcher` yang sudah dipakai untuk server API, tetapi
   asumsi bahwa consumer benar-benar LISTEN di port kontrol belum diverifikasi dengan
   menjalankan consumer.
4. **Tabrakan nama file antar consumer.** Skenario "generate untuk consumer A lalu consumer B
   di project yang sama" belum diuji end-to-end; yang terbukti hanya bahwa run kedua tanpa
   `overwrite` melaporkan skip. Ini kandidat backlog, bukan pekerjaan phase ini.
5. **Perilaku `stdin: 'ignore'` terhadap prompt CLI yang sebenarnya.** Pengaman lapis kedua
   tidak pernah terpicu karena lapis pertama (pre-check) selalu menahan lebih dulu. Bahwa EOF
   membuat `readline` menutup dengan bersih diambil dari dokumentasi opsi di
   `src/lib/exec.ts:27-34`, bukan dari pengamatan langsung pada binary ini.
6. **Pemanggilan nyata dari client MCP.** Seluruh verifikasi sisi MCP memakai harness terhadap
   hasil build; belum ada round-trip lewat MCP client sungguhan (keterbatasan sama dengan
   report 02b sampai 03).
7. **Efek `logs/pm2` pada project yang sudah punya folder `logs`.** `mkdirSync` memakai
   `recursive: true` sehingga secara teori aman, tetapi belum diuji pada project yang sudah
   memiliki struktur `logs/` sendiri.

## 7. Pertanyaan untuk Orchestrator

1. **Drift handbook `--config` pada `restforge-consumer`.** Report phase 00 section 3.8 sudah
   menetapkan bahwa handbook salah menandai `--config` sebagai tidak wajib, dan contoh kedua
   di `commands/restforge-backend/internal-binary.md` baris 35 akan gagal apa adanya. Tool ini
   kini menegakkan versi binary. Apakah koreksi handbook masuk phase dokumentasi campaign ini,
   atau dilempar sebagai issue tersendiri saat penutupan?
2. **Padanan `runtime_check_launcher_exists` untuk consumer.** Server API punya pasangan
   check + generate; consumer sekarang hanya punya generate, dengan pengecekan keberadaan file
   tertanam di dalam tool. Apakah tool check terpisah diinginkan demi simetri, atau justru
   dihindari karena menambah satu tool lagi untuk manfaat yang sudah tercakup?
3. **Nama file per consumer.** Bila skenario multi-consumer per project dianggap umum, pola
   nama `consumer-start-<name>.bat` lebih aman daripada nama tetap. Perubahan itu memutus
   idiom "fixed file names" yang berlaku di seluruh domain runtime, jadi butuh keputusan
   orchestrator sebelum dikerjakan (phase ini sengaja mempertahankan idiom existing).
4. **Cakupan `runtime_check_status` terhadap consumer.** Tool status saat ini hanya mengenal
   server API. Consumer punya control API di port sendiri; apakah perluasan status untuk
   consumer masuk cakupan campaign ini atau menjadi issue lanjutan?
5. **Uji lapangan phase acceptance.** Jalur sukses kedua mode membutuhkan project dengan
   consumer ter-generate, dan untuk mode host juga broker Kafka yang hidup. Apakah phase
   acceptance menyiapkan broker (docker) atau cukup memverifikasi mode pm2 saja yang tidak
   butuh Kafka karena hanya menulis file?
