# Report Phase 02d — `--database` Kondisional + Enum `sqlite` pada Dua Tool Dashboard

Campaign: `fix-mcp-gap-v1`. Worker phase 02d. Tanggal: 2026-08-23.
Branch: `campaign/fix-mcp-gap-v1` di `packages/mcp-server` (tanpa checkout, tanpa menyentuh
repo lain).

Versi rujukan: `@restforgejs/mcp-server` 1.3.0, `@restforgejs/platform` 5.5.5 ter-install di
`smoke-test-home/`.

**Ringkasan hasil GATE:** pola phase 02c TIDAK diterapkan. `dashboard create` terbukti tidak
punya auto-deteksi config, hanya default polos `postgres`, sehingga sesuai instruksi GATE
pengiriman `--database` dibiarkan tanpa syarat dan perbaikan dibatasi pada enum plus deskripsi.

## 1. Status Checklist

- [x] GATE dijalankan lebih dulu, sebelum satu pun baris diubah (section 4.1)
- [x] GATE menyimpulkan `dashboard create` TIDAK setara `endpoint create`: tidak ada
      auto-deteksi config, hanya fallback polos
- [x] Konsekuensi GATE dipatuhi: pengiriman `--database` tetap tanpa syarat pada kedua tool,
      pola `if (database !== undefined)` dan `dbTypeLabel` TIDAK dipaksakan
- [x] Enum `database` disamakan dengan daftar CLI (tambah `sqlite`) pada
      `create-dashboard.ts` dan `validate-dashboard-payload.ts`
- [x] Deskripsi parameter `database` kedua tool ditulis ulang sesuai fakta resolusi CLI
- [x] Deskripsi tool `codegen_create_dashboard` diberi paragraf "Database type"
- [x] Fact string tidak diubah, karena `dbType` di kedua tool memang nilai yang benar-benar
      dikirim (justifikasi di section 5 butir 2)
- [x] Mekanisme `--validate-only=true` pada `codegen_validate_dashboard_payload` tidak
      tersentuh (dibuktikan di section 4.2)
- [x] `npm run build` lolos
- [x] Tidak ada script test di package ini (dinyatakan ulang, section 3.2)
- [x] Tidak ada parameter atau perilaku lain yang diubah; tidak ada file lain disentuh
- [x] Tidak ada bump version, tidak ada `npm publish`
- [x] Commit sebelum report, tanpa trailer co-author
- [x] `docs/` tidak di-stage

## 2. File yang Dimodifikasi + Hash Commit

Commit: `434be054044845bd8a35d0a8eb4098c3b7e74e07`
Pesan baris pertama: `fix(mcp): samakan enum database dengan CLI dan perjelas resolusi dialect pada dua tool dashboard (fix-mcp-gap-v1 phase-02d)`

| File | Perubahan |
|---|---|
| `packages/mcp-server/src/tools/codegen/create-dashboard.ts` | enum `database` + `sqlite`; deskripsi parameter `database` ditulis ulang (daftar nilai CLI, sifat default polos, peringatan tidak ada auto-deteksi); paragraf baru "Database type" pada deskripsi tool |
| `packages/mcp-server/src/tools/codegen/validate-dashboard-payload.ts` | enum `database` + `sqlite`; deskripsi parameter `database` ditulis ulang (daftar nilai CLI, sifat default polos, penegasan dialect tidak memengaruhi hasil validasi struktural) |

Statistik diff: 2 file, 6 insertion, 4 deletion. Tidak ada file lain yang tersentuh.
`packages/mcp-server/docs/worker-context/` (prompt + report ini) tetap untracked.

Yang sengaja TIDAK berubah, dan inilah pembeda utama phase ini terhadap phase 02c, adalah blok
pembentukan argumen. Keduanya tetap persis seperti semula:

```ts
      const cliArgs = [
        'restforge',
        'dashboard',
        'create',
        `--project=${project}`,
        `--name=${name}`,
        `--payload=${payload}`,
        `--database=${dbType}`,
        '--force=true',
      ];
```

dan pada tool validator:

```ts
        `--database=${dbType}`,
        '--validate-only=true',
```

`const dbType = database ?? 'postgres';` juga dipertahankan apa adanya di kedua file.

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
`packages/mcp-server/package.json`:

```json
{
  "build": "tsc",
  "dev": "tsx src/index.ts",
  "start": "node dist/index.js",
  "inspect": "npx @modelcontextprotocol/inspector node dist/index.js"
}
```

Verifikasi karena itu bertumpu pada harness argumen (section 4.3) dan uji CLI read-only
(section 4.4).

## 4. Verifikasi Mandiri

### 4.1 GATE — resolusi database pada `dashboard create` (dijalankan sebelum wiring)

`packages/platform/generators/cli/dashboard/create.js:79`, di dalam `handler(args)`:

```js
            const database = args.database || 'postgres';
```

Itulah keseluruhan resolusi database pada handler ini. Tidak ada `configResolver`, tidak ada
`readDatabaseTypeFromConfig`, tidak ada variabel `databaseSource`, dan tidak ada satu pun
`require` yang mengarah ke config resolver di file tersebut. Bandingkan dengan
`packages/platform/generators/cli/endpoint/create.js:221-243` yang dikutip pada report phase
02c: di sana ada tiga tingkat prioritas (flag eksplisit, auto-deteksi `DB_TYPE` dari config
aktif, lalu fallback `postgres`).

**Kesimpulan GATE: `dashboard create` TIDAK setara `endpoint create`.** Cabang auto-deteksi
yang menjadi alasan seluruh perubahan phase 02c tidak ada di sini. Menghapus pemaksaan
`--database=postgres` pada sisi MCP karena itu tidak akan mengaktifkan auto-deteksi apa pun,
melainkan hanya memindahkan default `postgres` yang sama dari MCP ke CLI. Perubahan seperti itu
nol manfaat, sementara ongkosnya nyata: lima titik fact string harus berbohong dengan label
"resolved by the CLI" padahal CLI tidak me-resolve apa pun. Sesuai instruksi GATE pada prompt
phase, pola 02c tidak dipaksakan.

Dua fakta turunan yang juga ditemukan saat GATE:

1. **`--database` bersifat opsional pada kontrak CLI**, jadi tidak ada kewajiban mengirimnya.
   `packages/platform/generators/cli/dashboard/create.js:48-53`:

   ```js
           database: {
               type: 'string',
               required: false,
               default: null,
               description: 'Database type (postgres|mysql|oracle|sqlite). Default: postgres'
           },
   ```

2. **Tidak ada validasi nilai `database` di jalur dashboard.** `dashboard create` sama sekali
   tidak memanggil `ArgumentValidator.validateDatabaseType`. Pencarian di seluruh
   `packages/platform/generators` hanya menemukan satu pemanggil, yaitu
   `cli/endpoint/create.js:229`. Nilai apa pun karena itu lolos ke generator (dibuktikan
   secara empiris di section 4.4). Enum sisi MCP kini menjadi satu-satunya penjaga nilai pada
   jalur dashboard, dan itu memperkuat alasan menyamakannya dengan daftar CLI.

Daftar nilai yang sah, dari `packages/platform/generators/lib/validators/argument-validator.js:333`,
sama dengan yang tertulis pada deskripsi flag dashboard:

```js
    const validTypes = ['postgres', 'oracle', 'mysql', 'sqlite'];
```

Dukungan `sqlite` pada jalur dashboard bukan sekadar klaim deskripsi. Generator modul utama
yang dipanggil handler ini memang punya cabang khusus,
`packages/platform/generators/lib/generators/main-module-generator.js:60-64`:

```js
      if (databaseType === 'sqlite') {
        const sqliteContent = this.generateSqliteModuleContent(moduleName, options);
```

### 4.2 GATE lanjutan — mekanisme `--validate-only` tidak diubah

Prompt phase meminta kepastian bahwa perubahan tidak mengganggu mekanisme validate-only.
Pembacaan kode dilakukan sebelum wiring, dan hasilnya: `codegen_validate_dashboard_payload`
membentuk argumennya dengan menambahkan literal `'--validate-only=true'` pada array dan tidak
menambahkan `--force`. Perubahan phase ini tidak menyentuh array tersebut sama sekali (lihat
diff di section 2), jadi mekanismenya utuh.

Status faktual mekanisme itu sendiri tetap seperti temuan phase 00: CLI menolaknya. Diuji ulang
di `smoke-test-home/`:

```
$ npx restforge dashboard create --project=x --name=dash-y --payload=zzz --validate-only=true
Invalid usage of dashboard create:
  - Unknown flag: --validate-only
```

Kontrak `dashboard create` memang tidak punya flag itu (komentar di kepala `create.js:10-12`
menyatakan flag legacy `--validate-only` sengaja tidak di-expose pada contract Fase 04), dan
`packages/platform/generators/lib/arg-parser.js:93` menolak flag tak dikenal. Tool ini karena
itu tetap gagal total pada semua input, sebelum maupun sesudah phase 02d. Memperbaikinya di luar
scope phase ini (dua butir phase hanya menyangkut `--database`), tetapi konsekuensinya perlu
disadari orchestrator: enum `sqlite` yang baru ditambahkan pada tool tersebut belum bisa
diverifikasi secara end-to-end lewat CLI, hanya lewat schema dan pembentukan argumen. Lihat
section 7 butir 1.

### 4.3 Harness argumen terhadap hasil build

Pola sama dengan section 4.1 report phase 02c: harness men-load **file hasil build**
(`dist/tools/codegen/create-dashboard.js` dan
`dist/tools/codegen/validate-dashboard-payload.js`), memasang stub `McpServer` untuk menangkap
`inputSchema` dan handler, lalu mengganti modul `lib/exec.js` lewat ESM loader hook sehingga
`execProcess` merekam argumen apa adanya tanpa pernah men-spawn CLI. Folder `cwd` palsu berisi
`node_modules/@restforgejs/platform` dan `payload/z.json` kosong dipakai agar kedua pre-flight
lolos. Input tiap skenario di-parse lewat `z.object(inputSchema)` lebih dulu, jadi penerimaan
nilai enum benar-benar diuji schema.

```
================ codegen_create_dashboard ================

A. no database parameter
  parsed.database : undefined
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=postgres","--force=true"]
  has --database  : true
  db fact lines   : ["Database: postgres"]

B. database="sqlite" (new enum member)
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=sqlite","--force=true"]
  db fact lines   : ["Database: sqlite"]

C. database="mysql" (legacy value)
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=mysql","--force=true"]

D. database="oracle" + skipSqlValidation=true
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=oracle","--force=true","--skip-sql-validation=true"]

  A === same array with --database=postgres present : true
  A element order unchanged vs C (only db value differs) : true
  C === legacy array for database="mysql" : true
  enum accepted values : ["postgres=accepted","oracle=accepted","mysql=accepted","sqlite=accepted","mssql=rejected"]
  required (io=input)  : ["cwd","project","name","payload"]

================ codegen_validate_dashboard_payload ================

A. no database parameter
  parsed.database : undefined
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=postgres","--validate-only=true"]
  has --database  : true
  db fact lines   : []

B. database="sqlite" (new enum member)
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=sqlite","--validate-only=true"]

C. database="mysql" (legacy value)
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=mysql","--validate-only=true"]

D. database="oracle" + skipSqlValidation=true
  args            : ["restforge","dashboard","create","--project=x","--name=dash-y","--payload=z","--database=oracle","--validate-only=true","--skip-sql-validation=true"]

  A === same array with --database=postgres present : true
  A element order unchanged vs C (only db value differs) : true
  C === legacy array for database="mysql" : true
  enum accepted values : ["postgres=accepted","oracle=accepted","mysql=accepted","sqlite=accepted","mssql=rejected"]
  required (io=input)  : ["cwd","project","name","payload"]
```

Empat hal yang dibuktikan untuk kedua tool:

1. **Tanpa parameter `database`**, flag tetap terkirim sebagai `--database=postgres` persis
   seperti perilaku lama. Ini yang diminta konsekuensi GATE, bukan kelalaian: skenario A memang
   harus tetap memuat flag itu.
2. **`database="sqlite"`** diterima schema (`sqlite=accepted`) dan muncul sebagai
   `--database=sqlite` pada posisi array yang sama dengan nilai lain.
3. **`database="mysql"`** menghasilkan array identik dengan perilaku lama
   (`C === legacy array: true`), dan urutan nama flag pada skenario A sama persis dengan
   skenario C (`A element order unchanged vs C: true`), jadi tidak ada elemen yang bergeser.
4. Nilai di luar enum tetap ditolak (`mssql=rejected`), `database` tetap opsional pada mode
   `io: 'input'`, dan tool validator tetap mengirim `--validate-only=true` tanpa `--force` pada
   keempat skenario.

Perlu dicatat, `db fact lines` pada tool validator memang kosong: tool itu tidak pernah mencetak
baris `Database:` sejak awal (dialect tidak relevan bagi validasi struktural). Tidak ada fact
string yang dihapus phase ini.

### 4.4 Uji CLI read-only di `smoke-test-home/`

Bukti flag opsional dan daftar nilainya:

```
$ cd smoke-test-home
$ npx restforge dashboard create --help
...
Optional Flags:
  --database <string>     Database type (postgres|mysql|oracle|sqlite). Default: postgres (default:
                          null)
  --force                 Overwrite existing files in the output directory (default: false)
  --skip-sql-validation   Skip SQL keyword validation (default: false)
```

Daftar Optional Flags tidak memuat `--validate-only`, sejalan dengan section 4.2.

Run gagal-karena-payload dengan `--database=sqlite`. Payload sementara sengaja dibuat cacat
(placeholder tidak dideklarasikan) agar eksekusi menembus `PayloadProcessor` dan berhenti tepat
di `DashboardValidator`, sesudah nilai database diterima namun sebelum satu file pun ditulis:

```
$ npx restforge dashboard create --project=tmpx --name=dash-tmp --payload=tmp-phase02d.json --database=sqlite
Error: Widget 'w1' query 'query' uses undeclared placeholder ':missing_param' (declare in 'params')
```

Kegagalan murni soal payload, tidak ada keluhan apa pun tentang `sqlite`. Dua run kontrol
menghasilkan pesan yang identik kata demi kata:

```
$ npx restforge dashboard create ... --database=mssql
Error: Widget 'w1' query 'query' uses undeclared placeholder ':missing_param' (declare in 'params')

$ npx restforge dashboard create ...            # tanpa flag --database
Error: Widget 'w1' query 'query' uses undeclared placeholder ':missing_param' (declare in 'params')
```

Run `mssql` inilah bukti empiris temuan GATE nomor 2: nilai yang jelas tidak sah pun lolos,
karena jalur dashboard tidak pernah memvalidasi tipe database. Bandingkan dengan `endpoint
create` pada report phase 02c yang menolaknya dengan `Database type 'mssql' is invalid`.

Payload sementara `smoke-test-home/payload/tmp-phase02d.json` sudah dihapus setelah pengujian,
dan tidak ada modul `tmpx` yang terbentuk di `smoke-test-home/src/modules/` (diperiksa setelah
run). Semua run berhenti pada tahap validasi, sebelum generator berjalan.

### 4.5 Status git sebelum dan sesudah commit

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/mcp-server status --porcelain      # sebelum commit
 M src/tools/codegen/create-dashboard.ts
 M src/tools/codegen/validate-dashboard-payload.ts
?? docs/

$ git -C packages/mcp-server status --porcelain      # sesudah commit
?? docs/
```

Hanya kedua file scope yang di-stage. `docs/` tetap untracked. Commit `434be05` tidak memuat
trailer `Co-Authored-By` (diverifikasi dengan `git log -1 --format=full`). Repo
`packages/platform`, `packages/designer`, dan `restforge-handbook` tidak disentuh, dan tidak ada
checkout branch.

## 5. Keputusan Penting

1. **GATE dipatuhi sepenuhnya: pola 02c tidak diterapkan.** Prompt phase menulis pola 02c
   sebagai target, tetapi memberi jalan keluar bila fakta berkata lain, dan fakta memang berkata
   lain. Membuat `--database` kondisional di sini hanya memindahkan default `postgres` dari MCP
   ke CLI tanpa mengaktifkan mekanisme apa pun, sambil memaksa fact string menjanjikan resolusi
   yang tidak pernah terjadi. Jadi yang dikerjakan tinggal dua butir yang memang berdasar fakta:
   enum dan deskripsi.

2. **`dbType` tidak diganti menjadi `dbTypeLabel`.** Pada phase 02c penggantian nama itu wajib
   karena variabelnya berhenti mewakili nilai yang dikirim. Di sini justru sebaliknya:
   `database ?? 'postgres'` adalah persis string yang masuk ke `--database=`, sehingga baris
   `Database: postgres` pada jalur default tetap benar. Mengubahnya menjadi label akan membuat
   fact string salah.

3. **Enum disamakan dengan daftar CLI meski CLI dashboard tidak memvalidasinya.** Justru karena
   `dashboard create` tidak memanggil `validateDatabaseType`, enum di sisi MCP adalah satu-satunya
   yang menghentikan nilai ngawur sebelum sampai ke generator. Menambah `sqlite` menutup gap
   nilai sah yang selama ini tidak bisa diminta lewat MCP, dan mempertahankan enum tertutup
   menjaga nilai tak sah tetap terblokir.

4. **Deskripsi memuat peringatan eksplisit "tidak ada auto-deteksi".** Setelah phase 02c,
   `codegen_create_endpoint` menyuruh pemanggil membiarkan parameter kosong agar config project
   yang menentukan. Bila deskripsi dashboard dibiarkan hanya berbunyi "Default postgres", model
   pemanggil bisa menggeneralisasi kebiasaan baru itu ke dashboard dan menghasilkan modul
   berdialect salah tanpa peringatan apa pun. Deskripsi baru menyatakan perbedaannya secara
   langsung dan menyebut konsekuensinya, yaitu dialect ikut ter-embed di SQL modul hasil
   generate.

5. **Paragraf "Database type" hanya ditambahkan pada `codegen_create_dashboard`.** Tool validator
   tidak menghasilkan file dan dialect tidak memengaruhi hasil validasi struktural, jadi
   penjelasan panjang di level tool hanya akan menambah bising. Penegasan singkat cukup diletakkan
   di deskripsi parameternya.

## 6. Hal yang Belum Diverifikasi

1. **Generate dashboard nyata dengan `database="sqlite"`.** Yang terbukti baru "nilai diterima
   CLI dan pipeline berjalan sampai validator". Apakah `DashboardGenerator` menghasilkan SQL
   sqlite yang benar dari jalur MCP belum diuji, dan berada di luar dua butir phase.
2. **Jalur sukses `codegen_validate_dashboard_payload` secara end-to-end.** Tool itu masih
   diblokir `Unknown flag: --validate-only` (section 4.2), sehingga penambahan `sqlite` di sana
   baru terverifikasi pada level schema dan pembentukan argumen, belum pada perilaku CLI.
3. **Jalur registry dengan tipe database berbeda.** `create.js:140-145` menolak mengganti tipe
   database project yang sudah terdaftar bila `force` bernilai false, sedangkan
   `codegen_create_dashboard` selalu mengirim `--force=true`. Artinya tool ini bisa mengganti
   tipe database project terdaftar tanpa penolakan. Kombinasi itu tidak diuji di phase ini
   (perilaku lama, tidak diubah phase ini) tetapi dicatat sebagai temuan, lihat section 7 butir 3.
4. **Sisi client MCP.** Perubahan enum dan deskripsi belum diuji dengan client MCP nyata (Claude
   Desktop atau Inspector), hanya lewat harness pada hasil build.

## 7. Pertanyaan untuk Orchestrator

1. **Kapan `codegen_validate_dashboard_payload` diperbaiki, dan haruskah tool itu tetap ada?**
   Tool ini gagal pada 100 persen input karena CLI menolak `--validate-only`, jadi perbaikan
   enum yang baru saja dilakukan padanya belum berdampak nyata sebelum mekanismenya dibetulkan.
   Ada dua arah: memanggil `DashboardValidator` lewat jalur lain, atau menambahkan kembali flag
   `--validate-only` pada contract CLI di `packages/platform` (perubahan lintas repo). Phase mana
   yang memegang butir ini?

2. **Perlukah `dashboard create` diberi auto-deteksi `DB_TYPE` seperti `endpoint create`?**
   Ini temuan asimetri di sisi platform, bukan MCP, jadi tidak dikerjakan di phase ini. Dampaknya
   nyata: project ber-`DB_TYPE=mysql` yang men-generate endpoint tanpa flag mendapat mysql,
   tetapi men-generate dashboard tanpa flag mendapat postgres. Bila platform kelak disamakan,
   deskripsi dan pengiriman flag pada dua tool ini harus ikut diubah mengikuti pola 02c, dan
   report ini menjadi rujukan titik-titik yang perlu disentuh.

3. **`--force=true` yang hardcoded pada `codegen_create_dashboard` melewati proteksi ganti tipe
   database.** CLI menolak mengganti tipe database project terdaftar hanya bila `force` bernilai
   false (`cli/dashboard/create.js:140-145`), sementara tool selalu mengirim `--force=true` demi
   menghindari prompt readline. Akibatnya panggilan MCP dengan `database` keliru bisa mengubah
   tipe database project yang sudah terdaftar secara diam-diam. Temuan baru, tidak dikerjakan
   sesuai aturan strict per-phase. Perlu phase tersendiri?

4. **Tidak ada validasi tipe database pada seluruh jalur dashboard di sisi platform** (section
   4.1 butir 2, dibuktikan empiris di section 4.4 lewat run `mssql`). Nilai ngawur akan diteruskan
   ke generator. Sisi MCP sudah aman karena enum tertutup, tetapi pengguna CLI langsung tidak.
   Perlu di-file sebagai issue di `packages/platform/docs/issues`?

5. **Sweep tool MCP lain yang menerima `database`** (pertanyaan 3 report phase 02c) masih
   relevan. Phase 02d menutup dua tool dashboard, dan tambahan pelajarannya: setiap tool perlu
   dicek terhadap handler CLI-nya masing-masing, karena ternyata resolusi database TIDAK seragam
   antar-command di platform.

---

`d:\workspace\03_projects\restforge-systems\packages\mcp-server\docs\worker-context\fix-mcp-gap-v1\reports\phase-02d-database-kondisional-dashboard.md`
