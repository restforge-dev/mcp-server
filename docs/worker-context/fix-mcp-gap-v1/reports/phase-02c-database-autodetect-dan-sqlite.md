# Report Phase 02c — `--database` Kondisional (Auto-Deteksi Config) + Enum `sqlite`

Campaign: `fix-mcp-gap-v1`. Worker phase 02c. Tanggal: 2026-08-23.
Branch: `campaign/fix-mcp-gap-v1` di `packages/mcp-server` (tidak ada checkout, tidak ada
repo lain disentuh).

Versi rujukan: `@restforgejs/mcp-server` 1.3.0, `@restforgejs/platform` 5.5.5 ter-install di
`smoke-test-home/`.

## 1. Status Checklist

- [x] Butir 1 — `--database` hanya dikirim bila parameter `database` di-set; parameter kosong
      tidak lagi dipaksa `--database=postgres`
- [x] Butir 1 — deskripsi tool dan deskripsi parameter `database` diperbarui menjelaskan urutan
      prioritas (eksplisit > auto-deteksi config > fallback `postgres`)
- [x] Butir 1 — fact string database diperbaiki agar tidak lagi menulis "postgres" saat
      parameter kosong
- [x] Butir 2 — `sqlite` ditambahkan ke enum parameter `database`
- [x] `npm run build` lolos
- [x] Tidak ada script test di package ini (dinyatakan ulang, section 3.2)
- [x] Tidak ada parameter atau perilaku lain yang diubah; tidak ada file lain disentuh
- [x] Tidak ada bump version, tidak ada `npm publish`
- [x] Commit sebelum report, tanpa trailer co-author
- [x] `docs/` tidak di-stage

## 2. File yang Dimodifikasi + Hash Commit

Commit: `c0997ea5dbe1aa466c0de1c7c20d39186ab53650`
Pesan: `fix(mcp): kirim --database hanya bila di-set dan tambah enum sqlite pada codegen_create_endpoint (fix-mcp-gap-v1 phase-02c)`

| File | Perubahan |
|---|---|
| `packages/mcp-server/src/tools/codegen/create-endpoint.ts` | enum `database` + `sqlite`; deskripsi parameter `database` ditulis ulang (urutan prioritas + peringatan jangan di-set tanpa perlu); paragraf baru "Database type is resolved by the CLI" di deskripsi tool; contoh kalimat konfirmasi tidak lagi menyisipkan `{database}`; `const dbType = database ?? 'postgres'` → `dbTypeLabel` (label pelaporan, bukan nilai yang dikirim); push `--database=` menjadi kondisional; guidance sukses tidak lagi menyuruh menyebut database tanpa syarat |

Statistik diff: 1 file, 24 insertion, 12 deletion. Tidak ada file lain yang tersentuh.
`packages/mcp-server/docs/worker-context/` (prompt + report ini) tetap untracked.

Inti perubahan pada pembentukan argumen:

```ts
      const cliArgs = [
        'restforge',
        'endpoint',
        'create',
        `--project=${project}`,
        `--name=${endpoint}`,
        `--payload=${payload}`,
      ];
      // Sent only when explicitly requested, so the CLI's own resolution order stays
      // intact when it is not (see the dbTypeLabel comment above).
      if (database !== undefined) cliArgs.push(`--database=${database}`);
      if (force) cliArgs.push('--force=true');
```

Label pelaporan yang menggantikan `dbType`:

```ts
      const dbTypeLabel =
        database ?? 'not specified (resolved by the CLI: DB_TYPE of the active config, else postgres)';
```

Lima fact string (`Requested database:` pada dua pre-flight, `Database:` pada jalur aborted,
gagal, dan sukses) memakai label ini, jadi tidak ada lagi tempat yang menulis "postgres" padahal
flag tersebut tidak pernah dikirim.

## 3. Hasil Test

### 3.1 Build

```
$ npm run build
> @restforgejs/mcp-server@1.3.0 build
> tsc
```

Lolos tanpa error dan tanpa warning; `tsc` tidak menghasilkan output selain baris script.

### 3.2 Script test

Dinyatakan ulang: **tidak ada script test di package ini.** Isi `scripts` pada
`packages/mcp-server/package.json`:

```json
{
  "build": "tsc",
  "dev": "tsx src/index.ts",
  "start": "node dist/index.js",
  "inspect": "npx @modelcontextprotocol/inspector node dist/index.js"
}
```

Tidak ada `test`, sehingga verifikasi bertumpu pada harness argumen (section 4.1) dan uji CLI
read-only (section 4.3).

## 4. Verifikasi Mandiri

### 4.1 Harness argumen terhadap hasil build

Pola sama dengan section 4.4 report phase 02b: harness men-load **file hasil build**
(`dist/tools/codegen/create-endpoint.js`), memasang stub `McpServer` untuk menangkap
`inputSchema` dan handler, lalu mengganti modul `lib/exec.js` lewat ESM loader hook sehingga
`execProcess` merekam argumen apa adanya tanpa pernah men-spawn CLI. Folder `cwd` palsu berisi
`node_modules/@restforgejs/platform` dan `payload/z.json` kosong dipakai agar kedua pre-flight
lolos. Input tiap skenario di-parse lewat `z.object(inputSchema)` lebih dulu, jadi penerimaan
nilai enum benar-benar diuji schema, bukan diasumsikan.

```
A. no database parameter (behaviour change: flag must be absent)
  parsed.database : undefined
  args            : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--force=true"]
  has --database  : false
  Database fact   : Database: not specified (resolved by the CLI: DB_TYPE of the active config, else postgres)

B. database="sqlite" (new enum member)
  parsed.database : "sqlite"
  args            : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=sqlite","--force=true"]
  has --database  : true
  Database fact   : Database: sqlite

C. database="mysql" (must equal legacy behaviour)
  parsed.database : "mysql"
  args            : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=mysql","--force=true"]
  has --database  : true
  Database fact   : Database: mysql

D. all params, database="oracle", force=false
  parsed.database : "oracle"
  args            : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=oracle","--create-examples=true","--skip-sql-validation=true","--no-audit-migration=false","--skip-schema-check=true","--verbose=true","--config=db.env"]
  has --database  : true
  Database fact   : Database: oracle

PHASE-02b BASELINE (old, no database param) : ["restforge","endpoint","create","--project=x","--name=y","--payload=z","--database=postgres","--force=true"]
A === baseline minus the --database element : true
A is baseline with ONLY that element gone   : true
C === legacy array for database="mysql"     : true
B contains --database=sqlite                : true

enum accepted values : ["postgres=accepted","oracle=accepted","mysql=accepted","sqlite=accepted","mssql=rejected"]
required (io=input)  : ["cwd","project","endpoint","payload"]
```

Empat hal yang dibuktikan:

1. **Panggilan tanpa `database`** tidak memuat elemen `--database=...` sama sekali, dan array
   yang tersisa identik elemen demi elemen dengan baseline phase 02b setelah elemen itu dibuang
   (`A is baseline with ONLY that element gone: true`). Tidak ada elemen lain yang bergeser
   posisi relatif; `--force=true` tetap mengekor tepat sesudah `--payload=z`.
2. **`database="sqlite"`** diterima schema (`sqlite=accepted`) dan muncul sebagai
   `--database=sqlite` di posisi yang sama dengan sebelumnya.
3. **`database="mysql"`** menghasilkan array identik dengan perilaku lama
   (`C === legacy array: true`), jadi pemanggil yang selama ini menyetel `database` tidak
   terpengaruh sama sekali.
4. Nilai di luar enum tetap ditolak (`mssql=rejected`) dan `database` tetap opsional pada mode
   `io: 'input'` yang dipakai SDK (`required` hanya `cwd, project, endpoint, payload`).

### 4.2 Bukti fallback `postgres` tetap terjadi di sisi CLI

`packages/platform/generators/cli/endpoint/create.js:221-243`:

```js
            // Resolusi tipe database:
            //   1. --database eksplisit → dipakai apa adanya (prioritas tertinggi)
            //   2. Auto-deteksi DB_TYPE dari config aktif (--config, atau default
            //      config .restforge/defaults.json) → mengikuti DB_TYPE project
            //   3. Fallback 'postgres' bila tidak ada config yang bisa di-resolve
            let database;
            let databaseSource;
            if (args.database) {
                database = ArgumentValidator.validateDatabaseType(args.database);
                databaseSource = 'flag';
            } else {
                const resolvedCfg = configResolver.resolveConfig(configArg, process.cwd());
                const detected = resolvedCfg
                    ? configResolver.readDatabaseTypeFromConfig(resolvedCfg.path)
                    : null;
                if (detected) {
                    database = detected;
                    databaseSource = resolvedCfg.source === 'default' ? 'config-default' : 'config';
                } else {
                    database = 'postgres';
                    databaseSource = 'fallback';
                }
            }
```

Cabang `else` terakhir (baris 240-241) adalah jaminan yang diminta: bila flag tidak dikirim dan
config tidak bisa di-resolve atau tidak menyebut `DB_TYPE`, CLI memakai `postgres`. Jadi
menghapus pemaksaan `--database=postgres` di sisi MCP tidak membuat tipe database menjadi kosong
atau undefined pada satu pun jalur.

Enum sisi CLI, `packages/platform/generators/lib/validators/argument-validator.js:333`:

```js
    const validTypes = ['postgres', 'oracle', 'mysql', 'sqlite'];
```

Enum MCP kini persis sama isinya dengan daftar ini.

### 4.3 Uji CLI read-only di `smoke-test-home/`

Nilai `sqlite` diterima; kegagalan murni karena payload tidak ada:

```
$ cd smoke-test-home
$ npx restforge endpoint create --project=x --name=y --payload=z.json --database=sqlite --skip-schema-check
Error: Payload file z.json not found in the following locations:
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\payload\z.json
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\z.json
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\payload\z.json
Configuration:
  Project      x
  Endpoint     y
  Database     sqlite

Error: Payload file z.json not found
EXIT=1
```

Baris `Database sqlite` membuktikan nilai lolos validator dan sudah menjadi konfigurasi run;
error tunggalnya adalah payload hilang. Kontrol negatif memperlihatkan bentuk penolakan yang
berbeda bila nilai memang ditolak:

```
$ npx restforge endpoint create --project=x --name=y --payload=z.json --database=mssql --skip-schema-check
Error: Database type 'mssql' is invalid. Valid options: postgres, oracle, mysql, sqlite
```

Jalur tanpa flag (persis yang kini dipakai MCP saat parameter kosong) juga dijalankan:

```
$ npx restforge endpoint create --project=x --name=y --payload=z.json --skip-schema-check
...
Configuration:
  Project      x
  Endpoint     y
  Database     postgres

Error: Payload file z.json not found
```

`smoke-test-home/config/` kosong dan `.restforge/defaults.json` tidak ada (hanya
`.restforge/projects.json`), sehingga run ini menempuh cabang `fallback` pada kutipan section
4.2 dan menghasilkan `postgres`. Ini bukti langsung bahwa perilaku default untuk project tanpa
config sama seperti sebelumnya, sementara project yang punya config kini bisa mengikuti
`DB_TYPE`-nya sendiri.

Tidak ada file yang ditulis oleh ketiga run tersebut (semua berhenti pada validasi payload,
sebelum generator berjalan).

### 4.4 Status git sebelum dan sesudah commit

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
Commit `c0997ea` tidak memuat trailer `Co-Authored-By` (diverifikasi dengan
`git log -1 --format=full`). Repo `packages/platform`, `packages/designer`, dan
`restforge-handbook` tidak disentuh.

## 5. Keputusan Penting

1. **`if (database !== undefined)`, bukan `if (database)`.** Enum tidak punya anggota falsy,
   jadi keduanya setara hari ini, tetapi pengecekan `undefined` menyatakan maksud sebenarnya
   ("parameter tidak di-set") dan konsisten dengan pola flag kondisional phase 02/02b.

2. **`dbType` menjadi `dbTypeLabel`, bukan dihapus.** Lima fact string membutuhkan sesuatu untuk
   dicetak. Menuliskan `postgres` di situ kini salah (flag tidak dikirim, CLI bisa memutuskan
   lain), dan mengosongkannya membuat blok fakta pincang. Label eksplisit
   `not specified (resolved by the CLI: DB_TYPE of the active config, else postgres)` memberi
   asisten informasi yang benar tanpa berbohong soal nilai efektif. Nama variabel sengaja
   berganti agar tidak ada tempat yang keliru menganggapnya sebagai nilai yang dikirim.

3. **Deskripsi parameter memuat instruksi "LEAVE IT UNSET".** Perbaikan mekanis saja tidak cukup:
   selama deskripsi masih berbunyi "Default postgres", model pemanggil cenderung mengisi
   parameter itu dengan tebakan, dan tebakan selalu menang atas config project. Deskripsi baru
   menyebut urutan prioritas sekaligus konsekuensinya bila diisi tanpa perlu.

4. **Contoh kalimat konfirmasi tidak lagi menyisipkan `{database}`.** Dua contoh lama
   mengharuskan asisten menyebut tipe database di kalimat konfirmasi, padahal pada jalur default
   yang baru tipe itu belum diketahui saat konfirmasi dilakukan. Contohnya disederhanakan dan
   ditambah satu baris aturan: sebut tipe database hanya bila pemanggil memang menyetelnya.

5. **Guidance pasca-sukses dibuat bersyarat.** Instruksi lama "Mention the project, endpoint, and
   database used" akan memancing halusinasi tipe database pada jalur auto-deteksi. Versi baru
   membolehkan penyebutan hanya bila nilainya diketahui, yakni dikirim eksplisit atau terbaca
   dari output CLI (CLI mencetak baris `Database: <type>` beserta anotasi `(auto-detected ...)`,
   namun blok itu hanya tampil pada run `verbose=true` karena selain itu output-nya di-mute).

## 6. Hal yang Belum Diverifikasi

1. **Auto-deteksi `DB_TYPE` yang benar-benar berhasil (bukan fallback).** Ketiga run di
   `smoke-test-home/` menempuh cabang `fallback` karena folder itu tidak punya config maupun
   default config. Jalur `databaseSource = 'config'` / `'config-default'` hanya dibuktikan lewat
   pembacaan kode `create.js:231-242`, belum dijalankan pada project yang config-nya menyebut
   `DB_TYPE=mysql` atau `sqlite`. Verifikasi penuh menuntut project berkonfigurasi lengkap dan
   satu generate nyata.
2. **Generate nyata dengan `database="sqlite"`.** Yang terbukti baru "nilai diterima validator
   dan menjadi konfigurasi run". Apakah generator menghasilkan kode sqlite yang benar dari jalur
   MCP belum diuji di phase ini (dan berada di luar dua butir phase).
3. **Dampak pada project yang sudah terdaftar di registry dengan tipe berbeda.** CLI menolak
   mengganti tipe database project existing saat `force=false`. Kombinasi "parameter kosong +
   config menyebut tipe lain dari yang terdaftar" belum diuji.
4. **Sisi client MCP.** Perubahan ini mengubah perilaku default yang dilihat client. Belum ada
   pengujian dengan client MCP nyata (Claude Desktop atau Inspector), hanya harness pada hasil
   build.

## 7. Pertanyaan untuk Orchestrator

1. **Perlukah phase penutup menjalankan satu generate nyata pada project ber-config non-postgres?**
   Pertanyaan 4 report phase 02b belum terjawab dan kini bertambah relevan: perubahan phase ini
   justru menyasar jalur auto-deteksi, tetapi jalur itulah satu-satunya yang belum pernah
   dieksekusi (section 6 butir 1). Satu run di playground dengan `config/db-connection.env`
   ber-`DB_TYPE=mysql` akan menutup celah tersebut, sejalan dengan kebiasaan validasi lapangan
   campaign sebelumnya.

2. **Perubahan perilaku default ini perlu dicatat di mana selain kode?** Sebelum ini, client yang
   tidak menyetel `database` selalu mendapat postgres; sesudah ini hasilnya mengikuti config
   project. Ini breaking change perilaku (bukan breaking change kontrak: schema tetap
   backward-compatible). Perlukah masuk CHANGELOG `packages/mcp-server`, atau ditangani
   sekaligus pada issue-48/49 (skills/handbook)?

3. **Apakah tool MCP lain punya pemaksaan default yang sama?** Phase ini hanya menyentuh
   `create-endpoint.ts` sesuai kontrak. Tool codegen lain yang juga menerima `database` atau
   `config` berpotensi punya pola `?? 'postgres'` yang serupa dan mematikan auto-deteksi CLI.
   Perlu di-sweep di phase terpisah? (Temuan potensial, TIDAK diperiksa di phase ini.)

4. **Konfirmasi ulang pertanyaan 3 report phase 02b (`createDemo` vs `createExamples`)** masih
   terbuka dan memengaruhi apa yang ditulis pada skills/handbook. Tidak ada yang berubah di
   phase ini terkait itu.

---

`d:\workspace\03_projects\restforge-systems\packages\mcp-server\docs\worker-context\fix-mcp-gap-v1\reports\phase-02c-database-autodetect-dan-sqlite.md`
