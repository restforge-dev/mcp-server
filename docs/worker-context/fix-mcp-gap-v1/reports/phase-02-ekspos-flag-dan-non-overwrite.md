# Report Phase 02 — Ekspos Flag yang Hilang + Jalur Non-Overwrite `codegen_create_endpoint`

Campaign: `fix-mcp-gap-v1`. Worker phase 02. Tanggal: 2026-08-22.
Branch: `campaign/fix-mcp-gap-v1` di `packages/mcp-server` (tidak ada checkout, tidak ada repo lain disentuh).

Versi rujukan: `@restforgejs/mcp-server` 1.3.0, `@restforgejs/platform` 5.5.5 (source dan
instalasi di `smoke-test-home/` identik, sesuai catatan phase 00).

## 1. Status Checklist

- [x] Butir 1 — `codegen/generate-payload.ts`: parameter `output`, `schemaPath`, `detail`
- [x] Butir 2 — `setup/validate-config.ts`: parameter `autoCreateDb`
- [x] Butir 3 — `codegen/create-endpoint.ts`: parameter `skipSchemaCheck`, `verbose`, `force` (default `true`), jalur non-overwrite di-wire, deskripsi diperbarui
- [~] Butir 4 — `codegen/dbschema-init.ts`: parameter `force` **tidak diekspos**. Verb `schema init` pada platform 5.5.5 tidak punya flag `--force` di contract-nya, jadi mengirim flag itu justru merusak tool. Yang dikerjakan: deskripsi tool menjelaskan ketiadaan overwrite dan menunjuk jalur yang benar. Detail bukti di section 5, keputusan 2.
- [x] Butir 5 — Peringatan destruktif pada empat tool ber-hardcode: diperiksa satu per satu, **keempatnya sudah memuat peringatan** sehingga tidak ada perubahan (aturan "jangan duplikasi"). Bukti kutipan di section 4.4.
- [x] `npm run build` lolos
- [x] Commit sebelum report, tanpa trailer co-author
- [x] `docs/` tidak di-stage

## 2. File yang Dimodifikasi + Hash Commit

Commit: `cca21efb1226dc22754d25ff60e5b120ba6e5624`
Pesan: `feat(mcp): ekspos flag CLI yang hilang + jalur non-overwrite endpoint create (fix-mcp-gap-v1 phase-02)`

| File | Perubahan |
|---|---|
| `packages/mcp-server/src/tools/codegen/generate-payload.ts` | +3 parameter opsional (`output`, `schemaPath`, `detail`), argumen CLI kondisional, labeled fact tambahan di branch sukses, penjelasan semantik tiap flag di deskripsi |
| `packages/mcp-server/src/tools/setup/validate-config.ts` | +1 parameter opsional (`autoCreateDb`), argumen CLI kondisional bentuk bare flag, deskripsi sifat write + kebutuhan re-run, guidance baca output saat database belum ada |
| `packages/mcp-server/src/tools/codegen/create-endpoint.ts` | +3 parameter (`skipSchemaCheck`, `verbose`, `force` default `true`), `--force=true` tidak lagi hardcode, `stdin: 'ignore'` khusus jalur non-force, branch baru "aborted, nothing generated", deskripsi destruktif-by-default + cara mendapat jalur non-overwrite |
| `packages/mcp-server/src/lib/exec.ts` | Opsi `stdin` opsional (`'ignore' \| 'inherit' \| 'pipe'`); tanpa opsi ini perilaku sebelumnya tidak berubah sama sekali |
| `packages/mcp-server/src/tools/codegen/dbschema-init.ts` | Deskripsi: menyatakan verb ini tidak punya jalur overwrite dan menunjuk `codegen_dbschema_template` (generate + force) sebagai jalur yang benar |

`packages/mcp-server/docs/worker-context/` (prompt + report ini) tetap untracked, tidak di-stage.

## 3. Hasil Test

### 3.1 Build

```
$ npm run build          # di packages/mcp-server
> @restforgejs/mcp-server@1.3.0 build
> tsc
```

Lolos tanpa error maupun warning.

### 3.2 Script test

Tidak ada script test di package ini. `package.json` hanya memuat `build`, `dev`, `start`,
dan `inspect` — tidak ada key `test`. Temuan phase 01 terkonfirmasi ulang; tidak ada suite
yang bisa dijalankan untuk phase ini.

### 3.3 Uji CLI read-only di `smoke-test-home/`

Ketiga command help dijalankan pada platform 5.5.5 ter-install.

`npx restforge payload generate --help` — ketiga flag baru terdaftar:

```
Optional Flags:
  --config <string>        Database config file (.env). Fallback to `.restforge/defaults.json` ...
  --output <string>        Output directory for generated payload files (default: payload/)
  --schema-path <string>   SDF location (file or folder) for table metadata (default: `schema` folder) ...
  --detail <string>        Detail table name for master-detail generation ...
```

`npx restforge endpoint create --help` — `--skip-schema-check`, `--verbose`, dan `--force`
(default `false`) terdaftar:

```
Optional Flags:
  --database <string>     Database type (postgres|mysql|oracle|sqlite). Default: postgres (default: null)
  --config <string>       Database config file (.env) for payload-vs-database schema validation ...
  --skip-schema-check     Skip database schema validation (escape hatch for offline DB or maintenance) ...
  --force                 Overwrite existing files in the output directory (default: false)
  --create-examples       Generate example files (curl, Postman, Insomnia) (default: true)
  --skip-sql-validation   Skip SQL keyword validation (default: false)
  --no-audit-migration    Skip audit table migration execution ...
  --verbose               Show verbose output for debugging (default: false)
```

`npx restforge schema init --help` — **hanya satu flag**, tidak ada `--force`:

```
Usage:
  npx restforge schema init --schema-path=<STRING>

Required Flags:
  --schema-path <string>   Path to the schema file to create (e.g., schema/users.js)
```

Tambahan (di luar tiga yang diminta, untuk butir 2): `npx restforge validate --help`
mencantumkan `--auto-create-db` sebagai bare flag.

## 4. Verifikasi Mandiri

### 4.1 Bukti backward-compatible `create-endpoint`

Sebelum phase ini array argumen dibentuk seperti ini:

```ts
const cliArgs = ['restforge','endpoint','create',
  `--project=${project}`, `--name=${endpoint}`, `--payload=${payload}`,
  `--database=${dbType}`, '--force=true'];
if (createDemo !== undefined) cliArgs.push(`--create-demo=${createDemo}`);
if (skipSqlValidation !== undefined) cliArgs.push(`--skip-sql-validation=${skipSqlValidation}`);
if (noAuditMigration !== undefined) cliArgs.push(`--no-audit-migration=${noAuditMigration}`);
```

Sesudah phase ini, elemen ke-8 menjadi kondisional dan dua push baru ditambahkan di akhir:

```ts
if (force) cliArgs.push('--force=true');
...tiga push lama, urutan tidak berubah...
if (skipSchemaCheck !== undefined) cliArgs.push(`--skip-schema-check=${skipSchemaCheck}`);
if (verbose !== undefined) cliArgs.push(`--verbose=${verbose}`);
```

`force` dideklarasikan `z.boolean().default(true)`, sehingga panggilan tanpa parameter baru
menghasilkan `force === true` dan `--force=true` tetap berada pada posisi yang sama seperti
sebelumnya; dua push baru tidak jalan karena kedua parameter `undefined`. Array yang
dihasilkan identik elemen demi elemen. Opsi eksekusi juga identik: `stdin` hanya
disisipkan pada cabang `force === false` (`...(force ? {} : { stdin: 'ignore' })`).

Semantik `.default(true)` dan dampaknya ke JSON Schema diverifikasi langsung dengan zod
versi yang dipakai package ini:

```
parse({})            = {"force":true}
parse({force:false}) = {"force":false}
jsonschema required  : undefined      // force TIDAK menjadi field wajib
```

Jadi client MCP lama yang tidak mengirim `force` tetap valid dan tetap mendapat perilaku
lama. Pola yang sama berlaku untuk `generate-payload` (tiga flag hanya di-push bila
`!== undefined`) dan `validate-config` (`--auto-create-db` hanya di-push bila bernilai
`true`).

### 4.2 Bukti temuan readline dan dasar keputusan wiring `force=false`

Baris yang mendasari keputusan:

`packages/platform/generators/cli/endpoint/create.js:363-367` — jalur prompt hanya
dimasuki saat `--force` tidak aktif:

```js
let effectiveForce = force;
if (!force) {
    const shouldContinue = await ConflictChecker.handleModuleConflicts(project, endpoint, payload);
    if (!shouldContinue) return;
}
```

`packages/platform/generators/lib/utils/conflict-checker.js:140-147` — prompt hanya muncul
bila memang ada konflik; tanpa konflik fungsi langsung `return true`:

```js
const conflicts = this.detectModuleConflicts(moduleName, endpointName, payload);
if (!conflicts.hasConflicts) { ... return true; }
return await this.handleConflicts(moduleName, endpointName, conflicts);
```

`packages/platform/generators/lib/utils/conflict-checker.js:556-583` — prompt-nya readline
di atas `process.stdin`, dan seluruh lanjutan alur berada di dalam callback `rl.question`:

```js
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
return new Promise((resolve) => {
  ...
  rl.question(question, (answer) => { rl.close(); ... resolve(shouldProceed); });
});
```

`packages/mcp-server/src/lib/exec.ts:38,45-51` — sebelum phase ini `execProcess` tidak
pernah menyetel `stdin`, sehingga memakai default execa 9.6.1:

```ts
const { cwd = process.cwd(), timeout = 60_000, env, stripFinalNewline = true } = options;
const result = await execa(command, args, { cwd, timeout, reject: false, stripFinalNewline, ... });
```

Perilaku default itu diuji langsung, bukan disimpulkan dari dokumentasi. Harness memanggil
`ConflictChecker.handleConflicts` **milik platform 5.5.5 yang ter-install di
`smoke-test-home/`** dari sebuah child process, dijalankan lewat execa dengan dua konfigurasi
stdin (stdin parent sendiri sudah diarahkan ke `/dev/null` agar tidak ada TTY yang menolong):

```
=== default-stdin | ms= 6039 | exitCode= undefined | timedOut= true
CONFLICTS DETECTED for orders
...
Do you want to proceed and overwrite existing files? (y/N):

=== stdin-ignore  | ms= 90   | exitCode= 0        | timedOut= false
CONFLICTS DETECTED for orders
...
Do you want to proceed and overwrite existing files? (y/N):
```

Tiga hal yang dibuktikan uji ini:

1. Default execa **menggantung**: pipe stdin dibiarkan terbuka tanpa pernah di-end, prompt
   menunggu selamanya, dan panggilan baru berakhir saat timeout (di tool nyata: 120 detik).
   Ini membenarkan alasan historis hardcode `--force=true`.
2. `stdin: 'ignore'` membuat prompt langsung menerima EOF: proses selesai dalam 90 ms.
3. Setelah EOF, baris `RESOLVED_WITH=` dan `PROMISE_SETTLED` pada harness **tidak pernah
   tercetak**, artinya callback `rl.question` tidak pernah dipanggil, promise `askUserConfirmation`
   tidak pernah resolve, dan seluruh kode setelahnya (yaitu pembuatan archive dan generator)
   tidak pernah dieksekusi. Proses berakhir wajar dengan exit code 0 karena event loop kosong.

Konsekuensi desain yang diambil: jalur `force=false` **aman di-wire** (tidak bisa hang, tidak
menulis apa pun saat konflik), tetapi exit code-nya 0 sehingga tanpa penanganan khusus tool
akan salah melaporkan "berhasil dibuat". Karena itu ditambahkan cabang deteksi sebelum branch
sukses:

```ts
const abortedOnPrompt =
  !force && result.success &&
  result.stdout.includes('CONFLICTS DETECTED') &&
  result.stdout.includes('(y/N)');
```

Kedua penanda diambil dari output nyata di atas (`conflict-checker.js:435` dan `:578-580`).
Hasilnya dilaporkan sebagai "Nothing was generated" dengan `isError: false` — bukan kegagalan,
melainkan hasil yang memang diminta.

### 4.3 Bukti butir 4 (`dbschema_init --force`) tidak bisa dijalankan apa adanya

Contract `packages/platform/generators/cli/schema/init.js:38-44` hanya mendeklarasikan satu
flag:

```js
flags: {
    'schema-path': { type: 'string', required: true, description: '...' }
}
```

`generators/lib/arg-parser.js:91-100` bersifat strict: flag di luar contract selalu menjadi
`Unknown flag: --<name>` dan `cli-entry.js` mengembalikan exit 2 sebelum handler jalan
(mekanisme yang sama yang dibuktikan phase 00 untuk `--validate-only` dan `--path`). Output
`npx restforge schema init --help` di section 3.3 mengonfirmasi hal yang sama dari sisi CLI
nyata. Handbook pun sejalan: `restforge-handbook/commands/restforge-backend/schema/init.md:38`
menyatakan file tujuan yang sudah ada akan error dan mengarahkan ke `schema template --force`
bila perlu overwrite.

Kesimpulan: klaim issue-47 bahwa `--force` adalah "flag CLI terdokumentasi yang tidak
diekspos" untuk `codegen_dbschema_init` **terbantah**. Mengekspos parameter itu justru akan
membuat setiap pemakaiannya gagal dengan exit 2.

### 4.4 Bukti butir 5 (peringatan destruktif sudah ada di keempat tool)

| Tool | Kalimat yang sudah ada |
|---|---|
| `key/revoke.ts:21,23` | "'--yes' is always passed to skip the confirmation prompt — so this tool revokes immediately without further confirmation." + "IMPORTANT — this is destructive: it removes the key from the named .env file. Confirm the file and intent with the user BEFORE calling this tool ..." |
| `project/delete.ts:21,23` | "'--yes' is always passed to skip the confirmation prompt (the prompt cannot be answered in this non-interactive context), so the deletion happens immediately." + "IMPORTANT — this is highly destructive and not reversible here ... There is NO additional in-tool confirmation." |
| `designer/auth-remove.ts:29-31` | "IMPORTANT — confirmation behaviour: the CLI normally prompts for y/N confirmation before removing. In this non-interactive MCP context, --force is ALWAYS passed to skip the prompt. ALWAYS confirm with the user ..." |
| `codegen/create-dashboard.ts:25` | "This tool is DESTRUCTIVE: ... Internally the tool always passes '--force=true' to the CLI to bypass the CLI's interactive y/N readline prompt (which would deadlock in a no-TTY subprocess)." |

Keempatnya juga sudah menyetel `destructiveHint: true`. Sesuai instruksi "hanya bila belum
ada; jangan duplikasi", tidak ada perubahan pada keempat file tersebut.

### 4.5 Status git sebelum commit

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/mcp-server status --porcelain      # sebelum commit
 M src/lib/exec.ts
 M src/tools/codegen/create-endpoint.ts
 M src/tools/codegen/dbschema-init.ts
 M src/tools/codegen/generate-payload.ts
 M src/tools/setup/validate-config.ts
?? docs/

$ git -C packages/mcp-server status --porcelain      # sesudah commit
?? docs/
```

Hanya lima file scope phase ini yang di-stage. `docs/` tetap untracked. `dist/` tidak muncul
karena memang tidak di-track. Commit `cca21ef` tidak memuat trailer `Co-Authored-By`. Repo
`packages/platform` dan `packages/designer` tidak disentuh.

## 5. Keputusan Penting

1. **Jalur `force=false` di-wire, dengan stdin ditutup.** Uji terhadap kode platform nyata
   membuktikan jalur non-force tidak dapat hang selama stdin subprocess ditutup, dan tidak
   menulis apa pun saat konflik terdeteksi. `stdin: 'ignore'` sengaja **hanya** dipasang di
   cabang non-force agar jalur default byte-identik dengan sebelumnya.
2. **Butir 4 sengaja tidak dijalankan apa adanya.** `schema init` tidak punya `--force` di
   platform 5.5.5 (contract, help CLI, dan handbook sepakat). Sesuai prinsip "jangan
   memaksakan wiring yang tidak aman", parameter tidak diekspos; sebagai gantinya deskripsi
   tool menyatakan ketiadaan jalur overwrite dan menunjuk `codegen_dbschema_template`
   (generate + force) sebagai jalur yang benar. Bila orchestrator menginginkan `--force`
   benar-benar ada, itu perubahan platform, bukan perubahan MCP.
3. **`--auto-create-db` dikirim sebagai bare flag, bukan `=value`.** Parser runtime
   `server.js:503` mencocokkan token secara persis (`arg === '--auto-create-db'`), berbeda
   dari parser generator yang menerima bentuk `=true`. Bentuk `=true` akan diabaikan diam-diam.
4. **`readOnlyHint` pada `setup_validate_config` dipertahankan `true`,** dengan komentar
   bahwa `autoCreateDb=true` adalah jalur write opt-in. Alternatifnya (menurunkan menjadi
   `false`) akan membuat client MCP memperlakukan setiap validasi biasa sebagai operasi
   berisiko, padahal jalur default tetap read-only. Sifat write jalur opsional dijelaskan
   eksplisit di deskripsi tool dan di deskripsi parameter.
5. **Cabang "aborted" memakai `isError: false`.** Hasil "module sudah ada, tidak ada yang
   ditulis" adalah jawaban yang valid atas permintaan non-overwrite, bukan kegagalan.
   Menandainya error akan mendorong agent melakukan retry yang justru destruktif.
6. **Opsi `stdin` ditambahkan di `lib/exec.ts`, bukan di dalam file tool.** Spesifikasi phase
   menyebut "semua di `src/tools/`", tetapi prasyarat wajibnya sendiri menunjuk `lib/exec.ts`
   sebagai tempat konfigurasi stdin. Perubahan dibuat aditif dan opsional sehingga seluruh
   pemanggil lain tidak berubah perilakunya.

## 6. Hal yang Belum Diverifikasi

1. **Eksekusi end-to-end `codegen_create_endpoint` dengan `force=false` terhadap module yang
   benar-benar ada.** Yang diuji adalah komponen penentunya (`ConflictChecker.handleConflicts`
   milik platform 5.5.5 di bawah execa dengan stdin ditutup), bukan satu run penuh
   `endpoint create`. `smoke-test-home/` tidak punya module maupun payload yang bisa dipakai
   tanpa lebih dulu men-generate module baru, dan itu operasi mutasi yang di luar izin phase ini.
2. **Perilaku `force=false` saat konflik hanya berupa metadata/system conflict, bukan file.**
   `detectModuleConflicts` menghasilkan tiga kategori konflik; hanya kategori file yang
   terlihat pada uji. Bila ada kombinasi yang mencetak ringkasan tanpa string `CONFLICTS
   DETECTED` atau tanpa `(y/N)`, deteksi `abortedOnPrompt` akan meleset dan hasilnya kembali
   dilaporkan sebagai sukses. Pembacaan `conflict-checker.js:420-426` menunjukkan kedua string
   selalu tercetak untuk setiap `hasConflicts === true`, tetapi ini belum diuji per kategori.
3. **Efek nyata `--output`, `--schema-path`, `--detail`, dan `--auto-create-db`.** Hanya
   keberadaan flag di contract dan help CLI yang diverifikasi; eksekusinya butuh database
   hidup dan bersifat mutasi.
4. **Dampak ke skills/dokumentasi.** Parameter baru belum tercermin di `restforge-skills`
   maupun handbook. Itu milik phase lain (issue-48/49).

## 7. Pertanyaan untuk Orchestrator

1. **Bug `--create-demo` di `codegen_create_endpoint` (temuan sampingan, TIDAK diperbaiki).**
   Tool mengirim `--create-demo=<bool>`, sedangkan contract CLI menamai flag itu
   `--create-examples` (lihat help di section 3.3 dan `endpoint/create.js:172-177`). Karena
   parser bersifat strict, setiap panggilan yang menyertakan parameter `createDemo` **pasti
   gagal** dengan `Unknown flag: --create-demo` exit 2. Parameter itu praktis rusak sejak
   awal. Perbaikannya satu baris (kirim `--create-examples=...` sambil mempertahankan nama
   parameter `createDemo`), tetapi berada di luar daftar perubahan phase 02 dan mengubah
   perilaku parameter existing dari "selalu gagal" menjadi "berfungsi", sehingga sengaja tidak
   dikerjakan. Apakah dimasukkan ke phase lanjutan campaign ini atau dibuka sebagai issue baru?
2. **`--config` tidak pernah dikirim `codegen_create_endpoint`.** Contract menyatakan `--config`
   wajib kecuali `--skip-schema-check` aktif atau ada default config via `config set-default`.
   Dengan `skipSchemaCheck` kini tersedia, apakah perlu juga mengekspos `config` agar agent
   bisa menunjuk file config secara eksplisit, atau ketergantungan pada `.restforge/defaults.json`
   memang keputusan desain yang dipertahankan?
3. **Butir 4 issue-47 (`dbschema_init --force`).** Apakah cukup ditutup sebagai "klaim
   terbantah, dicatat di deskripsi tool" (yang dikerjakan phase ini), atau orchestrator ingin
   membuka issue platform untuk menambahkan `--force` pada verb `schema init` agar sejajar
   dengan `schema template`?
4. **Kriteria selesai issue-47 menyebut "endpoint create via MCP punya jalur yang tidak
   menimpa module existing".** Jalur itu kini ada lewat `force=false`, tetapi bentuknya adalah
   "berhenti saat konflik", bukan "preview daftar perubahan" seperti
   `codegen_validate_dashboard_payload`. Apakah ini dianggap memenuhi kriteria, atau masih
   diinginkan tool validate-only terpisah untuk endpoint (yang berarti perubahan platform,
   karena CLI tidak punya mode validate-only untuk verb ini)?
5. **Verifikasi lapangan.** Sesuai kebiasaan campaign sebelumnya, apakah phase penutup perlu
   menjalankan `force=false` terhadap module nyata di sebuah playground (mutasi terkendali)
   sebelum issue-47 ditutup?
</content>
