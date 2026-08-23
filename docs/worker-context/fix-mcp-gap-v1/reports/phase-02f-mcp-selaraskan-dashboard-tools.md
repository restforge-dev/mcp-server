# Report Phase 02f — Selaraskan Dua Tool Dashboard MCP dengan CLI Baru

Campaign: `fix-mcp-gap-v1`. Worker phase 02f. Tanggal: 2026-08-23.
Branch: `campaign/fix-mcp-gap-v1` di `packages/mcp-server` (tanpa checkout, tanpa menyentuh
repo lain).

Versi rujukan: `@restforgejs/mcp-server` 1.3.0 (tidak di-bump), `@restforgejs/platform` 5.5.5
ter-install di `smoke-test-home/`, plus working tree `packages/platform` yang sudah memuat flag
`--validate-only` dari phase 02e. Node.js v22.21.1.

**Ringkasan hasil GATE:** jalur non-force `dashboard create` TIDAK punya prompt readline. Setiap
konflik (file modul maupun registry) berakhir sebagai error bersih dengan exit code 1. Karena itu
parameter `force` ditambahkan tanpa mekanisme `stdin: 'ignore'` maupun deteksi aborted seperti
`create-endpoint.ts`. Bukti barisnya dikutip di section 4.1 dan dibuktikan secara lapangan di
section 4.5.

Sisa issue-45 di sisi mcp-server tertutup: argumen payload kini diteruskan apa adanya (butir 2),
deskripsi `codegen_validate_dashboard_payload` menyatakan kebutuhan versi platform secara jujur
plus penanganan khusus jawaban CLI lama, dan `codegen_validate_payload` menyebut batas cakupannya
(butir 3).

## 1. Status Checklist

- [x] Ketiga sumber kebenaran dibaca lebih dulu: issue-45 (butir 2 dan 3), report phase 02e
      (khususnya section 6 butir 4), report phase 02d (harness `--payload=z`)
- [x] Branch diverifikasi `campaign/fix-mcp-gap-v1` sebelum satu pun baris diubah; tidak ada
      perpindahan branch; repo `packages/platform` tidak disentuh
- [x] GATE dijalankan sebelum wiring `force`: `packages/platform/generators/cli/dashboard/create.js`
      dibaca sampai ke dua generator yang dipanggilnya (section 4.1)
- [x] GATE menyimpulkan tidak ada jalur prompt sama sekali pada `dashboard create`, sehingga
      `stdin: 'ignore'` dan deteksi aborted TIDAK diterapkan
- [x] Butir 1: argumen payload diteruskan apa adanya pada kedua tool dashboard; pre-flight memakai
      daftar kandidat yang sama dengan CLI
- [x] Helper bersama tidak diubah: tidak ada helper payload bersama di package ini, dan
      `create-endpoint.ts` beserta tool codegen lain sengaja dibiarkan (section 5 butir 2)
- [x] Butir 2: deskripsi `codegen_validate_dashboard_payload` menyebut kebutuhan versi platform
      tanpa mengarang angka rilis, plus cabang penanganan `Unknown flag: --validate-only`
- [x] Butir 3: parameter `force` (default `true`) pada `codegen_create_dashboard`; `force=false`
      menghilangkan `--force=true`; deskripsi memuat catatan penggantian tipe database (temuan 02d)
- [x] Butir 4: deskripsi `codegen_validate_payload` menyebut cakupan payload CRUD per tabel dan
      mengarahkan payload dashboard ke tool dashboard; tanpa perubahan perilaku
- [x] Perilaku `--database` kedua tool tidak diubah (final sejak 02d)
- [x] `npm run build` lolos
- [x] Tidak ada script test di package ini (dinyatakan ulang, section 3.2)
- [x] Tidak ada bump version, tidak ada `npm publish`, `docs/worker-context/` tidak di-commit
- [x] Commit sebelum report, tanpa trailer co-author
- [x] Strict per-phase dipatuhi: temuan baru dilaporkan (section 7), tidak dikerjakan

## 2. File yang Dimodifikasi + Hash Commit

Commit: `1ecc27a50060f0b291ba3a8fe447df8c19553c1e`
Pesan baris pertama:
`fix(mcp): teruskan payload apa adanya, force opsional, dan deskripsi jujur pada tool dashboard (fix-mcp-gap-v1 phase-02f)`

| File | Perubahan |
|---|---|
| `packages/mcp-server/src/tools/codegen/create-dashboard.ts` | Helper lokal `resolvePayloadPath`; schema `payload` menerima nama/path apa adanya dengan ekstensi; pre-flight payload memakai kandidat CLI plus petunjuk ekstensi; parameter `force` (default `true`) dan `--force=true` menjadi kondisional; fact `Payload`/`Payload file`/`Overwrite mode`; deskripsi tool (paragraf force, konsekuensi registry, precondition, presentation guidance, guidance error) |
| `packages/mcp-server/src/tools/codegen/validate-dashboard-payload.ts` | Helper lokal `resolvePayloadPath`; schema `payload` sama seperti di atas; pre-flight payload baru; paragraf "Platform version requirement"; cabang error baru untuk `Unknown flag: --validate-only`; fact `Payload`/`Payload file`; precondition diperbarui |
| `packages/mcp-server/src/tools/codegen/validate-payload.ts` | Paragraf "Scope" (payload CRUD per tabel) dan satu baris DO NOT USE FOR yang mengarah ke `codegen_validate_dashboard_payload`. Deskripsi saja, tanpa perubahan perilaku |

Statistik diff: 3 file, 172 insertion, 35 deletion. Tidak ada file lain tersentuh;
`packages/mcp-server/docs/` tetap untracked.

Inti perubahan pembentukan argumen pada `create-dashboard.ts`:

```ts
      const cliArgs = [
        'restforge',
        'dashboard',
        'create',
        `--project=${project}`,
        `--name=${name}`,
        `--payload=${payload}`,
        `--database=${dbType}`,
      ];
      if (force) cliArgs.push('--force=true');
      if (skipSqlValidation !== undefined) cliArgs.push(`--skip-sql-validation=${skipSqlValidation}`);
```

Helper lokal yang dipakai kedua tool dashboard (disalin di masing-masing file, bukan modul
bersama, alasannya di section 5 butir 2):

```ts
async function resolvePayloadPath(projectCwd: string, payload: string): Promise<string | null> {
  for (const candidate of [join(projectCwd, 'payload', payload), join(projectCwd, payload)]) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}
```

Cabang versi lama pada tool validator:

```ts
      const unknownFlag = `${result.stdout}\n${result.stderr}`.includes('Unknown flag: --validate-only');
      if (!result.success && unknownFlag) {
```

## 3. Hasil Test

### 3.1 Build

```
$ npm run build
> @restforgejs/mcp-server@1.3.0 build
> tsc

BUILD_EXIT=0
```

Lolos tanpa error dan tanpa warning.

### 3.2 Script test

Dinyatakan ulang: **tidak ada script test di package ini.** Isi `scripts` pada
`packages/mcp-server/package.json` masih sama seperti yang dicatat phase 02d: `build`, `dev`,
`start`, `inspect`. Tidak ada entry `test`. Verifikasi karena itu bertumpu pada harness argumen
terhadap hasil build (section 4.2) dan uji CLI live (section 4.3 sampai 4.5).

## 4. Verifikasi Mandiri

### 4.1 GATE — perilaku jalur non-force `dashboard create` (dijalankan sebelum wiring)

Tiga titik yang menentukan, seluruhnya di jalur yang dilewati handler saat `force` bernilai false.

**a. Konflik registry.** `packages/platform/generators/cli/dashboard/create.js:163-172`:

```js
            const registry = projectRegistry.loadProjectRegistry();
            if (registry.projects[project]) {
                const existing = registry.projects[project];
                if (existing.database && database && existing.database !== database && !force) {
                    if (muted) cliOutput.unmute();
                    console.error(`Project "${project}" is already registered with database type "${existing.database}".`);
                    console.error(`Cannot change to "${database}" without --force.`);
                    throw new Error(`Project "${project}" already registered with database "${existing.database}"`);
                }
            }
```

`throw`, bukan pertanyaan. Sama dengan run G report 02e.

**b. Konflik file modul dashboard.**
`packages/platform/generators/lib/generators/dashboard-generator.js:106-114`:

```js
    let archivedPath = null;
    if (fs.existsSync(filePath)) {
      if (!force) {
        throw new Error(
          `Dashboard module already exists at '${filePath}'. Pass options.force=true to overwrite.`
        );
      }
      archivedPath = this._archiveExistingFile(filePath);
    }
```

Ini jawaban langsung atas pertanyaan GATE: konflik FILE juga error bersih, bukan prompt.

**c. Konflik main module.** `packages/platform/generators/lib/generators/main-module-generator.js:29-33`:

```js
      // Check if file already exists
      if (fs.existsSync(moduleFilePath) && !options.force) {
        console.log(`Main module ${moduleName}.js already exists, skipping generation`);
        return true;
      }
```

Di-skip diam-diam, tidak gagal, pada kedua jalur.

**Tidak ada readline di seluruh rantai dashboard.** Pencarian `readline` di
`packages/platform/generators/` menemukan pemakaian hanya pada `cli/fast-track.js`, `cli/init.js`,
`cli/kafka/consumer-create.js`, `cli/key/revoke.js`, `cli/project/delete.js`, dan
`lib/utils/conflict-checker.js`. Yang terakhir itulah sumber prompt `(y/N)` yang ditangani
`create-endpoint.ts`, dan pemanggilnya hanya `cli/endpoint/create.js:32`,
`cli/processor/create.js:25`, serta `lib/tenant/endpoint-regenerator.js:204`. `cli/dashboard/create.js`
tidak me-require `conflict-checker` sama sekali, begitu pula kedua generator yang dipanggilnya
(daftar `require` keduanya hanya `fs`, `path`, `FileUtils`, `ConfigReader`, dan template).

**Kesimpulan GATE:** jalur non-force dashboard seluruhnya error bersih. Konsekuensi yang
diterapkan: parameter `force` saja, tanpa `stdin: 'ignore'` dan tanpa cabang `abortedOnPrompt`.
Menambahkan keduanya hanya akan menjadi kode mati yang menyesatkan pembaca berikutnya.

### 4.2 Harness argumen terhadap hasil build

Pola sama dengan report 02b sampai 02d: harness me-load **file hasil build**
(`dist/tools/codegen/create-dashboard.js` dan `dist/tools/codegen/validate-dashboard-payload.js`),
memasang stub `McpServer` untuk menangkap `inputSchema` dan handler, lalu mengganti modul
`lib/exec.js` lewat ESM loader hook sehingga `execProcess` merekam argumen apa adanya tanpa pernah
men-spawn CLI. Stub `execProcess` juga bisa dipaksa mengembalikan hasil tertentu, dipakai untuk
skenario C dan D tool validator. Folder `cwd` palsu berisi `node_modules/@restforgejs/platform`
dan tiga file uji (`payload/dashboard-x.json`, `payload/noext` tanpa ekstensi,
`payload/withext.json`) agar kedua pre-flight benar-benar dijalankan. Input tiap skenario di-parse
lewat `z.object(inputSchema)` lebih dulu.

```
================ codegen_create_dashboard ================

A. default (no force parameter)
  parsed.force : true
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=dashboard-x.json","--database=postgres","--force=true"]
  stdin option : undefined

B. force=true (explicit)
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=dashboard-x.json","--database=postgres","--force=true"]
  identical to A : true

C. force=false
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=dashboard-x.json","--database=postgres"]
  has --force  : false
  stdin option : undefined

D. force=false + database=sqlite + skipSqlValidation=true
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=dashboard-x.json","--database=sqlite","--skip-sql-validation=true"]

E. payload given as a path "payload/dashboard-x.json"
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=payload/dashboard-x.json","--database=postgres","--force=true"]

  payload schema:  ["dashboard-x.json=accepted","payload/dashboard-x.json=accepted","dashboard-mck.json=accepted","../escape.json=rejected","a b.json=rejected"]

F. payload="withext" (only withext.json exists) — pre-flight message
  spawned CLI  : false
  isError      : false
Payload argument: withext
Locations checked: ...\phase02f-harness-cwd\payload\withext and ...\phase02f-harness-cwd\withext
NOTE: 'withext.json' does exist. The payload argument is passed to the CLI verbatim and the CLI never appends an extension, so retry with payload='withext.json'.

G. payload="noext" (file literally named noext, no extension)
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=noext","--database=postgres","--force=true"]

================ codegen_validate_dashboard_payload ================

A. default
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=dashboard-x.json","--database=postgres","--validate-only=true"]

B. payload as path
  args         : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=payload/dashboard-x.json","--database=postgres","--validate-only=true"]

C. CLI answers "Unknown flag: --validate-only" (platform 5.5.5)
  isError      : true
  --- first lines of tool text ---
  Dashboard payload was NOT validated: the installed RESTForge version does not support validate-only mode.
  upgrade branch hit : true
  says NOT a payload error : true
  mentions 5.5.5 boundary  : true

D. genuine validation failure
  upgrade branch hit : false
  normal fail branch : true

================ required parameters (io=input) ================
  codegen_create_dashboard -> ["cwd","project","name","payload"] | annotations: {"title":"Create Dashboard Module","readOnlyHint":false,"destructiveHint":true,"idempotentHint":false}
  codegen_validate_dashboard_payload -> ["cwd","project","name","payload"] | annotations: {"title":"Validate Dashboard Payload","readOnlyHint":true,"idempotentHint":true}
```

Yang dibuktikan, dipetakan ke butir yang diminta prompt phase:

1. **Payload utuh.** Input `dashboard-x.json` menghasilkan `--payload=dashboard-x.json`, bukan
   `--payload=dashboard-x`. Bandingkan dengan baseline 02d yang mengirim `--payload=z` untuk
   `z.json`. Bentuk path (`payload/dashboard-x.json`) juga diteruskan utuh (skenario E dan B),
   dan nama tanpa ekstensi yang memang ada apa adanya tetap dikirim apa adanya (skenario G) —
   tool tidak lagi menambah maupun membuang apa pun.
2. **Jalur default `create_dashboard` identik perilaku lama.** Skenario A memuat `--force=true`
   pada posisi yang sama persis dengan array lama di report 02d, dengan satu perbedaan yang memang
   diminta: nilai `--payload` kini lengkap. Skenario B membuktikan `force=true` eksplisit
   menghasilkan array identik dengan default.
3. **`force=false` menghilangkan `--force=true`** (skenario C) dan tidak menambahkan opsi `stdin`
   apa pun (`stdin option : undefined` pada kedua jalur), sesuai kesimpulan GATE.
4. **Schema payload** menerima nama ber-ekstensi dan bentuk path, sekaligus tetap menolak segmen
   `..` dan karakter di luar daftar (spasi ditolak).
5. **Cabang versi lama** hanya menyala pada jawaban `Unknown flag: --validate-only` (C) dan tidak
   membajak kegagalan validasi sungguhan (D).

Perlu dicatat: `force` memakai `.default(true)`, jadi tetap tidak muncul pada daftar parameter
wajib, sama seperti pola `create-endpoint.ts`.

### 4.3 Uji CLI live terhadap platform working tree — payload utuh

Direktori uji temporer berisi hanya payload dan satu file SQL widget, dijalankan lewat
`generators/cli-entry.js` pada working tree platform (bukan `smoke-test-home/`, karena platform
5.5.5 ter-install di sana belum memuat flag baru). Bentuk argumen yang dipakai persis seperti yang
kini dibangun tool.

```
=== BEFORE ===
./payload/dashboard-bad.json
./payload/dashboard-live.json
./payload/query/widget-sample.sql

=== RUN A: exact tool argv, validate-only ===
$ node <platform>/generators/cli-entry.js dashboard create --project=x --name=dash-y \
    --payload=dashboard-live.json --database=postgres --validate-only=true
Configuration:
  Project      x
  Dashboard    dash-y
  Database     postgres

Payload:
  Source       payload/dashboard-live.json
  Status       validated

OK Validation passed in 0.01s
EXIT=0

=== AFTER A ===
./payload/dashboard-bad.json
./payload/dashboard-live.json
./payload/query/widget-sample.sql
```

Exit 0 dan nol file baru: tidak ada `src/modules/`, `metadata/`, maupun `.restforge/`.

Tiga run pembanding pada direktori yang sama:

```
=== RUN B: defective payload, validate-only ===
Error: Widget 'bad_widget' query 'query' uses undeclared placeholder ':year' (declare in 'params')
EXIT=1

=== RUN C: OLD form (no .json extension) ===
Error: Payload file not found: dashboard-live
EXIT=1

=== RUN D: payload as path 'payload/dashboard-live.json' ===
  Status       validated
OK Validation passed in 0.00s
EXIT=0
```

Run C adalah reproduksi persis gejala issue-45 butir 2 (`Payload file not found: <nama tanpa
ekstensi>`) memakai bentuk argumen yang dibangun tool SEBELUM phase ini, dan run A adalah bentuk
yang dibangun tool SESUDAH phase ini. Isi direktori tidak berubah pada keempat run.

### 4.4 Uji negatif versi lama di `smoke-test-home/`

Platform ter-install di sana `5.5.5` (dibaca dari
`smoke-test-home/node_modules/@restforgejs/platform/package.json`), yaitu versi sebelum flag baru.
Bentuk argumen tool dijalankan apa adanya:

```
$ cd smoke-test-home
$ NODE_ENV=production npx restforge dashboard create --project=x --name=dash-y \
    --payload=z.json --database=postgres --validate-only=true
EXIT=2
=== STDOUT ===
=== STDERR ===
Invalid usage of dashboard create:
  - Unknown flag: --validate-only

Command: dashboard create
...
Optional Flags:
  --database <string>     Database type (postgres|mysql|oracle|sqlite). Default: postgres (default:
                          null)
  --force                 Overwrite existing files in the output directory (default: false)
  --skip-sql-validation   Skip SQL keyword validation (default: false)
```

Tiga fakta yang dipakai kode baru: pesan muncul di **stderr** (stdout kosong), exit code **2**
(bukan 1), dan string persisnya `Unknown flag: --validate-only`. Karena itu cabang deteksi membaca
gabungan `stdout` dan `stderr`, dan tidak bergantung pada exit code tertentu:

```ts
const unknownFlag = `${result.stdout}\n${result.stderr}`.includes('Unknown flag: --validate-only');
if (!result.success && unknownFlag) {
```

Kecocokan string diuji ulang lewat harness skenario C (section 4.2) dengan stderr hasil rekaman
run nyata di atas, dan cabang menyala. Isi respons tool pada cabang itu menyatakan tiga hal:
payload TIDAK diperiksa sama sekali, penyebabnya versi platform yang lebih tua daripada rilis
sesudah 5.5.5, dan dua jalan keluar (upgrade package, atau validasi lewat generator yang memakai
validator yang sama). Tidak ada nomor versi yang dikarang: yang tertulis adalah "the release
published after 5.5.5 onwards", sesuai instruksi phase.

Skenario D pada harness memakai stderr kegagalan validasi sungguhan dan membuktikan cabang lama
tetap yang menangani, jadi pesan upgrade tidak akan muncul untuk payload cacat.

### 4.5 Uji CLI live — perilaku force dan non-force

Masih di direktori temporer yang sama, kali ini jalur generate. Seluruh run non-force dijalankan
dengan stdin ditutup (`< /dev/null`) untuk memastikan tidak ada yang menunggu input.

| Run | Argumen (bentuk yang dibangun tool) | Hasil |
|---|---|---|
| E | `--database=postgres --force=true` pada direktori bersih | `OK Operation completed`, exit 0, 5 file terbentuk |
| F | `--database=postgres` (force=false) pada modul yang sudah ada | `Error: Dashboard module already exists at '...\src\modules\x\dash-y.js'. Pass options.force=true to overwrite.`, exit 1 |
| G | `--database=mysql` (force=false) pada project terdaftar postgres | `Project "x" is already registered with database type "postgres".` / `Cannot change to "mysql" without --force.`, exit 1 |
| H | `--database=mysql --force=true` pada project terdaftar postgres | `OK Operation completed`, exit 0, registry berubah menjadi `"database": "mysql"` |

Run F dan G kembali seketika, tanpa satu pun baris pertanyaan `(y/N)`, dan tidak menulis apa pun.
Keduanya adalah bukti lapangan kesimpulan GATE section 4.1: `force=false` aman dipakai dari
konteks non-TTY dan tidak akan menggantung panggilan sampai timeout.

Run H membuktikan temuan phase 02d section 7 butir 3 secara langsung: dengan `force=true`,
`.restforge/projects.json` berpindah dari `postgres` ke `mysql` tanpa penolakan maupun peringatan.
Fakta itulah yang kini tertulis pada deskripsi tool dan pada deskripsi parameter `force`, plus
saran memakai `force=false` bila tipe database terdaftar tidak boleh berubah.

Direktori uji dihapus setelah pengujian.

### 4.6 Status git sebelum dan sesudah commit

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/mcp-server status --porcelain      # sebelum stage
 M src/tools/codegen/create-dashboard.ts
 M src/tools/codegen/validate-dashboard-payload.ts
 M src/tools/codegen/validate-payload.ts
?? docs/

$ git -C packages/mcp-server diff --cached --name-only
src/tools/codegen/create-dashboard.ts
src/tools/codegen/validate-dashboard-payload.ts
src/tools/codegen/validate-payload.ts

$ git -C packages/mcp-server status --porcelain      # sesudah commit
?? docs/
```

Hanya tiga file scope yang di-stage; `docs/` tetap untracked. Commit
`1ecc27a50060f0b291ba3a8fe447df8c19553c1e` diverifikasi tidak memuat trailer `Co-Authored-By`
(`git log -1 --format=full | grep -i co-authored` tidak menemukan apa pun). Repo
`packages/platform`, `packages/designer`, dan `restforge-handbook` tidak disentuh.

## 5. Keputusan Penting

1. **Pre-flight meniru daftar kandidat CLI, bukan menebak satu path.** Sebelumnya pre-flight
   memeriksa `<cwd>/payload/<payload>.json` sementara CLI memeriksa nama apa adanya di beberapa
   lokasi. Ketidakcocokan itulah yang membuat tool lolos pre-flight lalu tetap gagal di CLI.
   Sekarang keduanya memeriksa `<cwd>/payload/<payload>` lalu `<cwd>/<payload>`, jadi pre-flight
   tidak bisa menerima sesuatu yang kemudian ditolak CLI. Dua kandidat lain milik CLI
   (`ConfigReader.getWorkingDirectory()` dan `rootDir` relatif `__dirname`) sengaja tidak ditiru:
   pada pemanggilan MCP, `process.cwd()` subprocess memang `projectCwd`, dan kandidat `rootDir`
   menunjuk ke dalam package platform yang bukan urusan tool ini.

2. **Petunjuk ekstensi diberikan, bukan ekstensi ditambahkan diam-diam.** Godaan yang jelas adalah
   membuat tool menambahkan `.json` sendiri saat pemanggil lupa. Itu justru mengembalikan
   normalisasi yang menjadi akar issue-45, hanya dengan arah terbalik, dan membuat nilai yang
   dikirim ke CLI berbeda dari nilai yang diminta pemanggil. Yang dipilih: argumen tetap utuh, dan
   ketika file tidak ditemukan padahal `<payload>.json` ada, respons pre-flight menyebutkan hal itu
   secara eksplisit beserta nilai yang benar untuk dicoba ulang. Pemanggil memperbaiki inputnya,
   tool tidak berbohong tentang apa yang dikirimnya.

3. **Helper `resolvePayloadPath` disalin lokal ke dua file dashboard, bukan dijadikan modul
   bersama.** Package ini tidak punya helper payload bersama; setiap tool codegen menuliskan
   sendiri `join(projectCwd, 'payload', `${payload}.json`)`. Menjadikannya modul bersama lalu
   memakainya juga di `create-endpoint.ts`, `create-processor.ts`, atau `create-kafka-consumer.ts`
   akan mengubah kontrak parameter tool-tool itu, yang di luar scope phase ini dan dilarang eksplisit
   oleh prompt. Duplikasi sepuluh baris di dua file dashboard adalah harga yang jauh lebih murah
   daripada perubahan kontrak yang tidak diminta.

4. **Cabang versi lama membaca string pesan, bukan nomor versi.** Alternatifnya adalah membaca
   `package.json` platform di `node_modules` lalu membandingkan versinya dengan ambang tertentu.
   Itu menuntut angka versi yang belum ada (rilis pembawa flag ditentukan saat user merilis) dan
   akan salah begitu nomor itu meleset. Deteksi berdasar jawaban CLI selalu benar apa pun nomor
   rilisnya, dan stringnya sendiri diverifikasi dari run nyata (section 4.4).

5. **`force` default `true`, bukan `false`.** Mengikuti pola phase 02 pada `create-endpoint.ts`:
   default mempertahankan perilaku lama persis, sehingga client MCP yang sudah ada tidak berubah
   hasilnya. Nilai `false` adalah opt-in untuk pemanggil yang memang ingin jalur non-destruktif.

6. **Tidak ada cabang `abortedOnPrompt` untuk dashboard.** Pada `create-endpoint.ts`, cabang itu
   perlu karena CLI keluar dengan exit 0 setelah prompt menerima end-of-input, sehingga kegagalan
   menyamar sebagai sukses. Pada dashboard, konflik menghasilkan exit 1 dan pesan yang jelas, jadi
   cabang error yang sudah ada sudah menanganinya dengan benar. Yang ditambahkan hanya guidance:
   pada `force=false`, teks respons kegagalan menjelaskan bahwa dua pesan konflik tertentu berarti
   tidak ada yang tertulis, lengkap dengan dua pilihan lanjutan.

7. **Deskripsi menyebut `codegen_validate_dashboard_payload` sebagai jalan pemeriksaan tanpa
   tulis.** Deskripsi lama `codegen_create_dashboard` menyatakan "there is no preview mode" tanpa
   menyebut alternatifnya. Setelah phase 02e, alternatif itu ada dan berfungsi, jadi kalimatnya
   dilengkapi. Sebaliknya, deskripsi tool validator tidak lagi berhenti pada klaim "gap closed"
   melainkan menyatakan syarat versinya, karena pada platform lama tool itu memang tidak berfungsi.

## 6. Hal yang Belum Diverifikasi

1. **Pemanggilan nyata dari client MCP.** Seluruh verifikasi sisi MCP memakai harness terhadap
   hasil build, bukan Claude Desktop atau MCP Inspector. Perilaku schema dan pembentukan argumen
   terbukti; rendering deskripsi baru di client belum dilihat.

2. **Rantai `npx restforge` pada platform hasil rilis.** Uji live memakai
   `generators/cli-entry.js` di working tree platform karena `server.js` diblokir anti-tamper dari
   source (didokumentasikan report 02e section 3.3). Jalur `npx restforge` yang sesungguhnya
   dipakai tool baru bisa diuji setelah user melakukan build-and-bump dan rilis. Sampai itu
   terjadi, kombinasi tool baru + platform ter-install tetap menghasilkan cabang "upgrade
   required" pada tool validator, yang memang perilaku yang diinginkan.

3. **`force=false` lewat tool, bukan lewat CLI.** Yang diuji lapangan adalah bentuk argumen yang
   dibangun tool, dijalankan langsung terhadap CLI (section 4.5). Pemanggilan `force=false` melalui
   proses MCP nyata belum dilakukan, karena butuh platform rilis dan client MCP.

4. **Payload dashboard kompleks dan nama payload ber-path pada jalur generate.** Bentuk path
   (`payload/dashboard-x.json`) diuji pada mode validate-only saja (run D section 4.3); pada jalur
   generate hanya bentuk nama file yang diuji. Karena resolusi payload terjadi di titik yang sama
   untuk kedua mode, perbedaan tidak diharapkan, tetapi klaim itu belum diuji.

5. **Regresi tool codegen lain.** Perubahan pada `validate-payload.ts` murni deskripsi dan tidak
   diuji ulang lewat harness; perilakunya tidak disentuh.

## 7. Pertanyaan untuk Orchestrator

1. **Bug yang sama ada di `codegen_create_endpoint`, dan mungkin di dua tool lain.** Temuan baru,
   tidak dikerjakan sesuai strict per-phase. `cli/endpoint/create.js:272` memanggil
   `PayloadValidator.readPayloadFile`, yang memakai `findPayloadFile` yang sama persis dengan jalur
   dashboard, yaitu tanpa penambahan `.json`. Sementara itu `create-endpoint.ts` masih mendeklarasi
   parameternya sebagai "Payload file name without the .json extension" dan mengirim
   `--payload=z` (terekam pada harness report 02b baris 181). Artinya `codegen_create_endpoint`
   berpotensi gagal dengan `Payload file not found` persis seperti gejala issue-45 butir 2.
   `create-processor.ts` dan `create-kafka-consumer.ts` juga meneruskan parameter `payload` apa
   adanya ke CLI, dan resolusi payload masing-masing belum diperiksa. Perlu phase sweep tersendiri?

2. **Nomor versi minimum pada deskripsi tool.** Sesuai instruksi phase, deskripsi menyebut
   "the release published after 5.5.5" tanpa angka pasti. Setelah user merilis versi pembawa flag,
   apakah deskripsi diperbarui menjadi angka konkret pada phase tersendiri, atau dibiarkan dalam
   bentuk relatif ini?

3. **Deteksi versi platform secara programatik.** Saat ini ketidakcocokan versi baru ketahuan
   setelah CLI dipanggil. Bila kelak diinginkan pre-flight versi (membaca `package.json` platform
   di `node_modules` dan membandingkannya), itu perlu ambang versi yang stabil dan berlaku untuk
   lebih dari satu tool. Dijadwalkan atau tidak?

4. **Sinkronisasi handbook.** Kontrak CLI publik `dashboard create` bertambah flag `--validate-only`
   (phase 02e) dan sisi MCP kini mendokumentasikan konvensi payload yang berbeda dari sebelumnya
   (harus ber-ekstensi). Handbook tidak disentuh sesuai aturan repo. Perlu dipastikan phase handbook
   yang digate konfirmasi user mencakup keduanya.

5. **Issue-45 boleh ditutup?** Butir 1 selesai di phase 02e (sisi platform), butir 2 dan 3 selesai
   di phase ini. Yang tersisa dari "Rancangan yang Diusulkan" pada issue itu adalah butir 4, yaitu
   smoke test mcp-server yang menjalankan ketiga tool terhadap project contoh. Package ini belum
   punya infrastruktur test sama sekali, jadi itu pekerjaan tersendiri. Apakah issue ditutup dengan
   catatan, atau ditahan sampai smoke test ada?

---

`d:\workspace\03_projects\restforge-systems\packages\mcp-server\docs\worker-context\fix-mcp-gap-v1\reports\phase-02f-mcp-selaraskan-dashboard-tools.md`
