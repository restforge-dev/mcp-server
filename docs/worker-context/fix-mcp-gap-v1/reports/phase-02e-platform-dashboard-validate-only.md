# Report Phase 02e — Flag `--validate-only` pada `dashboard create` (sisi platform)

Campaign: `fix-mcp-gap-v1`. Worker phase 02e. Tanggal: 2026-08-23.
Branch: `campaign/fix-mcp-gap-v1` di `packages/platform` (tanpa checkout, tanpa menyentuh
repo lain).

Versi rujukan: `@restforgejs/platform` 5.5.5 (tidak di-bump), Node.js v22.21.1.

**Ringkasan hasil:** flag `--validate-only` kini ada pada contract `dashboard create` dan
berfungsi. Mode itu menjalankan pipeline validasi yang sama persis dengan jalur generate lalu
berhenti tepat sebelum titik tulis pertama. Terbukti secara lapangan: exit 0 pada payload valid
tanpa satu pun file baru, exit 1 dengan pesan validator identik pada payload cacat, dan jalur
generate normal tidak berubah sama sekali. Kontrak yang diandalkan tool MCP
`codegen_validate_dashboard_payload` (mengirim `--validate-only=true`) sudah dipenuhi sisi CLI.

## 1. Status Checklist

- [x] Ketiga sumber kebenaran dibaca lebih dulu: issue-45, report phase 00 section 3.4, report
      phase 02d section 4.1-4.2
- [x] Branch diverifikasi `campaign/fix-mcp-gap-v1` sebelum satu pun baris diubah; tidak ada
      perpindahan branch
- [x] Flag `validate-only` ditambahkan ke contract (`type: 'boolean'`, `required: false`,
      `default: false`, deskripsi lengkap), mengikuti gaya deklarasi flag existing
- [x] Handler berhenti tepat sebelum titik tulis pertama, dengan satu titik percabangan saja
      dan tanpa duplikasi logika validasi (section 5 butir 1)
- [x] `--force` tidak disyaratkan pada mode validate-only; pemeriksaan konflik registry
      dilewati dan tidak ada yang ditulis maupun diubah (dibuktikan section 4.4)
- [x] Komentar kepala file `create.js:9-12` yang menyatakan flag legacy tidak di-expose sudah
      diperbarui karena tidak lagi benar
- [x] Help/contract description diperbarui: deskripsi flag plus satu baris `examples` baru
      (output help nyata di section 4.1)
- [x] Unit test ditambahkan mengikuti pola live yang sudah ada
      (`tests/unit/cli/dashboard/create.test.js`), 11 test baru
- [x] Snapshot contract di-regenerate karena penambahan flag memicu guard drift (section 5
      butir 3)
- [x] Baseline test dijalankan SEBELUM perubahan, delta dilaporkan (section 3.1)
- [x] Verifikasi CLI live dilakukan; blokir anti-tamper pada `server.js` didokumentasikan
      beserta jalur pengganti yang dipakai (section 3.3)
- [x] Jalur generate normal tidak berubah perilakunya (dibuktikan section 4.3 dan 4.5)
- [x] Scope keras dipatuhi: hanya verb `dashboard create`; tidak ada auto-deteksi database,
      tidak ada perubahan validasi tipe database, tidak ada verb lain disentuh
- [x] Tidak ada bump version, tidak ada changelog atau artefak rilis disentuh
- [x] Tidak ada `npm publish` maupun install ulang ke playground
- [x] Handbook tidak disentuh
- [x] Commit sebelum report, tanpa trailer co-author
- [x] `docs/` tidak di-stage (issue-46 sampai issue-51 tetap untracked)

## 2. File yang Dimodifikasi + Hash Commit

Commit: `96bce81497525ddaccb23f3d5454f9fe3379e273`
Pesan baris pertama: `feat(cli): flag --validate-only pada dashboard create (fix-mcp-gap-v1 phase-02e)`

| File | Perubahan |
|---|---|
| `packages/platform/generators/cli/dashboard/create.js` | Komentar kepala file, deklarasi flag `validate-only`, satu baris `examples`, pembacaan `args['validate-only']`, satu cabang early-return sebelum titik tulis pertama |
| `packages/platform/tests/unit/cli/dashboard/create.test.js` | 11 test baru plus perluasan mock `cliOutput` dan `baseArgs` |
| `packages/platform/tests/snapshots/cli-contracts.json` | Regenerate lewat `node scripts/snapshot-cli-contracts.js` |

Total: 3 file, 183 insertion, 7 deletion. Tidak ada file lain tersentuh.

Inti perubahan handler, ditempatkan persis setelah `summary.payload` diisi dan sebelum
`projectRegistry.loadProjectRegistry()`:

```js
            if (validateOnly) {
                if (muted) {
                    cliOutput.unmute();
                    muted = false;
                }
                summary.duration = ((Date.now() - startTime) / 1000).toFixed(2);
                cliOutput.printDashboardValidateOnlySummary(summary);
                return;
            }
```

Deklarasi flag:

```js
        'validate-only': {
            type: 'boolean',
            required: false,
            default: false,
            description: 'Run the full validation pipeline and stop before writing anything (no module file, no metadata, no registry update). Exit code 0 means the payload is valid'
        }
```

## 3. Hasil Test

### 3.1 Test suite platform (baseline vs sesudah)

Command persis, dijalankan dari `packages/platform`:

```
npm test
```

Script tersebut berisi `node --test tests/unit/**/*.test.js`.

| Metrik | Baseline (sebelum perubahan) | Sesudah perubahan | Delta |
|---|---|---|---|
| tests | 3784 | 3795 | +11 |
| suites | 799 | 800 | +1 |
| pass | 3780 | 3791 | +11 |
| fail | 0 | 0 | 0 |
| skipped | 4 | 4 | 0 |
| exit code | 0 | 0 | 0 |

Delta +11 seluruhnya berasal dari test baru yang ditambahkan phase ini: 2 test shape contract,
1 test jalur generate memakai printer summary lama, dan 8 test pada suite baru
`dashboard create handler — mode validate-only`. Suite +1 adalah suite baru tersebut.

Suite file yang diubah, dijalankan terpisah:

```
node --test tests/unit/cli/dashboard/create.test.js
# tests 24, suites 3, pass 24, fail 0
```

Guard snapshot contract:

```
node --test tests/unit/cli/contract-snapshot.test.js
```

Sebelum snapshot di-regenerate hasilnya `# tests 4, pass 3, fail 1` (guard drift bekerja
sesuai desain: penambahan flag terdeteksi). Sesudah `node scripts/snapshot-cli-contracts.js`
dijalankan, keempat test lolos dan masuk hitungan suite penuh di tabel atas.

### 3.2 Test lama yang sudah stale (temuan baseline, tidak disentuh)

`generators/tests/unit/cli/create-dashboard.test.js` dan
`generators/tests/unit/cli/dispatch-dashboard.test.js` menunjuk ke file yang sudah tidak ada
(`generators/cli/create-dashboard.js`, `generators/restforge-cli.js`) dan ke fixture payload
`packages/platform/restforge/docs/architecture/dashboard-architecture/payload/` yang juga
tidak ada. Pada baseline, sebelum perubahan apa pun:

```
$ node --test generators/tests/unit/cli/create-dashboard.test.js
# tests 15
# pass 0
# fail 15
```

Folder `generators/tests/` memang tidak masuk cakupan script `test` di `package.json` (hanya
`tests/unit/**`), sehingga kegagalan itu tidak pernah terlihat. Karena stale sejak baseline dan
di luar scope phase ini, file tersebut tidak disentuh. Pola test yang dipakai phase ini adalah
pola live di `tests/unit/cli/dashboard/create.test.js`, yang memang menguji contract dan
handler versi sekarang. Butir ini dicatat sebagai backlog di section 7.

### 3.3 Verifikasi CLI live dan blokir anti-tamper

Percobaan pertama lewat binary utama, dari `packages/platform`:

```
$ node server.js dashboard create --help
[SECURITY] Manifest signature verification failed!
  Reason: Manifest missing signature field
  This indicates manifest tampering or unsupported package version.

╔═══════════════════════════════════════════════════════╗
║          ⚠️  CODE TAMPERING DETECTED!                ║
╚═══════════════════════════════════════════════════════╝
```

Konfirmasi memory project: `server.js` menolak berjalan dari working tree source. Perhatikan
bahwa blokir ini bersifat bootstrap dan sudah terjadi pada baseline, bukan akibat perubahan
phase ini.

Jalur pengganti yang dipakai: entry point CLI `generators/cli-entry.js` dijalankan langsung
dengan `node`. Entry point itulah yang sesungguhnya melakukan `parseArgs` dan memanggil
`contract.handler` (jejaknya dikutip di report phase 00 section 3.4), sehingga verifikasi lewat
jalur ini menguji rantai parsing sampai handler secara utuh, bukan sekadar unit test terisolasi.
Seluruh bukti di section 4 berasal dari jalur ini.

## 4. Verifikasi Mandiri

### 4.1 Contract menampilkan `--validate-only`

```
$ node generators/cli-entry.js dashboard create --help
Command: dashboard create

Generate dashboard endpoint module from payload (multi-widget aggregator)

Usage:
  npx restforge dashboard create --project=<STRING> --name=<STRING> --payload=<STRING> [options]

Required Flags:
  --project <string>      Target project name
  --name <string>         Dashboard name (must start with "dash-", e.g., dash-sales)
  --payload <string>      Path or filename of the dashboard JSON payload

Optional Flags:
  --database <string>     Database type (postgres|mysql|oracle|sqlite). Default: postgres (default:
                          null)
  --force                 Overwrite existing files in the output directory (default: false)
  --skip-sql-validation   Skip SQL keyword validation (default: false)
  --validate-only         Run the full validation pipeline and stop before writing anything (no
                          module file, no metadata, no registry update). Exit code 0 means the
                          payload is valid (default: false)

Examples:
  npx restforge dashboard create --project=mini-inventory --name=dash-sales --payload=dashboard-sales.json
  npx restforge dashboard create --project=mini-inventory --name=dash-sales --payload=dashboard-sales.json --force
  npx restforge dashboard create --project=mini-inventory --name=dash-sales --payload=dashboard-sales.json --validate-only
EXIT=0
```

Halaman help ini dirender otomatis dari contract oleh `generators/lib/help-generator.js`, jadi
munculnya baris `--validate-only` adalah bukti langsung flag terdaftar pada contract.

### 4.2 Payload valid → exit 0, nol file baru

Project uji dibuat di direktori temporer berisi hanya payload dashboard minimal plus satu file
SQL widget. Pemeriksaan filesystem dilakukan sebelum dan sesudah:

```
=== BEFORE ===
./payload/dashboard-live.json
./payload/query/widget-sample.sql

=== RUN validate-only ===
$ node <platform>/generators/cli-entry.js dashboard create --project=live-demo \
    --name=dash-live --payload=dashboard-live.json --validate-only
Configuration:
  Project      live-demo
  Dashboard    dash-live
  Database     postgres

Payload:
  Source       payload/dashboard-live.json
  Status       validated

OK Validation passed in 0.00s
EXIT=0

=== AFTER ===
./payload/dashboard-live.json
./payload/query/widget-sample.sql
```

Isi direktori identik: tidak ada `src/modules/`, tidak ada `metadata/`, tidak ada
`.restforge/projects.json`.

Bentuk yang persis dikirim tool MCP, yaitu `--validate-only=true`, diuji terpisah dan
memberikan hasil sama (exit 0, filesystem tidak berubah). Bentuk itu diterima karena
`generators/lib/arg-parser.js:102-118` meng-coerce nilai boolean untuk flag bertipe `boolean`.

### 4.3 Payload cacat → exit non-nol, pesan identik dengan jalur generate

Kasus yang dipakai adalah kasus dari report phase 02d: placeholder yang tidak dideklarasi pada
`params`. Payload berisi satu widget dengan SQL `SELECT 1 AS value WHERE year = :year;` tanpa
blok `params`.

```
=== validate-only ===
Error: Widget 'bad_widget' query 'query' uses undeclared placeholder ':year' (declare in 'params')
EXIT=1

=== tanpa flag (jalur generate) ===
Error: Widget 'bad_widget' query 'query' uses undeclared placeholder ':year' (declare in 'params')
EXIT=1
```

Pesan dan exit code sama persis, karena kedua jalur memanggil
`DashboardValidator.validateDashboardPayload` yang sama dengan argumen yang sama. Filesystem
direktori uji tidak berubah pada kedua run.

### 4.4 `--force` tidak disyaratkan dan registry tidak tersentuh

Direktori uji terpisah lebih dulu di-generate normal sampai berisi module, metadata, dan
registry. Hash agregat seluruh file direkam sebelum dan sesudah tiga run berikut:

| Run | Perintah | Hasil |
|---|---|---|
| E | `... --validate-only` pada project yang module-nya sudah ada, tanpa `--force` | `OK Validation passed`, exit 0 |
| F | `... --database=mysql --validate-only` pada project terdaftar `postgres`, tanpa `--force` | `OK Validation passed`, exit 0 |
| G | `... --database=mysql` (pembanding, jalur generate) tanpa `--force` | `Project "live-demo" is already registered with database type "postgres". Cannot change to "mysql" without --force.`, exit 1 |

Hash agregat sebelum dan sesudah ketiga run: `8d89630640ae1ae7dedd078df10ba628`, identik. Run F
dan G membuktikan dua hal sekaligus: pemeriksaan konflik registry memang dilewati pada mode
validate-only (sesuai butir 3 spesifikasi phase), dan pemeriksaan itu tetap utuh pada jalur
generate.

### 4.5 Jalur generate normal tidak berubah

Run generate tanpa flag di direktori bersih:

```
$ node <platform>/generators/cli-entry.js dashboard create --project=live-demo \
    --name=dash-live --payload=dashboard-live.json
Configuration:
  Project      live-demo
  Dashboard    dash-live
  Database     postgres

Payload:
  Source       payload/dashboard-live.json
  Status       validated

Generated:
  src/modules/live-demo.js                           19.3 KB
  src/modules/live-demo/dash-live.js                 2.1 KB

Endpoint: POST /api/live-demo/dash-live/dashboard

OK Operation completed in 0.02s
EXIT=0

=== file yang terbentuk ===
./.restforge/projects.json
./metadata/global.json
./metadata/live-demo.json
./src/modules/live-demo.js
./src/modules/live-demo/dash-live.js
```

Tujuh file versus nol file pada mode validate-only. Sisi unit test, klaim yang sama dijaga oleh
tiga test: `orchestrate generator dengan project + name dari args` (kelima generator terpanggil),
`jalur generate normal memanggil printDashboardSummary, bukan summary validate-only`, dan
`throw ketika project sudah terdaftar dengan database berbeda dan force=false`. Ketiganya sudah
lolos pada baseline maupun sesudah perubahan.

Secara struktur, jalur generate hanya kehilangan nol baris: cabang baru berupa `if (validateOnly)`
dengan `return` di dalamnya, sehingga saat flag tidak aktif alur eksekusi persis seperti sebelumnya.

### 4.6 Status git sebelum dan sesudah commit

Sebelum stage:

```
$ git -C packages/platform status --porcelain
 M generators/cli/dashboard/create.js
 M tests/snapshots/cli-contracts.json
 M tests/unit/cli/dashboard/create.test.js
?? docs/issues/issue-46-...md
?? docs/issues/issue-47-...md
?? docs/issues/issue-48-...md
?? docs/issues/issue-49-...md
?? docs/issues/issue-50-...md
?? docs/issues/issue-51-...md
```

Yang di-stage hanya tiga file pertama (`git diff --cached --name-only` dikonfirmasi berisi
tepat tiga entry). Sesudah commit, working tree menyisakan hanya enam file `docs/issues/*.md`
untracked, persis seperti sebelum phase ini dimulai. Commit message dicek dan tidak mengandung
trailer co-author.

## 5. Keputusan Penting

1. **Titik percabangan tunggal, tepat setelah `summary.payload` diisi.** Alternatifnya adalah
   membungkus setiap titik tulis dengan `if (!validateOnly)`, yang berarti lima cabang tersebar
   plus risiko satu titik terlewat. Early-return dipilih karena batas antara "validasi" dan
   "tulis" pada handler ini kebetulan bersih: seluruh validasi selesai di
   `DashboardValidator.validateDashboardPayload`, dan aksi tulis pertama baru muncul pada
   `MainModuleGenerator.createMainModule`. Di antara keduanya hanya ada pemeriksaan konflik
   registry yang bersifat baca. Tidak ada satu baris logika validasi pun yang diduplikasi.

2. **Printer output sudah tersedia, tidak perlu dibuat.** `cli-output.js:223` sudah memiliki
   `printDashboardValidateOnlySummary` lengkap dengan format Configuration/Payload/`OK Validation
   passed`. Method itu dead code sebelum phase ini: grep di seluruh `generators/`, `tests/`,
   `scripts/`, `cli/`, dan `server.js` tidak menemukan satu pun pemanggil. Jadi peninggalan
   desain lama itu kini hidup kembali, tanpa menambah kode output baru dan dengan bahasa
   user-facing yang memang sudah Inggris sesuai kebijakan repo.

3. **Snapshot contract di-regenerate, bukan dikecualikan.** `tests/unit/cli/contract-snapshot.test.js`
   membandingkan seluruh contract dengan `tests/snapshots/cli-contracts.json` dan gagal saat ada
   flag baru. Pesan kegagalannya sendiri menginstruksikan `node scripts/snapshot-cli-contracts.js`
   bila perubahan disengaja, dan di sini perubahan memang disengaja. Diff snapshot terbatas pada
   satu blok flag `validate-only` di bawah `dashboard/create` plus stempel `meta.generated`;
   `meta.version` tetap `5.5.5` karena tidak ada bump.

4. **Pemeriksaan konflik registry dilewati, bukan dilaporkan sebagai informasi.** Spesifikasi
   phase mengizinkan keduanya. Dilewati dipilih karena `loadProjectRegistry()` pada project yang
   belum pernah di-generate akan membaca berkas yang belum ada, dan melaporkan konflik yang tidak
   relevan hanya menambah noise pada tool yang jawabannya dikonsumsi mesin (MCP). Konsekuensinya
   dicatat: mode validate-only tidak akan memperingatkan bahwa generate berikutnya butuh `--force`.

5. **`generators/tests/` tidak disentuh meski di sana ada file test dashboard.** Kedua file di
   sana sudah stale total sejak baseline (section 3.2) dan tidak masuk cakupan runner. Menambah
   test ke file yang 15 dari 15 case-nya gagal karena menunjuk file yang sudah dihapus akan
   menghasilkan test yang tidak pernah dijalankan dan tidak pernah hijau. Pola live di
   `tests/unit/cli/dashboard/create.test.js` dipakai sebagai gantinya.

## 6. Hal yang Belum Diverifikasi

1. **Perilaku lewat binary terpasang (`npx restforge`).** Seluruh verifikasi live memakai
   `generators/cli-entry.js` langsung karena `server.js` diblokir anti-tamper dari working tree
   source (section 3.3). Rantai `server.js` → dispatch → `cli-entry.js` karena itu belum diuji
   ulang pada build hasil `build-and-bump`. Risikonya rendah karena perubahan seluruhnya berada
   di dalam contract dan handler yang di-load `cli-entry.js`, tetapi statusnya tetap belum
   terverifikasi sampai user melakukan build dan rilis.

2. **Integrasi end-to-end dengan tool MCP `codegen_validate_dashboard_payload`.** Sisi CLI kini
   menerima `--validate-only=true`, dan bentuk argumen itu diuji langsung di section 4.2. Namun
   pemanggilan nyata dari mcp-server terhadap platform hasil rilis belum dijalankan, karena
   penyelarasan sisi mcp-server adalah phase 02f dan build-and-bump adalah wewenang user.

3. **Payload dashboard kompleks.** Payload uji sengaja minimal (satu widget, satu file SQL) plus
   satu varian cacat. Payload dengan blok `cache`, cross-reference metadata, atau `params`
   bertipe banyak belum dijalankan lewat mode validate-only. Karena mode ini memakai pemanggil
   validator yang sama persis dengan jalur generate, perbedaan hasil tidak diharapkan, tetapi
   klaim itu belum diuji dengan payload besar.

4. **Butir lain issue-45.** Phase ini hanya menutup butir 1 (flag `--validate-only` tidak
   dikenal CLI). Butir 2 (resolusi argumen payload `codegen_create_dashboard`) dan butir 3
   (payload dashboard pada `codegen_validate_payload`) berada di sisi mcp-server dan tidak
   disentuh di sini. Catatan lapangan yang mungkin relevan untuk butir 2: `findPayloadFile`
   (`generators/lib/validators/payload-validator.js:206-233`) tidak menambahkan ekstensi
   `.json` sendiri, jadi `--payload=dashboard-mck` gagal sementara `--payload=dashboard-mck.json`
   berhasil. Itu cocok dengan gejala `Payload file not found: dashboard-mck` pada issue-45.

## 7. Pertanyaan untuk Orchestrator

1. **Batas versi minimum di wrapper MCP.** Rancangan issue-45 butir 1 menyebut "naikkan batas
   versi minimum di wrapper" setelah flag ditambahkan di platform. Flag ini akan ada pada rilis
   platform berikutnya setelah 5.5.5. Apakah phase 02f perlu menuliskan batas versi itu, dan bila
   ya, nomor versi mana yang dipakai mengingat bump adalah wewenang user?

2. **Temuan `--payload` tanpa ekstensi (section 6 butir 4).** Fakta ini ditemukan saat verifikasi
   lapangan dan tampaknya menjelaskan butir 2 issue-45 secara langsung. Apakah dibuatkan phase
   sendiri di sisi mcp-server (meneruskan path apa adanya), atau justru sisi platform yang
   dilonggarkan agar `findPayloadFile` mencoba menambahkan `.json`? Yang kedua berada di luar
   scope keras phase ini, jadi tidak dikerjakan.

3. **Test stale di `generators/tests/` (section 3.2).** Dua file test dashboard di sana gagal
   total sejak baseline dan folder itu tidak masuk script `test`. Apakah dijadwalkan sebagai
   phase pembersihan tersendiri (hapus atau perbaiki), atau dibiarkan sebagai backlog di luar
   campaign ini?

4. **Sinkronisasi handbook.** Flag baru ini mengubah kontrak CLI publik `dashboard create`.
   Handbook tidak disentuh sesuai instruksi phase. Perlu dipastikan phase handbook yang digate
   konfirmasi user mencakup penambahan `--validate-only` pada referensi command dashboard, agar
   tidak menjadi drift baru.
