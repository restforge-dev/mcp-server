# Report Phase 06 — Handbook: Bagian Spec MCP Server (Issue-48)

Campaign: `fix-mcp-gap-v1`. Worker phase 06. Tanggal: 2026-08-23.

Repo kerja: `restforge-handbook`, branch `campaign/fix-mcp-gap-v1`.
Commit: `a074d31`. Repo lain (`packages/mcp-server`, `restforge-skills`,
`packages/platform`) hanya dibaca, tidak diubah, tidak di-commit.

## 1. Status Checklist per Butir

- [x] Butir 1 — Folder `restforge-handbook/mcp/` berisi `README.md` + 9 halaman domain
- [x] Butir 1 lanjutan — Section "Verb yang Sengaja Tidak Di-wrap" di `mcp/README.md`
- [x] Butir 2 — Akurasi: setiap baris tabel dicek ke `packages/mcp-server/src/`; jumlah 69 cocok dengan hitungan `registerTool` di source
- [x] Butir 3 — Audiens publik: alur dan perilaku dijelaskan, nama fungsi TS / struktur `src/` / mekanisme execa tidak disebut; nama parameter dan flag CLI dipertahankan sebagai kontrak
- [x] Butir 4 — Indeks: satu entri baru di tabel "Navigasi Repo" pada `restforge-handbook/README.md`
- [x] Butir 5 — `commands/`, `catalogs/`, `examples/`, `features/` tidak disentuh
- [x] Verifikasi 1 — Audit dua arah, nol selisih
- [x] Verifikasi 2 — Grep `npm install -g @restforgejs/mcp-server` di `mcp/` → nol hasil
- [x] Verifikasi 3 — Spot-check 7 baris tabel terhadap source
- [x] Verifikasi 4 — Staging bersih: hanya file baru `mcp/` + `README.md`

## 2. File yang Dibuat/Dimodifikasi

Dibuat (semuanya di `restforge-handbook/mcp/`):

| File | Isi |
|---|---|
| `README.md` | Ikhtisar package, instalasi dan registrasi, prasyarat, tabel 9 domain, pola umum, verb yang sengaja tidak di-wrap, rujukan terkait |
| `setup.md` | 13 tool `setup_*` |
| `codegen.md` | 27 tool `codegen_*` |
| `designer.md` | 11 tool `designer_*` |
| `runtime.md` | 7 tool `runtime_*` |
| `data.md` | 2 tool `data_*` |
| `key.md` | 3 tool `key_*` |
| `project.md` | 4 tool `project_*` |
| `license.md` | 1 tool `license_*` |
| `health.md` | 1 tool `health_*` |

Dimodifikasi:

- `restforge-handbook/README.md` — satu baris tabel "Navigasi Repo": entri `mcp/`

Dibuat di luar repo handbook:

- `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-06-handbook-spec-mcp.md` (file report ini, tidak di-commit)

### 2.1 Struktur Tabel per Halaman Domain

Setiap halaman domain memakai kolom yang sama: **Tool | Verb CLI | Parameter | Catatan
perilaku**. Kolom "Verb CLI" memuat bentuk perintah yang benar-benar dieksekusi, atau frasa
"Operasi file langsung" untuk tool yang tidak memanggil CLI sama sekali. Parameter wajib
ditulis tebal, nilai default disebut di dalam kurung. Parameter `cwd` dinyatakan sekali di
pengantar tiap halaman, bukan diulang 69 kali, dengan pengecualiannya disebut eksplisit
(`health_ping` tanpa `cwd`, `setup_create_folder` memakai `parentCwd`,
`designer_get_udf_catalog` memperlakukan `cwd` sebagai opsional).

## 3. Hasil Test

Tidak ada test suite di repo handbook. Verifikasi berbentuk audit silang.

### 3.1 Audit Dua Arah

Daftar tool dari source dibangun dari literal nama pada `server.registerTool('<nama>',` di
seluruh `packages/mcp-server/src/tools/`. Daftar tool dari dokumen dibangun dari seluruh
kemunculan identifier ber-prefix domain di sembilan halaman `mcp/`. Kedua daftar
di-`sort -u` lalu dibandingkan.

```
$ grep -rn 'registerTool(' src --include=*.ts | wc -l
69

$ diff <daftar-doc> <daftar-source>
(tidak ada selisih)
```

Satu false positive muncul pada ekstraksi awal, yaitu `health_path`, yang merupakan nama
parameter `runtime_check_status` dan bukan nama tool. Setelah dikeluarkan, kedua daftar
berisi 69 entri yang identik: **nol tool tanpa spec, nol spec tanpa tool**.

### 3.2 Hitungan per Domain

| Domain | Source | Dokumen | Selisih |
|---|---|---|---|
| `setup_*` | 13 | 13 | 0 |
| `codegen_*` | 27 | 27 | 0 |
| `designer_*` | 11 | 11 | 0 |
| `runtime_*` | 7 | 7 | 0 |
| `data_*` | 2 | 2 | 0 |
| `key_*` | 3 | 3 | 0 |
| `project_*` | 4 | 4 | 0 |
| `license_*` | 1 | 1 | 0 |
| `health_*` | 1 | 1 | 0 |
| **Total** | **69** | **69** | **0** |

Angka 69 juga cocok dengan basis inventaris phase 05, dan berbeda dari angka 65 di issue-49
maupun 39 di README package `mcp-server` karena kedua angka itu ditulis sebelum phase 03 dan
04 menambahkan `project_sdk_generate`, `designer_auth_attach`, `license_info`, dan
`runtime_generate_consumer_launcher`.

### 3.3 Grep Kebijakan Install Lokal

```
$ grep -rn "npm install -g" restforge-handbook/mcp/
(nol hasil, exit 1)
```

`mcp/README.md` menempatkan `npx create-restforge-skills` sebagai jalur utama, menampilkan
entri `{"command": "npx", "args": ["-y", "@restforgejs/mcp-server"]}` sebagai bentuk manualnya,
dan menyebut binary `restforge-mcp` hanya sebagai keterangan, bukan sebagai jalur pemasangan.

### 3.4 Spot-Check Baris Tabel terhadap Source

Tujuh baris diperiksa, melampaui minimum lima, dan mencakup ketiga kategori yang diminta.

| # | Baris dokumen | Klaim | Bukti source | Verdict |
|---|---|---|---|---|
| 1 | `codegen_create_dashboard` (hardcode) | `--database` selalu dikirim, default `postgres`; `--force=true` dikirim selama `force` dibiarkan default `true` | `codegen/create-dashboard.ts:134` (`force` default `true`), `:146` (`dbType = database ?? 'postgres'`), `:218-227` (array argumen selalu memuat `--database`, `--force=true` hanya bila `force`) | Cocok |
| 2 | `codegen_create_dashboard` (dialect) | Handler `dashboard create` tidak mendeteksi `DB_TYPE` dari config, berbeda dari `endpoint create` | `codegen/create-dashboard.ts:52` dan `:127`; pembanding `codegen/create-endpoint.ts:57`, `:189-190`, `:266` (flag `--database` hanya dikirim saat parameter di-set) | Cocok |
| 3 | `codegen_validate_dashboard_payload` (kebutuhan versi) | Butuh platform yang memuat `--validate-only`, flag itu masuk source **setelah** rilis 5.5.5; platform lama menjawab `Unknown flag` dan dilaporkan sebagai kebutuhan upgrade | `codegen/validate-dashboard-payload.ts:47`, `:203` (`'--validate-only=true'` hardcode), `:221` (deteksi string `Unknown flag: --validate-only`) | Cocok |
| 4 | `runtime_generate_consumer_launcher` (launcher) | `mode=host` menulis pasangan `consumer-start`/`consumer-stop` bernama tetap; `mode=pm2` mendelegasikan ke `restforge-consumer-deploy` yang menulis `ecosystem.config.js` dan `consumer-manager.sh`; `config` wajib dan hanya `.env`; `--license`/`--license-server` tidak diekspos | `runtime/generate-consumer-launcher.ts:7-16` (`CONSUMER_LAUNCHER_FILES`), `:21` (`DEPLOY_FILES`), `:27` (`DEFAULT_DEPLOY_DIR = 'deploy'`), `:171-173` (kewajiban `--config` dan ekstensi `.env`), `:222` (deskripsi dua mode), `:371-379` (delegasi) | Cocok |
| 5 | `runtime_generate_launcher` / `runtime_check_launcher_exists` (nama file tetap) | `server-start.bat`/`server-stop.bat` untuk windows, `server-start.sh`/`server-stop.sh` untuk linux, `ecosystem.config.js` tambahan pada `mode=pm2` | `runtime/check-launcher-exists.ts:6-15` (`LAUNCHER_FILES`), `:17` (`ECOSYSTEM_FILE`), `:19-25` (`getLauncherFiles`) | Cocok |
| 6 | `key_revoke` (hardcode destruktif) | `file` wajib karena tanpanya CLI membuka pemilih file interaktif; `--yes` selalu dikirim sehingga pencabutan seketika | `key/revoke.ts:21` (deskripsi), `:72` (`['restforge','key','revoke',...,'--yes']`) | Cocok |
| 7 | `codegen_validate_sql` (bentuk verb) | Verb dipanggil sebagai dua token berspasi `query validate`, `--pretty=false` dikirim tetap | `codegen/validate-sql.ts:102-110` | Cocok |

Tambahan yang ikut diverifikasi saat penulisan: `codegen_sync_payload` menolak `expandFk`
tanpa `table` di sisi tool (`codegen/sync-payload.ts:93`), `project_delete` dan
`designer_auth_remove` sama-sama meng-hardcode flag pelewat konfirmasi
(`project/delete.ts:72`, `designer/auth-remove.ts:100`), serta `setup_install_package`
memanggil `npm install @restforgejs/platform@<version>` dengan default `beta`
(`setup/install-package.ts:44-45`, `:96`).

## 4. Verifikasi Mandiri

```
$ git -C restforge-handbook branch --show-current
campaign/fix-mcp-gap-v1
```

Status sebelum staging:

```
 M README.md                      ← perubahan phase ini (satu baris indeks)
 M api-spec/README.md             ← dirty pra-existing
 M catalogs/rdf/README.md         ← dirty pra-existing
?? api-spec/endpoint-upload.md    ← untracked pra-existing
?? catalogs/rdf/upload-config.md  ← untracked pra-existing
?? features/file-storage/         ← untracked pra-existing
?? mcp/                           ← folder baru phase ini
```

Staging (`git add mcp/ README.md`) menghasilkan tepat 10 file `A` di `mcp/` plus satu `M`
pada `README.md`. Kelima entri pra-existing tetap berstatus `M`/`??` tanpa tanda staging,
tidak dibuka, tidak diedit, dan tidak masuk commit.

Status setelah commit `a074d31`:

```
 M api-spec/README.md
 M catalogs/rdf/README.md
?? api-spec/endpoint-upload.md
?? catalogs/rdf/upload-config.md
?? features/file-storage/
```

Kelima entri itu identik dengan keadaan sebelum phase ini dimulai. Tidak ada checkout, tidak
ada perubahan branch, dan commit tidak memuat trailer co-author.

Pemeriksaan gaya bahasa pada sepuluh file baru:

- Em dash di dalam kalimat: nol kemunculan (`grep -o "—" mcp/*.md` menghasilkan 0)
- Heading: seluruhnya Indonesia murni tanpa terjemahan dalam kurung
- Bentuk berprefiks `di-` yang dipakai (`di-resolve`, `di-parse`, `di-hardcode`, `di-pull`,
  `di-push`, `di-pre-check`) sudah lebih dulu dipakai di handbook existing, sehingga
  konsisten; satu bentuk baru yang janggal (`di-lowercase`) diganti menjadi "diubah menjadi
  huruf kecil"

## 5. Keputusan Penting

1. **Struktur kolom tabel dipertahankan seragam untuk sembilan domain**, termasuk domain
   satu tool (`license_*`, `health_*`). Alternatifnya adalah menulis dua domain kecil itu
   sebagai prosa, tetapi audit dua arah bekerja dengan memindai identifier di dalam tabel,
   dan bentuk yang seragam membuat penambahan tool berikutnya tidak punya alasan untuk
   melompati format.

2. **Kolom "Verb CLI" memuat bentuk yang benar-benar dieksekusi, bukan nama verb saja.**
   Untuk `codegen_validate_dashboard_payload` misalnya, yang ditulis adalah
   `dashboard create --validate-only=true`, bukan sekadar `dashboard create`. Tanpa flag itu
   pembaca akan menyimpulkan tool ini menulis file, padahal justru sebaliknya. Konsekuensinya
   sebagian sel menjadi panjang, dan itu diterima demi kejelasan.

3. **Tool yang tidak memanggil CLI ditandai "Operasi file langsung", bukan dikeluarkan dari
   tabel.** Sebelas tool berada di kategori ini (tiga `setup_*` env, `setup_create_folder`,
   empat `runtime_*` deteksi dan launcher, `health_ping`, dan sebagian jalur
   `runtime_generate_consumer_launcher`). Menyembunyikannya akan membuat hitungan 69 tidak
   pernah cocok dengan isi dokumen.

4. **Pola lintas domain ditulis sekali di `mcp/README.md`, bukan diulang di tiap baris.**
   Precondition non-error, masking, resolusi config, konvensi payload, dan pola dua langkah
   launcher berlaku untuk banyak tool sekaligus. Mengulanginya per baris akan menggandakan
   tempat yang harus diperbarui saat pola berubah, dan justru itu jenis drift yang hendak
   dicegah issue-48.

5. **Tabel flag hardcode dibuat eksplisit di README, terpisah dari catatan per tool.**
   Empat tool mengirim flag yang menghilangkan konfirmasi CLI. Pembaca yang bertanya
   "tool mana yang bisa merusak tanpa bertanya" perlu jawabannya dalam satu tempat, bukan
   dengan menyisir sembilan halaman.

6. **Klaim default lokasi file `data_pull` dikoreksi ke apa yang bisa dibuktikan source.**
   `SKILL.md` menyebut `data-storage/<schema>/<table>.json`, sementara source tool hanya
   menegaskan folder default `data-storage`. Karena akurasi adalah kriteria utama phase ini
   dan struktur sub-folder tidak terbukti dari `packages/mcp-server/src/`, dokumen menyebut
   folder default saja. Selisih ini dicatat di section 7 butir 3.

7. **Indeks handbook ditambah satu baris saja.** Tabel "Navigasi Repo" di `README.md` root
   sebenarnya sudah tidak lengkap sejak sebelum campaign ini (`features/` dan `quickstart/`
   tidak terdaftar), tetapi merapikannya bukan scope phase 06 dan akan mengaburkan diff.

8. **Deskripsi tool tidak disalin mentah.** Deskripsi di source ditulis untuk agent dan
   memuat blok `USE WHEN`, `DO NOT USE FOR`, dan `PRESENTATION GUIDANCE` yang tidak relevan
   bagi pembaca handbook. Yang diangkat hanya fakta perilaku: verb, flag, default, sifat
   destruktif, dan syarat versi.

## 6. Hal yang Belum Diverifikasi

1. **Eksekusi nyata tool dari client MCP.** Seluruh isi dokumen diturunkan dari pembacaan
   source `packages/mcp-server/src/` dan report phase 00-05, bukan dari round-trip lewat
   client MCP sungguhan. Keterbatasan yang sama tercatat di report 02b sampai 04.

2. **Daftar flag CLI lengkap per verb.** Yang diverifikasi adalah flag yang benar-benar
   dikirim tool. Flag CLI yang ada di contract platform tetapi tidak diekspos MCP tidak
   didaftar ulang di halaman `mcp/`, karena rujukannya adalah `commands/`. Kelengkapan
   `commands/` sendiri adalah cakupan phase 07.

3. **Struktur sub-folder keluaran `data pull`.** Belum diketahui apakah bentuk sebenarnya
   `data-storage/<table>.json` (sesuai judul deskripsi tool) atau
   `data-storage/<schema>/<table>.json` (sesuai `SKILL.md`). Keduanya klaim turunan; source
   `packages/platform` belum ditelusuri untuk memastikan.

4. **Angka "63 parameter" pada `db-connection.env`.** Disebut di README package `mcp-server`,
   sengaja tidak diangkat ke handbook karena tidak diverifikasi ke source config schema.

5. **Ambang versi minimum platform untuk seluruh domain.** Yang tercatat di dokumen hanya dua
   kasus yang memang punya bukti: `query validate` bentuk spasi (ada di 5.5.5, ambang minimum
   belum ditetapkan) dan `dashboard create --validate-only` (masuk source setelah 5.5.5).
   Tool lain tidak diberi keterangan versi karena datanya tidak ada.

6. **Kesesuaian tiap sel tabel dengan halaman `commands/` yang bersangkutan.** Perbandingan
   dilakukan terhadap source MCP, bukan terhadap teks handbook `commands/`, karena koreksi
   drift di sana justru pekerjaan phase 07. Bila `commands/` dikoreksi, sel yang menyebut
   perilaku CLI perlu dibaca ulang sekali.

## 7. Pertanyaan untuk Orchestrator

1. **Drift yang ditemukan tetapi tidak dikerjakan (aturan strict per-phase).** Tiga temuan
   layak masuk backlog phase 07 atau issue baru:
   - `packages/mcp-server/README.md` masih menyebut **39 tool**, mendaftar 9 tool `setup_*`
     dan 23 tool `codegen_*`, dan menempatkan `npm install -g @restforgejs/mcp-server`
     sebagai jalur instalasi. Ketiganya bertentangan dengan keadaan sekarang (69 tool) dan
     dengan kebijakan install lokal. File ini di luar repo handbook, jadi tidak disentuh.
   - `restforge-handbook/commands/restforge-backend/README.md` menulis verb runtime sebagai
     `license-info` dan `license-deactivate` (bentuk nama file), sedangkan halaman detailnya
     sendiri benar (`npx restforge license info`). Kandidat koreksi kecil phase 07.
   - Tabel "Navigasi Repo" di `restforge-handbook/README.md` tidak memuat `features/` dan
     `quickstart/`. Pre-existing, tidak dirapikan di sini.

2. **Apakah halaman `mcp/` perlu mencantumkan versi package.** Saat ini
   `@restforgejs/mcp-server` berada di 1.3.0 sementara empat tool baru phase 03-04 belum
   dirilis. Menyebut nomor versi membuat dokumen lebih presisi tetapi juga membuatnya basi
   setiap rilis. Opsi: (a) tanpa versi seperti sekarang, (b) satu baris "berlaku untuk versi
   X ke atas" di README `mcp/`, (c) kolom versi minimum per tool untuk yang punya syarat.

3. **Bentuk default path `data pull`** (section 6 butir 3). Bila orchestrator menginginkan
   kepastian, penelusuran singkat ke `packages/platform` sudah cukup, dan satu sel di
   `mcp/data.md` yang perlu disesuaikan.

4. **Apakah `mcp/` perlu ditautkan juga dari `commands/README.md`.** Kontrak phase meminta
   penambahan indeks minimal, dan yang diambil adalah `README.md` root saja. Tautan silang
   dari `commands/` masuk akal karena mayoritas tool membungkus verb di sana, tetapi
   `commands/` termasuk folder yang dilarang disentuh phase ini.

5. **Nasib angka 69 saat tool berikutnya ditambahkan.** Angka itu kini tertulis di
   `mcp/README.md` dan menjadi acuan audit. Perlu dipastikan apakah phase acceptance atau
   automasi CI yang akan menegakkan kecocokannya, agar angka itu tidak berubah menjadi
   sumber drift baru.
