# Report Phase 02b — Fix Bug `--create-demo` + Ekspos `config` pada `codegen_create_endpoint`

Campaign: `fix-mcp-gap-v1`. Worker phase 02b. Tanggal: 2026-08-22.
Branch: `campaign/fix-mcp-gap-v1` di `packages/mcp-server` (tidak ada checkout, tidak ada
repo lain disentuh).

Versi rujukan: `@restforgejs/mcp-server` 1.3.0, `@restforgejs/platform` 5.5.5 ter-install di
`smoke-test-home/`.

## 1. Status Checklist

- [x] Butir 1 — flag `--create-demo` diganti menjadi `--create-examples`; nama parameter MCP
      `createDemo` dipertahankan; deskripsi parameter diperbarui menyebut flag CLI sebenarnya
- [x] Butir 2 — parameter `config` (`--config=<file>`) diekspos, opsional, dikirim hanya bila
      di-set
- [x] `npm run build` lolos
- [x] Tidak ada script test di package ini (dinyatakan ulang, section 3.2)
- [x] Urutan argumen existing tidak berubah; flag baru memakai pola kondisional phase 02
- [x] Tidak ada perubahan lain di file ini maupun file lain; tidak ada bump version, tidak ada
      `npm publish`
- [x] Commit sebelum report, tanpa trailer co-author
- [x] `docs/` tidak di-stage

## 2. File yang Dimodifikasi + Hash Commit

Commit: `9e31e0e7236ef1dbdf6a30dfdf695125165afc06`
Pesan: `fix(mcp): kirim --create-examples dan ekspos parameter config pada codegen_create_endpoint (fix-mcp-gap-v1 phase-02b)`

| File | Perubahan |
|---|---|
| `packages/mcp-server/src/tools/codegen/create-endpoint.ts` | `--create-demo=` → `--create-examples=` (+ komentar alasan nama parameter dipertahankan); deskripsi `createDemo` diperbarui; parameter `config` baru (string opsional) di `inputSchema`, di destructuring handler, dan sebagai push kondisional terakhir |

Statistik diff: 1 file, 11 insertion, 2 deletion. Tidak ada file lain yang tersentuh.
`packages/mcp-server/docs/worker-context/` (prompt + report ini) tetap untracked.

Isi perubahan pada pembentukan argumen:

```ts
// The CLI names this flag '--create-examples'; the MCP parameter keeps the older
// name 'createDemo' for client compatibility.
if (createDemo !== undefined) cliArgs.push(`--create-examples=${createDemo}`);
...
if (verbose !== undefined) cliArgs.push(`--verbose=${verbose}`);
if (config !== undefined) cliArgs.push(`--config=${config}`);
```

## 3. Hasil Test

### 3.1 Build

```
$ npm run build          # di packages/mcp-server
> @restforgejs/mcp-server@1.3.0 build
> tsc
```

Lolos tanpa error maupun warning.

### 3.2 Script test

Tidak ada script test di package ini. `package.json` hanya memuat empat script:

```json
"scripts": {
  "build": "tsc",
  "dev": "tsx src/index.ts",
  "start": "node dist/index.js",
  "inspect": "npx @modelcontextprotocol/inspector node dist/index.js"
}
```

Tidak ada key `test`, sehingga tidak ada suite yang bisa dijalankan. Temuan phase 01 dan
phase 02 terkonfirmasi ulang.

## 4. Verifikasi Mandiri

### 4.1 Kutipan contract CLI (bukti nama flag dan tipe)

`packages/platform/generators/cli/endpoint/create.js:172-177` — nama flag adalah
`create-examples`, bertipe boolean, default `true`:

```js
'create-examples': {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Generate example files (curl, Postman, Insomnia)'
},
```

`packages/platform/generators/cli/endpoint/create.js:154-159` — `config` bertipe string,
opsional, default `null`:

```js
config: {
    type: 'string',
    required: false,
    default: null,
    description: 'Database config file (.env) for payload-vs-database schema validation. Required unless `--skip-schema-check` is active or a default config is set via `config set-default`. Fallback to `.restforge/defaults.json` if not explicitly provided'
},
```

Handler membacanya di `create.js:212` (`args['create-examples']`) dan `create.js:217-219`
(`args.config`, di-trim dan dijadikan `null` bila string kosong).

### 4.2 Sisa kemunculan `create-demo` di source

```
$ grep -n "create-demo\|createDemo" packages/mcp-server/src/
src/tools/codegen/create-endpoint.ts:99:        createDemo: z
src/tools/codegen/create-endpoint.ts:142:      createDemo,
src/tools/codegen/create-endpoint.ts:221:      // name 'createDemo' for client compatibility.
src/tools/codegen/create-endpoint.ts:222:      if (createDemo !== undefined) cliArgs.push(`--create-examples=${createDemo}`);
src/tools/codegen/create-endpoint.ts:341:- examples/${project}/${endpoint}/* (if createDemo=true)
```

Kelima kemunculan adalah nama parameter MCP `createDemo` (deklarasi schema, destructuring,
komentar, pemakaian, dan penyebutan di teks hasil). String flag `--create-demo` sudah tidak ada
lagi di seluruh `src/`.

### 4.3 Uji CLI read-only di `smoke-test-home/`

Perintah yang diminta phase, dijalankan pada platform 5.5.5 ter-install:

```
$ npx restforge endpoint create --project=x --name=y --payload=z.json --create-examples=false --skip-schema-check
Error: Payload file z.json not found in the following locations:
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\payload\z.json
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\z.json
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\payload\z.json
Configuration:
  Project      x
  Endpoint     y
  Database     postgres

Error: Payload file z.json not found
EXITCODE=1
```

Kegagalannya adalah payload tidak ada (exit 1), bukan `Unknown flag`. Parser menerima
`--create-examples`, dan eksekusi berhenti karena precondition file, sesuai harapan.

Kontrasnya dengan flag lama, dijalankan pada perintah yang persis sama kecuali nama flag:

```
$ npx restforge endpoint create --project=x --name=y --payload=z.json --create-demo=false --skip-schema-check
Invalid usage of endpoint create:
  - Unknown flag: --create-demo
...
EXITCODE_CREATE_DEMO=2
```

Ini membuktikan bug yang dilaporkan phase 02 memang nyata: sebelum perbaikan, setiap panggilan
MCP yang menyertakan `createDemo` pasti berakhir exit 2 tanpa pernah mencapai handler. Blok
`Optional Flags` pada output help itu juga mencantumkan `--create-examples` dan `--config`,
konsisten dengan contract yang dikutip di 4.1.

Flag `--config` diuji terpisah dengan cara yang sama:

```
$ npx restforge endpoint create --project=x --name=y --payload=z.json --config=config/db-connection.env
Error: Payload file z.json not found ...
EXITCODE_CONFIG=1
```

Diterima parser (exit 1 karena payload, bukan exit 2). Ketiga uji bersifat read-only: tidak ada
file yang ditulis karena CLI berhenti di pemeriksaan payload.

### 4.4 Bukti backward-compatible

Argumen tidak diperiksa lewat pembacaan kode saja. Harness men-load **file hasil build**
(`dist/tools/codegen/create-endpoint.js`), memasang stub `McpServer` untuk menangkap
`inputSchema` dan handler, lalu mengganti modul `lib/exec.js` dengan stub lewat ESM loader hook
sehingga `execProcess` merekam argumen persis apa adanya tanpa pernah men-spawn CLI. Folder
`cwd` palsu berisi `node_modules/@restforgejs/platform` dan `payload/z.json` kosong dipakai agar
kedua pre-flight lolos. Hasilnya:

```
A. call without createDemo/config (backward-compat baseline)
  parsed keys : ["cwd","endpoint","force","payload","project"]
  args        : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=postgres","--force=true"]
  opts.stdin  : undefined

B. createDemo=false
  args        : [... ,"--database=postgres","--force=true","--create-examples=false"]

C. config set
  args        : [... ,"--database=postgres","--force=true","--config=config/db-connection.env"]

D. all phase-02 + phase-02b params (force=false)
  args        : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=mysql","--create-examples=true","--skip-sql-validation=true","--no-audit-migration=false","--skip-schema-check=true","--verbose=true","--config=db.env"]
  opts.stdin  : "ignore"

BASELINE (phase 02, no new params) : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=postgres","--force=true"]
IDENTICAL TO A                     : true
```

Empat hal yang dibuktikan:

1. Panggilan tanpa `createDemo` dan tanpa `config` menghasilkan array argumen **identik elemen
   demi elemen** dengan hasil phase 02 (`IDENTICAL TO A: true`), termasuk `--force=true` yang
   tetap berada di posisi ke-8.
2. Tujuh elemen pertama (`restforge endpoint create --project --name --payload --database`)
   tidak bergeser pada satu pun skenario; kedua flag baru selalu muncul sesudahnya.
3. `--config` berada di posisi terakhir dan hanya muncul bila parameter di-set, sesuai pola
   kondisional phase 02.
4. Perilaku `stdin` phase 02 tidak terganggu: `undefined` pada jalur force, `'ignore'` pada
   jalur `force=false`.

Sifat opsional pada JSON Schema diperiksa dengan mode konversi yang benar-benar dipakai SDK.
`node_modules/@modelcontextprotocol/sdk/dist/esm/server/zod-json-schema-compat.js:21-24`
memanggil `z4mini.toJSONSchema(schema, { target, io: opts?.pipeStrategy ?? 'input' })`, jadi
mode-nya `input`:

```
io=input  required : ["cwd","project","endpoint","payload"]
io=output required : ["cwd","project","endpoint","payload","force"]
```

Pada mode `input` yang dipakai SDK, `createDemo`, `config`, maupun `force` tidak menjadi field
wajib. Client MCP lama yang tidak mengirim parameter baru tetap valid dan tetap mendapat
perilaku lama. (Catatan: mode `output` memasukkan `force` ke `required` karena `.default()`
selalu terisi pada tipe keluaran; mode itu tidak dipakai jalur MCP.)

### 4.5 Status git sebelum dan sesudah commit

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/mcp-server status --porcelain      # sebelum commit
 M src/tools/codegen/create-endpoint.ts
?? docs/

$ git -C packages/mcp-server status --porcelain      # sesudah commit
?? docs/
```

Hanya `create-endpoint.ts` yang di-stage, sesuai kontrak phase. `docs/` tetap untracked.
Commit `9e31e0e` tidak memuat trailer `Co-Authored-By` (diverifikasi dengan
`git log -1 --format=full`). Repo `packages/platform`, `packages/designer`, dan
`restforge-handbook` tidak disentuh.

## 5. Keputusan Penting

1. **Nama parameter MCP `createDemo` dipertahankan, hanya string flag yang diperbaiki.**
   Sesuai instruksi phase. Konsekuensinya ada ketidaksesuaian nama yang disengaja antara
   parameter MCP dan flag CLI, sehingga alasannya ditulis sebagai komentar tepat di atas baris
   push agar pembaca berikutnya tidak "merapikan" kembali menjadi `--create-demo`. Deskripsi
   parameter juga menyebut eksplisit bahwa ia memetakan ke `--create-examples`, dan menyebut
   nama artefaknya (example files: curl, Postman, Insomnia) mengikuti istilah contract.

2. **`config` divalidasi `z.string().min(1)`, bukan `z.string()` polos.** Handler CLI
   memperlakukan string kosong atau whitespace sebagai `null` (`create.js:217-219`), jadi
   mengirim `--config=` hanya menambah argumen yang pasti diabaikan. Menolaknya di level schema
   membuat kesalahan client terlihat sebagai validation error, bukan lolos diam-diam.

3. **`config` di-push paling akhir, sesudah `verbose`.** Prompt mewajibkan urutan argumen
   existing tidak berubah, dan pola phase 02 adalah menambahkan flag baru di ujung. Parser
   generator tidak sensitif terhadap urutan flag, sehingga penempatan ini murni soal menjaga
   diff minimal dan byte-identik pada jalur default.

4. **Deskripsi `config` menyebut kondisi kapan parameter itu perlu, bukan sekadar menyalin
   contract.** Contract menyatakan config "required unless `--skip-schema-check` is active or a
   default config is set". Deskripsi diarahkan pada keputusan yang harus diambil agent: set
   parameter ini bila belum ada default config yang tercatat atau bila file config tertentu
   harus dipakai; bila dikosongkan, CLI jatuh ke default yang tercatat.

5. **Deskripsi tool (blok besar) tidak disentuh.** Aturan phase melarang mengubah hal lain di
   file ini. Penjelasan kedua parameter cukup di level deskripsi parameter.

## 6. Hal yang Belum Diverifikasi

1. **Efek nyata `--config` terhadap validasi payload-vs-database.** Yang diverifikasi adalah
   flag diterima parser dan diteruskan apa adanya. Menguji efeknya menuntut database hidup dan
   payload yang valid, dan itu operasi mutasi di luar izin phase ini.

2. **Efek nyata `--create-examples=false`.** Terbukti tidak lagi ditolak parser, tetapi belum
   dibuktikan bahwa folder `examples/<project>/<endpoint>/` benar-benar tidak dibuat, karena
   pembuktian itu menuntut satu run generate penuh (mutasi).

3. **Interaksi `--config` dengan `--database` yang selalu dikirim tool.** Lihat section 7
   butir 1: tool selalu mengirim `--database=<dbType>`, sehingga cabang auto-deteksi database
   dari config di `create.js:228-243` tidak pernah tercapai lewat MCP. Dampaknya belum diuji.

4. **Dampak ke skills dan handbook.** Parameter `config` yang baru dan perbaikan pemetaan
   `createDemo` belum tercermin di `restforge-skills` maupun handbook. Itu milik phase lain
   (issue-48/49).

## 7. Pertanyaan untuk Orchestrator

1. **`--database` selalu dikirim, sehingga auto-deteksi dari config mati (temuan baru, TIDAK
   dikerjakan).** Handler `create.js:226-243` memilih tipe database dengan tiga prioritas:
   `--database` eksplisit, lalu auto-deteksi `DB_TYPE` dari config aktif, lalu fallback
   `postgres`. Tool MCP selalu mengirim `--database=${database ?? 'postgres'}`, jadi prioritas
   pertama selalu menang dan prioritas kedua tidak pernah dievaluasi. Akibatnya, project yang
   config-nya MySQL tetap di-generate sebagai postgres bila client tidak menyetel `database`.
   Perbaikannya berupa satu perubahan kondisional (kirim `--database` hanya bila parameter
   di-set), tetapi itu mengubah perilaku default parameter existing dan berada di luar dua butir
   phase ini, sehingga sengaja tidak dikerjakan. Masuk phase lanjutan atau issue baru?

2. **Parameter `database` pada MCP hanya menerima `postgres|oracle|mysql`, sedangkan contract
   CLI menyebut `postgres|mysql|oracle|sqlite` (temuan baru, TIDAK dikerjakan).** `sqlite`
   hilang dari enum MCP, jadi project sqlite tidak bisa dituju lewat tool ini. Perlu ditambahkan
   di phase lanjutan, atau memang pembatasan yang disengaja?

3. **Konsistensi penamaan `createDemo`.** Nama parameter dipertahankan sesuai instruksi phase.
   Apakah campaign ini berencana melakukan rename menjadi `createExamples` di rilis mayor
   berikutnya (dengan `createDemo` sebagai alias deprecated), atau ketidaksesuaian nama ini
   diterima permanen? Jawabannya menentukan apa yang perlu ditulis di skills/handbook pada
   issue-48/49.

4. **Verifikasi lapangan.** Kedua perbaikan phase ini baru terbukti di level "flag diterima
   parser" dan "argumen terbentuk benar". Apakah phase penutup campaign perlu menjalankan satu
   `endpoint create` nyata dengan `createDemo=false` dan `config` eksplisit di playground
   terkendali sebelum issue-47 ditutup, mengikuti kebiasaan campaign sebelumnya?
