# Report Phase 02g — Sweep Resolusi Payload pada Tool Codegen Non-Dashboard

Campaign: `fix-mcp-gap-v1`. Worker phase 02g. Tanggal: 2026-08-23.
Branch: `campaign/fix-mcp-gap-v1` di `packages/mcp-server` (tanpa checkout, tanpa menyentuh
repo lain).

Versi rujukan: `@restforgejs/mcp-server` 1.3.0 (tidak di-bump), `@restforgejs/platform` 5.5.5
ter-install di `smoke-test-home/`. Node.js v22.21.1.

**Ringkasan hasil audit:** dugaan report 02f section 7 butir 1 hanya benar sebagian. Ketiga verb
CLI ternyata memakai tiga jalur resolusi yang BERBEDA, dan tidak satu pun dari ketiganya
mengulang bug issue-45 butir 2. `endpoint create` dan `processor create` melewatkan argumen
`--payload` ke `ArgumentValidator.validatePayloadName`, yang membuang `.json`, me-lowercase,
lalu menambahkan `.json` kembali, jadi bentuk dengan maupun tanpa ekstensi sama-sama berfungsi.
`kafka consumer-create` punya resolver sendiri yang menerima nama, path relatif, dan path
absolut. Yang tetap perlu diperbaiki adalah dua hal lain di sisi MCP: pre-flight `create-endpoint.ts`
yang menebak path dengan aturan berbeda dari CLI (dan schema-nya menolak bentuk ber-ekstensi yang
sebenarnya sah), serta deskripsi `create-processor.ts` yang menjanjikan bentuk path padahal
validator CLI menolaknya. `create-kafka-consumer.ts` tidak disentuh sama sekali.

## 1. Status Checklist

- [x] Sumber kebenaran dibaca lebih dulu: report 02f section 5 butir 1-3 dan section 7 butir 1,
      lalu `payload-validator.js` (`findPayloadFile`, `readPayloadFile`) beserta pemanggilnya per verb
- [x] Branch diverifikasi `campaign/fix-mcp-gap-v1` sebelum satu pun baris diubah; tidak ada
      perpindahan branch; `packages/platform` tidak disentuh (hanya dibaca)
- [x] Sweep pengirim `--payload` dijalankan menyeluruh di `src/` (hasil: 7 tool, section 4.1)
- [x] Audit per verb dilakukan SEBELUM wiring, dengan kutipan baris CLI (section 4.2) dan
      dibuktikan lapangan lewat probe CLI live (section 4.3)
- [x] `create-endpoint.ts`: mismatch pre-flight + schema + deskripsi diperbaiki; argumen tetap
      diteruskan apa adanya
- [x] `create-processor.ts`: deskripsi diperbaiki + pre-flight payload ditambahkan meniru kandidat
      verb tersebut; argumen tetap diteruskan apa adanya
- [x] `create-kafka-consumer.ts`: TIDAK diubah karena tidak ada mismatch (bukti section 4.2.c dan 4.3.c)
- [x] Tool designer (`designer/generate.ts`, `preview-files.ts`, `validate-payload.ts`) diperiksa
      lalu dinyatakan di luar scope dengan alasan (section 4.1)
- [x] Kompatibilitas klien lama dijaga: bentuk TANPA ekstensi tetap diterima kedua tool dan tetap
      menghasilkan argumen yang identik dengan sebelumnya (section 4.4 skenario B)
- [x] `npm run build` lolos
- [x] Tidak ada script test di package ini (dinyatakan ulang, section 3.2)
- [x] Tidak ada bump version, tidak ada `npm publish`, `docs/worker-context/` tidak di-commit
- [x] Commit sebelum report, tanpa trailer co-author
- [x] Strict per-phase dipatuhi: temuan baru dilaporkan (section 7), tidak dikerjakan

## 2. File yang Dimodifikasi + Hash Commit

Commit: `95eedde7f076ed7f0b73063e43eec871f8483ba7`
Pesan baris pertama:
`fix(mcp): selaraskan resolusi payload endpoint dan processor dengan CLI (fix-mcp-gap-v1 phase-02g)`

| File | Perubahan |
|---|---|
| `packages/mcp-server/src/tools/codegen/create-endpoint.ts` | Helper lokal `cliPayloadFileName` + `resolvePayloadPath`; schema `payload` menerima bentuk dengan maupun tanpa `.json`; pre-flight payload memakai normalisasi dan dua kandidat lokasi CLI plus petunjuk lowercase; fact `Payload`/`Payload file` di tiga cabang respons; deskripsi parameter dan baris Preconditions diperbarui |
| `packages/mcp-server/src/tools/codegen/create-processor.ts` | Helper lokal `cliPayloadFileName`, `resolvePayloadPath`, konstanta `CLI_PAYLOAD_NAME`; dua pre-flight payload baru (bentuk nama, lalu keberadaan file); fact `Payload file` pada cabang gagal dan sukses; deskripsi parameter `payload` dan baris Preconditions diperbarui |

Statistik diff: 2 file, 140 insertion, 13 deletion. `create-kafka-consumer.ts` sengaja tidak masuk.

Helper pada `create-endpoint.ts` (padanannya di `create-processor.ts` identik, alasan duplikasi di
section 5 butir 4):

```ts
function cliPayloadFileName(payload: string): string {
  const base = payload.endsWith('.json') ? payload.slice(0, -5) : payload;
  return `${base.toLowerCase()}.json`;
}

async function resolvePayloadPath(projectCwd: string, fileName: string): Promise<string | null> {
  for (const candidate of [join(projectCwd, 'payload', fileName), join(projectCwd, fileName)]) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}
```

Pembentukan argumen tidak berubah pada ketiga tool; nilainya tetap utuh:

```ts
      const cliArgs = [
        'restforge',
        'endpoint',
        'create',
        `--project=${project}`,
        `--name=${endpoint}`,
        `--payload=${payload}`,
      ];
```

## 3. Hasil Test

### 3.1 Build

```
$ npm run build
> @restforgejs/mcp-server@1.3.0 build
> tsc

BUILD_EXIT=0
```

Lolos tanpa error dan tanpa warning, dijalankan dua kali (setelah perubahan awal dan setelah
penambahan fact `Payload file` pada cabang sukses processor).

### 3.2 Script test

Dinyatakan ulang: **tidak ada script test di package ini.** Isi `scripts` pada
`packages/mcp-server/package.json` tetap `build`, `dev`, `start`, `inspect`; tidak ada entry `test`.
Verifikasi bertumpu pada harness argumen terhadap hasil build (section 4.4) dan probe CLI live
(section 4.3 dan 4.5).

## 4. Verifikasi Mandiri

### 4.1 Sweep pengirim `--payload`

Pencarian `--payload` di `packages/mcp-server/src/` menemukan tujuh tool:

| File | CLI yang dipanggil | Status scope |
|---|---|---|
| `codegen/create-dashboard.ts` | `restforge dashboard create` | Selesai di phase 02f |
| `codegen/validate-dashboard-payload.ts` | `restforge dashboard create --validate-only` | Selesai di phase 02f |
| `codegen/create-endpoint.ts` | `restforge endpoint create` | Diaudit dan diperbaiki di phase ini |
| `codegen/create-processor.ts` | `restforge processor create` | Diaudit dan diperbaiki di phase ini |
| `codegen/create-kafka-consumer.ts` | `restforge kafka consumer-create` | Diaudit, tanpa mismatch, tidak diubah |
| `designer/generate.ts`, `designer/preview-files.ts`, `designer/validate-payload.ts` | `restforge-designer` (binary Designer, BUKAN platform) | Di luar scope |

Tiga tool designer memang mengirim `--payload`, tetapi ke binary `restforge-designer` di
`packages/designer`, bukan ke CLI platform. Resolusi payload-nya milik repo lain, sedangkan phase
ini bersandar pada `payload-validator.js` platform sebagai sumber kebenaran. Ketiganya juga
mendeskripsikan parameternya sebagai path UDF, bukan nama file tanpa ekstensi, jadi tidak memikul
gejala issue-45 butir 2. Dicatat sebagai temuan, tidak dikerjakan (section 7 butir 2).
`generate-payload.ts` memakai `--table`, sesuai catatan prompt, jadi tidak muncul di sweep.

### 4.2 Audit resolusi payload per verb CLI (dijalankan sebelum wiring)

**a. `endpoint create`.** Argumen tidak langsung dipakai; ia melewati validator nama lebih dulu.
`packages/platform/generators/cli/endpoint/create.js:210` dan `:272`:

```js
            const payloadFile = ArgumentValidator.validatePayloadName(args.payload);
...
            const rawPayload = PayloadValidator.readPayloadFile(payloadFile, skipSqlValidation);
```

Inti persoalannya ada di validator itu,
`packages/platform/generators/lib/validators/argument-validator.js:292-318`:

```js
     // Hapus .json extension jika ada, akan ditambahkan kembali nanti
     if (trimmed.endsWith('.json')) {
       trimmed = trimmed.slice(0, -5);
     }
...
     const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
     if (!validPattern.test(trimmed)) {
       throw new Error('Payload name can only contain letters, numbers, dash (-), and underscore (_), and must start with a letter or number');
     }
...
     // Tambahkan .json extension
     return trimmed.toLowerCase() + '.json';
```

Tiga konsekuensi yang menentukan seluruh phase ini: (1) bentuk dengan dan tanpa `.json`
menghasilkan nama yang sama persis, jadi jalur ini TIDAK memikul bug issue-45 butir 2; (2) nama
di-lowercase, jadi `Users` selalu dicari sebagai `users.json`; (3) bentuk path DITOLAK, karena `/`
dan `\` tidak lolos pola. Nama hasil normalisasi itulah yang masuk ke `findPayloadFile`
(`payload-validator.js:206-233`) dengan kandidat `<workingDir>/payload/<nama>`, `<workingDir>/<nama>`,
`<cwd>/payload/<nama>`, `<cwd>/<nama>`, plus satu kandidat di dalam package platform saat bukan PKG.

Perlu ditegaskan karena inilah titik yang membedakannya dari dashboard: `cli/dashboard/create.js:124`
memanggil `PayloadValidator.findPayloadFile(payloadName)` dengan nama MENTAH, tanpa
`validatePayloadName` sama sekali. Sumber `findPayloadFile` yang sama dipakai dua verb, tetapi hanya
satu di antaranya yang menormalisasi nama lebih dulu. Report 02f menyimpulkan kesamaan jalur dari
`findPayloadFile` saja, sehingga menduga endpoint memikul bug yang sama; dugaan itu tidak terbukti.

**b. `processor create`.** Pola sama dengan endpoint pada sisi validasi nama
(`cli/processor/create.js:907`), tetapi pembacaan filenya memakai salinan lokal, bukan
`PayloadValidator`. `cli/processor/create.js:168-174`:

```js
function readPayloadFile(payloadFileName, workingDir) {
    const possiblePaths = [
        path.join(workingDir, 'payload', payloadFileName),
        path.join(workingDir, payloadFileName),
        path.join(process.cwd(), 'payload', payloadFileName),
        path.join(process.cwd(), payloadFileName)
    ];
```

Jadi normalisasinya identik dengan endpoint, kandidat lokasinya juga setara, tetapi kodenya
terpisah.

**c. `kafka consumer-create`.** Verb ini sama sekali tidak memakai `ArgumentValidator` maupun
`PayloadValidator`. `cli/kafka/consumer-create.js:82-97`:

```js
function resolvePayloadPath(payloadName) {
    if (path.isAbsolute(payloadName)) {
        return payloadName;
    }

    if (payloadName.includes('/') || payloadName.includes('\\')) {
        return path.resolve(process.cwd(), payloadName);
    }

    let filename = payloadName;
    if (!filename.endsWith('.json')) {
        filename += '.json';
    }

    return path.resolve(process.cwd(), 'payload', filename);
}
```

Menerima path absolut, path relatif, dan nama telanjang; ekstensi ditambahkan bila belum ada; tidak
ada lowercasing dan tidak ada pembatasan karakter.

**d. Framework argumen tidak ikut menormalisasi.** Perlu dipastikan agar audit di atas tidak batal
oleh lapisan parser. `lib/arg-parser.js:36` (`parseArgs`) hanya memisah `--k=v` dan meng-coerce tipe
yang dideklarasikan kontrak; nilai bertipe string diteruskan mentah. `ArgumentValidator.parseArguments`
(yang memanggil `validatePayloadName` lewat `case 'payload'`) adalah sisa jalur lama dan sudah tidak
dipakai — komentar di kepala `cli/endpoint/create.js:17` dan `cli/processor/create.js:15` menyatakan
demikian, dan pencarian pemanggilnya tidak menemukan satu pun verb aktif. Karena itu kafka benar-benar
menerima nilai mentah.

**Kesimpulan audit:** hanya endpoint dan processor yang berbagi aturan normalisasi; kafka berdiri
sendiri; ketiganya menerima bentuk ber-ekstensi. Tabel keputusan ada di section 4.6.

### 4.3 Probe CLI live SEBELUM perubahan (platform 5.5.5, `smoke-test-home/`)

Ketiga verb dijalankan dengan payload yang sengaja tidak ada, memakai tiga bentuk argumen. Semua
run memakai `NODE_ENV=production` dan stdin ditutup.

**a. `endpoint create`** — bentuk baru dan bentuk lama menghasilkan pencarian yang SAMA:

```
=== endpoint create --project=p02g --name=e02g --payload=nope-xyz.json --skip-schema-check ===
Error: Payload file nope-xyz.json not found in the following locations:
  - ...\smoke-test-home\payload\nope-xyz.json
  - ...\smoke-test-home\nope-xyz.json
EXIT=1

=== endpoint create --project=p02g --name=e02g --payload=nope-xyz --skip-schema-check ===
Error: Payload file nope-xyz.json not found in the following locations:
  - ...\smoke-test-home\payload\nope-xyz.json
  - ...\smoke-test-home\nope-xyz.json
EXIT=1
```

Dua hal terbukti sekaligus: nama utuh diterima parser dan resolusi berjalan (nama muncul apa adanya
pada pesan), dan bentuk lama TIDAK gagal seperti pada dashboard — keduanya mencari file yang sama.
Ini bukti langsung bahwa gejala issue-45 butir 2 tidak pernah ada di verb ini.

**b. `processor create`** — sama untuk dua bentuk pertama, dan bentuk path ditolak:

```
=== processor create ... --payload=nope-xyz.json ===   → Payload file nope-xyz.json not found ... EXIT=1
=== processor create ... --payload=nope-xyz ===        → Payload file nope-xyz.json not found ... EXIT=1
=== processor create ... --payload=payload/nope-xyz.json ===
Error: Payload name can only contain letters, numbers, dash (-), and underscore (_), and must start with a letter or number
EXIT=1
```

Run ketiga adalah bukti bahwa deskripsi lama tool (`Path or file name of the processor payload JSON`)
menjanjikan sesuatu yang tidak pernah bisa berhasil.

**c. `kafka consumer-create`** — ketiga bentuk diterima parser dan diresolusi:

```
=== kafka consumer-create ... --payload=nope-xyz.json ===
Error: Payload file not found: ...\smoke-test-home\payload\nope-xyz.json
=== kafka consumer-create ... --payload=nope-xyz ===
Error: Payload file not found: ...\smoke-test-home\payload\nope-xyz.json
=== kafka consumer-create ... --payload=payload/nope-xyz.json ===
Error: Payload file not found: ...\smoke-test-home\payload\nope-xyz.json
```

Bentuk telanjang mendapat `.json` otomatis, bentuk path diresolusi relatif cwd. Deskripsi tool yang
menyebut "Path or file name" persis benar untuk verb ini, sehingga tidak ada yang perlu diubah.

Direktori uji diperiksa setelah seluruh run: tidak ada `src/modules/`, tidak ada `src/consumers/`,
dan `p02g` tidak muncul di `.restforge/projects.json` (`grep -c p02g` mengembalikan 0). Kegagalan
payload terjadi sebelum satu pun file ditulis.

### 4.4 Harness argumen terhadap hasil build

Pola sama dengan report 02b sampai 02f: harness me-load file hasil build
(`dist/tools/codegen/*.js`), memasang stub `McpServer` untuk menangkap `inputSchema` dan handler,
lalu mengganti modul `lib/exec.js` lewat ESM loader hook sehingga `execProcess` merekam argumen apa
adanya tanpa pernah men-spawn CLI. Folder `cwd` palsu berisi `node_modules/@restforgejs/platform`,
`payload/users.json`, `payload/order.json`, dan `root-one.json` di root project agar kandidat kedua
ikut teruji. Input tiap skenario di-parse lewat `z.object(inputSchema)` lebih dulu. Harness dihapus
sebelum commit.

```
================ codegen_create_endpoint ================

A. payload="users.json" (file payload/users.json exists)
  args   : ["restforge","endpoint","create","--project=x","--name=y","--payload=users.json","--force=true"]
  facts  : Payload: users.json | Payload file: ...\fake-cwd\payload\users.json

B. payload="users" (old form)
  args   : ["restforge","endpoint","create","--project=x","--name=y","--payload=users","--force=true"]

C. payload="Users" (CLI lowercases -> users.json)
  args   : ["restforge","endpoint","create","--project=x","--name=y","--payload=Users","--force=true"]
  spawned: true

D. payload="root-one" (file at project root, 2nd CLI candidate)
  args   : ["restforge","endpoint","create","--project=x","--name=y","--payload=root-one","--force=true"]

E. payload="ghost.json" (missing) — pre-flight
  spawned CLI : false
  isError     : false
Precondition not met: payload file not found.
Payload argument: ghost.json
Resolved file name: ghost.json
Locations checked: ...\fake-cwd\payload\ghost.json and ...\fake-cwd\ghost.json

F. other flags unchanged (force=false etc.)
  args   : ["restforge","endpoint","create","--project=x","--name=y","--payload=users.json","--database=mysql","--create-examples=false","--skip-sql-validation=true","--verbose=true","--config=config/db.env"]
  stdin  : "ignore"

  payload schema: "users"=accepted, "users.json"=accepted, "payload/users.json"=rejected,
                  "../escape.json"=rejected, "users.JSON"=rejected, "a b.json"=rejected,
                  <50 chars>=accepted, <51 chars>=rejected, <50 chars>+".json"=accepted

================ codegen_create_processor ================

A. payload="order.json"
  args   : ["restforge","processor","create","--project=x","--name=y","--payload=order.json"]
  facts  : Payload: order.json | Payload file: ...\fake-cwd\payload\order.json

B. payload="order" (old form)
  args   : ["restforge","processor","create","--project=x","--name=y","--payload=order"]

C. payload="payload/order.json" (path form — CLI rejects it)
  spawned CLI : false
  isError     : false
Precondition not met: the payload name has a shape the CLI rejects.

D. payload="ghost" (missing)
  spawned CLI : false
  isError     : false
Precondition not met: payload file not found.
Resolved file name: ghost.json

E. other flags unchanged
  args   : ["restforge","processor","create","--project=x","--name=y","--payload=order","--database=sqlite","--force","--skip-sql-validation"]

================ codegen_create_kafka_consumer (untouched) ================

  payload="nope.json"        -> args [...,"--payload=nope.json"]        | spawned true
  payload="nope"             -> args [...,"--payload=nope"]             | spawned true
  payload="payload/nope.json"-> args [...,"--payload=payload/nope.json"]| spawned true

================ required parameters (io=input) ================
  codegen_create_endpoint       -> ["cwd","project","endpoint","payload"]
  codegen_create_processor      -> ["cwd","project","name","payload"]
  codegen_create_kafka_consumer -> ["cwd","project","name","payload"]
```

Yang dibuktikan, dipetakan ke butir yang diminta prompt phase:

1. **Payload utuh.** `users.json` menjadi `--payload=users.json`, bukan `--payload=users`;
   `order.json` menjadi `--payload=order.json`. Tidak ada penambahan maupun pembuangan pada nilai
   yang dikirim, termasuk pada kafka yang tidak disentuh.
2. **Jalur lama tidak bergeser.** Skenario B pada kedua tool menghasilkan array argumen yang
   identik dengan sebelum phase ini (`--payload=users` dan `--payload=order`), termasuk posisi
   `--force=true` pada endpoint. Klien yang sudah terbiasa mengirim nama tanpa ekstensi tidak
   terpengaruh sama sekali.
3. **Pre-flight meniru CLI, bukan menebak.** Skenario C endpoint menerima `Users` karena CLI
   me-lowercase; skenario D menemukan file di root project karena itu kandidat kedua CLI. Keduanya
   akan gagal pada pre-flight versi lama yang hanya memeriksa `<cwd>/payload/<payload>.json`
   apa adanya.
4. **Pre-flight menahan yang memang akan ditolak CLI.** Skenario C processor berhenti sebelum
   spawn dengan pesan yang menyebut bentuk yang benar, menggantikan error CLI yang muncul jauh
   di belakang.
5. **Parameter lain tidak berubah.** Skenario F endpoint dan E processor menunjukkan seluruh flag
   lain (`database`, `force`, `create-examples`, `skip-sql-validation`, `verbose`, `config`) beserta
   opsi `stdin: 'ignore'` pada jalur non-force tetap sama seperti hasil phase sebelumnya. Daftar
   parameter wajib ketiga tool juga tidak bergeser.

### 4.5 Probe CLI live SESUDAH perubahan — resolusi positif

Probe di section 4.3 membuktikan nama diterima parser, tetapi tidak membuktikan file benar-benar
terbaca. Karena itu satu file payload sengaja dibuat berisi `{}` (valid JSON, struktur payload
tidak valid) lalu bentuk argumen yang kini dibangun tool dijalankan terhadapnya:

```
$ printf '{}' > payload/p02g-probe.json

=== endpoint create ... --payload=p02g-probe.json --skip-schema-check ===
Error: Payload p02g-probe.json must have property 'tableName' (Database table name)
EXIT=1

=== endpoint create ... --payload=p02g-probe --skip-schema-check ===
Error: Payload p02g-probe.json must have property 'tableName' (Database table name)
EXIT=1

=== processor create ... --payload=p02g-probe.json ===
Using payload from: ...\smoke-test-home\payload\p02g-probe.json
Error: Payload is not valid: Payload must have a "processor" property that is an array
EXIT=1
```

CLI berhasil menemukan dan MEMBACA file lewat bentuk ber-ekstensi (kegagalannya sudah soal isi,
bukan soal file), dan kedua bentuk endpoint kembali menghasilkan nama file yang sama. File probe
dihapus setelah run; `payload/*.json` kembali kosong, `src/modules` tetap tidak ada, dan `p02g`
tetap tidak terdaftar di registry.

### 4.6 Tabel audit per tool

| Tool | Resolusi CLI | Kondisi lama MCP | Mismatch? | Tindakan |
|---|---|---|---|---|
| `codegen_create_endpoint` | `validatePayloadName` (buang `.json`, lowercase, tambah `.json`) lalu `findPayloadFile`: `<cwd>/payload/<n>.json`, `<cwd>/<n>.json`. Bentuk path ditolak | Nilai diteruskan apa adanya (sudah benar). Schema regex melarang titik sehingga `users.json` DITOLAK. Pre-flight hanya `<cwd>/payload/<payload>.json`, tanpa lowercase, tanpa kandidat root. Deskripsi: "Payload file name without the .json extension" | YA — pada schema, pre-flight, dan deskripsi. Bukan pada nilai yang dikirim | Schema menerima kedua bentuk; pre-flight memakai normalisasi + dua kandidat CLI; fact memakai path yang ditemukan; deskripsi dan Preconditions diperbarui |
| `codegen_create_processor` | Sama: `validatePayloadName` lalu `readPayloadFile` lokal dengan kandidat setara. Bentuk path ditolak | Nilai diteruskan apa adanya (sudah benar). Tidak ada pre-flight payload sama sekali. Deskripsi: "Path or file name of the processor payload JSON" | YA — deskripsi menjanjikan bentuk path yang selalu gagal; tidak ada pre-flight sehingga kegagalan baru muncul dari CLI | Deskripsi diperbaiki (bentuk nama, ekstensi opsional, path ditolak); pre-flight bentuk nama + keberadaan file ditambahkan; fact `Payload file` ditambahkan |
| `codegen_create_kafka_consumer` | `resolvePayloadPath` sendiri: absolut apa adanya, path relatif dari cwd, selain itu `<cwd>/payload/<n>` dengan `.json` ditambahkan bila belum ada | Nilai diteruskan apa adanya. Tidak ada pre-flight, dan Preconditions menyatakan hal itu secara jujur. Deskripsi: "Path or file name of the consumer payload JSON" | TIDAK — deskripsi cocok dengan resolver, ketiga bentuk terbukti diterima (section 4.3.c) | Tidak diubah |

### 4.7 Kompatibilitas klien lama

Prompt meminta ini dijelaskan eksplisit. Ringkasnya: tidak ada bentuk pemanggilan lama yang menjadi
rusak.

- **Nama tanpa ekstensi tetap berfungsi**, dan memang selama ini berfungsi pada kedua verb, berbeda
  dari kasus dashboard. Bukti CLI ada di section 4.3.a dan 4.3.b (bentuk lama dan baru mencari file
  yang sama), bukti sisi tool di section 4.4 skenario B (argumen identik dengan sebelumnya).
- **Schema hanya dilonggarkan, tidak pernah diperketat.** Pada endpoint, regex lama
  `^[a-zA-Z0-9][a-zA-Z0-9_-]*$` diganti `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}(\.json)?$`: seluruh nilai
  yang dulu diterima tetap diterima, ditambah bentuk ber-ekstensi. Batas 50 karakter yang dulu
  dijaga `.max(50)` kini dijaga di dalam regex agar `.json` tidak memakan jatah nama.
- **Pada processor, schema sengaja TIDAK diberi regex.** Nilai yang tidak berbentuk nama file tetap
  diterima schema, lalu dijawab pre-flight dengan pesan yang menjelaskan bentuk yang benar. Bila
  regex dipasang, pemanggil hanya akan menerima error validasi schema yang lebih sulit dibaca untuk
  input yang sebelumnya juga sudah gagal.
- **Satu-satunya perbedaan hasil yang mungkin dirasakan klien lama** adalah pre-flight endpoint yang
  kini menerima dua kasus yang dulu ditolak secara keliru: nama ber-kapital dan payload yang
  diletakkan di root project. Keduanya bergerak ke arah longgar, bukan ketat.

### 4.8 Status git sebelum dan sesudah commit

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/mcp-server status --porcelain      # sebelum stage
 M src/tools/codegen/create-endpoint.ts
 M src/tools/codegen/create-processor.ts
?? docs/

$ git -C packages/mcp-server diff --cached --name-only
src/tools/codegen/create-endpoint.ts
src/tools/codegen/create-processor.ts

$ git -C packages/mcp-server status --porcelain      # sesudah commit
?? docs/
```

Hanya dua file scope yang di-stage; `docs/` tetap untracked; folder harness sementara dihapus
sebelum stage sehingga tidak pernah muncul di `status`. Commit
`95eedde7f076ed7f0b73063e43eec871f8483ba7` diverifikasi tidak memuat trailer `Co-Authored-By`
(`git log -1 --format=full | grep -i co-authored` tidak menemukan apa pun). `packages/platform`
hanya dibaca: `git status --porcelain` di sana tetap menampilkan berkas issue untracked milik phase
terdahulu, tanpa satu pun entri `M`.

## 5. Keputusan Penting

1. **Audit membalik premis phase ini, dan hasilnya dilaporkan apa adanya.** Prompt berangkat dari
   dugaan report 02f bahwa ketiga tool memikul bug yang sama dengan dashboard. Audit menunjukkan
   yang sebaliknya: satu langkah normalisasi di `validatePayloadName` membuat endpoint dan processor
   kebal terhadap gejala itu sejak awal, dan kafka punya resolver sendiri yang bahkan lebih longgar.
   Karena itu tidak ada satu pun perubahan pada nilai `--payload` yang dikirim — yang diperbaiki
   justru lapisan di sekitarnya (schema, pre-flight, deskripsi) yang tidak sinkron dengan CLI.
   Menerapkan pola 02f secara mekanis akan menghasilkan perubahan yang tidak memperbaiki apa pun.

2. **Schema endpoint dilonggarkan, bukan dibiarkan.** Setelah phase 02f, kedua tool dashboard
   menuntut nama BER-ekstensi sementara `codegen_create_endpoint` menolak titik sama sekali. Model
   yang memanggil keduanya dalam satu sesi akan menemui dua konvensi yang bertentangan, dan bentuk
   yang salah pada endpoint gagal di lapisan schema, bukan dengan pesan yang menjelaskan. Karena CLI
   menerima kedua bentuk, schema kini juga menerima keduanya, dan deskripsinya menyatakan hal itu
   secara eksplisit.

3. **`create-kafka-consumer.ts` benar-benar tidak disentuh.** Godaannya adalah menambahkan pre-flight
   payload demi keseragaman dengan dua tool tetangganya. Prompt melarang mengubah tool yang tidak
   punya mismatch, dan deskripsi kafka memang sudah cocok dengan resolvernya, termasuk kalimat
   Preconditions yang jujur menyatakan tool ini tidak melakukan pre-check. Menambah pre-flight di
   sini berarti menulis ulang tiga cabang kandidat (absolut, path relatif, nama telanjang) hanya
   untuk mempercepat pesan kesalahan yang sudah jelas. Dicatat sebagai usul di section 7 butir 1.

4. **Helper disalin lokal ke dua file, bukan dijadikan modul bersama.** Alasannya sama dengan
   section 5 butir 3 report 02f, ditambah satu fakta baru dari audit: aturan resolusi ketiga verb
   memang BERBEDA di sisi CLI, dan dashboard sudah memakai varian tanpa normalisasi. Modul bersama
   akan menyatukan sesuatu yang di hulu memang tidak satu, lalu memaksa parameterisasi (pakai
   lowercase atau tidak, tolak path atau tidak) yang justru menyembunyikan perbedaan itu dari
   pembaca berikutnya.

5. **Pre-flight processor memakai dua tahap terpisah.** Bentuk nama diperiksa lebih dulu, baru
   keberadaan file. Digabung menjadi satu pesan "payload tidak ditemukan", pemanggil yang mengirim
   `payload/order.json` akan diarahkan membuat file yang sebenarnya sudah ada. Pesan tahap pertama
   karena itu menyebut bentuk yang diterima, bukan lokasi yang diperiksa.

6. **Nilai yang tidak ditemukan tetap dijawab `isError: false`.** Kedua pre-flight baru mengikuti
   konvensi §3.4 yang dipakai seluruh package: precondition adalah keadaan yang bisa diperbaiki
   pemanggil, bukan kegagalan tool. Tidak ada perubahan pada cabang error CLI yang sesungguhnya.

7. **Fact block memakai path yang benar-benar ditemukan.** Baris lama `Payload: payload/${payload}.json`
   akan mencetak `payload/users.json.json` begitu pemanggil mengirim bentuk ber-ekstensi. Kini fact
   menampilkan nilai argumen apa adanya pada baris `Payload` dan path hasil resolusi pada baris
   `Payload file`, sehingga respons tool tidak pernah mengarang lokasi.

## 6. Hal yang Belum Diverifikasi

1. **Pemanggilan nyata dari client MCP.** Seluruh verifikasi sisi MCP memakai harness terhadap hasil
   build, bukan Claude Desktop atau MCP Inspector. Perilaku schema, pre-flight, dan pembentukan
   argumen terbukti; rendering deskripsi baru di client belum dilihat.

2. **Generate yang benar-benar berhasil lewat bentuk ber-ekstensi.** Uji lapangan berhenti pada
   pembuktian bahwa file ditemukan dan dibaca (section 4.5). Run generate lengkap sampai file
   terbentuk tidak dijalankan karena akan memutasi `smoke-test-home/` dan membutuhkan database yang
   dapat dijangkau untuk validasi skema. Resolusi payload terjadi sebelum titik itu, jadi perbedaan
   tidak diharapkan, tetapi klaim itu belum diuji.

3. **Perilaku lowercase pada filesystem case-sensitive.** Normalisasi lowercase ditiru dari kode CLI
   dan diuji lewat harness (skenario C endpoint), tetapi seluruh pengujian berjalan di Windows yang
   filesystem-nya case-insensitive. Pada Linux, pre-flight kini akan menolak `Users.json` persis
   seperti CLI menolaknya; itu perilaku yang diinginkan, namun belum diamati langsung.

4. **Tool designer.** Ketiganya hanya diperiksa sepintas dari sisi MCP untuk keperluan sweep;
   resolusi payload di dalam binary `restforge-designer` tidak dibaca sama sekali.

5. **Kafka pada payload yang benar-benar ada.** Verifikasinya berhenti pada bentuk argumen dan
   pesan "not found" untuk ketiga bentuk. Karena tool ini tidak diubah, tidak ada perilaku baru yang
   perlu diuji.

## 7. Pertanyaan untuk Orchestrator

1. **Pre-flight payload untuk `codegen_create_kafka_consumer` — dijadwalkan atau tidak?** Tool ini
   sengaja dibiarkan karena tidak punya mismatch, tetapi kini menjadi satu-satunya tool codegen
   pengirim `--payload` yang tidak melakukan pre-check. Menyamakannya butuh peniruan tiga cabang
   resolver kafka (absolut, path relatif, nama telanjang plus penambahan `.json`), jadi bukan
   pekerjaan sepele. Perlu phase tersendiri, atau dibiarkan dengan Preconditions yang sudah jujur?

2. **Tiga tool designer mengirim `--payload` ke binary Designer.** Ditemukan saat sweep, tidak
   dikerjakan sesuai strict per-phase. `designer/generate.ts`, `designer/preview-files.ts`, dan
   `designer/validate-payload.ts` memakai CLI `restforge-designer` di `packages/designer`, yang
   resolusi payload-nya belum pernah diaudit dalam campaign ini. Perlu sweep serupa untuk sisi
   Designer?

3. **Konvensi payload lintas tool untuk model pemanggil.** Setelah phase ini ada tiga aturan berbeda
   yang semuanya sah: dashboard menuntut nama ber-ekstensi apa adanya, endpoint dan processor
   menerima keduanya dan me-lowercase, kafka menerima nama maupun path. Perbedaannya berasal dari
   CLI, bukan dari MCP, jadi tidak bisa diseragamkan dari sisi tool. Apakah penyeragaman di sisi
   platform layak dijadikan issue tersendiri, atau cukup dijelaskan per deskripsi tool seperti
   sekarang?

4. **Koreksi terhadap report 02f section 7 butir 1.** Dugaan bahwa `codegen_create_endpoint`
   memikul bug issue-45 butir 2 terbantah oleh audit dan probe lapangan di phase ini. Bila issue-45
   ditutup dengan catatan, catatan itu perlu menyebut bahwa butir 2 hanya pernah terjadi pada jalur
   dashboard, agar pembaca berikutnya tidak mencari bug yang tidak ada di verb lain.

5. **Sinkronisasi handbook.** Tidak ada kontrak CLI yang berubah di phase ini, tetapi audit
   memunculkan fakta yang layak didokumentasikan untuk pengguna: `endpoint create` dan
   `processor create` me-lowercase nama payload dan menolak bentuk path, sedangkan
   `kafka consumer-create` menerima path. Handbook tidak disentuh sesuai aturan repo. Masuk ke phase
   handbook yang digate konfirmasi user, atau di luar cakupan campaign?

---

`d:\workspace\03_projects\restforge-systems\packages\mcp-server\docs\worker-context\fix-mcp-gap-v1\reports\phase-02g-sweep-payload-passthrough.md`
