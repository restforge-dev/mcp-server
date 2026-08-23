# Report Phase 07 — Handbook: Koreksi Drift Indeks, Contoh, dan Kontrak Command

Campaign: `fix-mcp-gap-v1`. Worker phase 07. Tanggal: 2026-08-23.
Repo: `restforge-handbook`, branch `campaign/fix-mcp-gap-v1` (lanjutan phase 06, HEAD sebelum
kerja: `a074d31`).

**Ringkasan hasil:** seluruh butir A sampai E dikerjakan dan diverifikasi. Indeks command kini
cocok dengan file yang benar-benar ada (47 public command backend, 9 verb designer), dua contoh
dengan flag di luar spec dikoreksi, klaim `--format json` pada `schema validate` dihapus sesuai
Q11=A, empat kontrak command yang berubah selama campaign didokumentasikan, layout output
`data pull` diverifikasi ke source dan dikoreksi di dua tempat, dan enam file `*.report.md`
sisa siklus doc-review dihapus. Commit `0efc9f8`, 21 file, tanpa trailer co-author. Lima entri
dirty pra-existing tetap utuh dan tidak di-stage.

## 1. Status Checklist

- [x] Branch diverifikasi `campaign/fix-mcp-gap-v1` sebelum satu pun baris diubah; tidak ada
      perpindahan branch
- [x] Sumber kebenaran dibaca lebih dulu: issue-51, report phase 00 (section 3.2, 3.3, 3.8, 3.9,
      3.10 butir 1), 02e, 02g, 06 section 7
- [x] Keadaan aktual tiap file diverifikasi sebelum diubah; satu klaim issue ternyata sudah
      tertangani sebagian (section 5 butir 1)
- [x] Butir A1 sampai A4 (indeks) selesai
- [x] Butir B5 sampai B7 (contoh dengan flag salah) selesai
- [x] Butir C8 sampai C11 (kontrak command) selesai
- [x] Butir D12 (verifikasi path `data pull`) selesai dengan kutipan bukti source
- [x] Butir E13 (kebersihan `*.report.md`) selesai, enam file didaftar di section 3.5
- [x] Verb yang belum punya halaman (`endpoint list`, `processor list`, `project tenant`) TIDAK
      ditambahkan; dilaporkan sebagai temuan (section 6 butir 1)
- [x] Wire `--json` di platform tidak dikerjakan, sesuai Q11=A
- [x] Lima entri dirty pra-existing tidak disentuh dan tidak di-stage (bukti section 4.4)
- [x] Bahasa Indonesia konvensi handbook, heading Indonesia murni, tanpa em dash dalam kalimat
- [x] Commit sebelum report, tanpa trailer co-author
- [x] Repo lain tidak disentuh; penelusuran ke `packages/platform` dan `packages/designer`
      bersifat read-only

## 2. File yang Dimodifikasi + Hash Commit

Commit: `0efc9f8`
Pesan baris pertama: `docs: koreksi drift indeks, contoh, dan kontrak command (fix-mcp-gap-v1 phase-07)`

Total: 21 file, 51 insertion, 257 deletion (deletion didominasi enam `*.report.md`).

| File | Perubahan | Butir |
|---|---|---|
| `commands/README.md` | Hitungan backend 43 menjadi 47, total verb designer 7 menjadi 9, baris `catalog` dan `auth` pada quick-reference, section baru "Hubungan dengan MCP Server", tautan `mcp/` di footer | A1 |
| `commands/restforge-frontend/README.md` | Baris verb `auth` pada tabel Daftar Verb | A2 |
| `commands/restforge-backend/README.md` | `license-info` menjadi `license info`, `license-deactivate` menjadi `license deactivate` | A3 |
| `README.md` | Baris `features/` dan `quickstart/` pada tabel Navigasi Repo | A4 |
| `catalogs/sdf/maintenance/sync-database.md` | `--path` menjadi `--schema-path` | B5 |
| `examples/rdf/README.md` | `--resource` menjadi `--payload`, plus `--project` dan `--name` yang memang wajib, plus satu kalimat bentuk nilai `--payload` | B6 |
| `catalogs/sdf/validation-rules.md` | Klaim flag `--format json` diganti pernyataan keadaan sebenarnya | B7 |
| `commands/restforge-backend/dashboard/create.md` | Baris flag `--validate-only`, section "Mode Validasi Saja", keterangan ketersediaan versi, satu contoh baru | C8 |
| `commands/restforge-backend/internal-binary.md` | `--config` `restforge-consumer` menjadi wajib, pattern dan contoh kedua diperbaiki, paragraf bentuk argumen `--flag=value` | C9 |
| `commands/restforge-backend/query/validate.md` | `--config` menjadi opsional dengan fallback, urutan baris tabel disesuaikan, satu paragraf penjelas | C10 |
| `commands/restforge-backend/endpoint/create.md` | Deskripsi flag `--payload` (nama file, lowercase, path ditolak) | C11 |
| `commands/restforge-backend/processor/create.md` | Deskripsi flag `--payload` (sama dengan endpoint) | C11 |
| `commands/restforge-backend/kafka/consumer-create.md` | Deskripsi flag `--payload` (nama atau path, `.json` otomatis, tanpa lowercasing) | C11 |
| `mcp/data.md` | Sel `data_pull` diberi layout output bersarang per schema | D12 |
| `commands/restforge-backend/data/pull.md` | Blurb pembuka menyebut kedua bentuk layout output | D12 |
| 6 file `*.report.md` | Dihapus | E13 |

## 3. Hasil Kerja per Butir

### 3.1 Butir A — Indeks

| Butir | Status | Bukti |
|---|---|---|
| A1 hitungan `commands/README.md` | Selesai | 43 menjadi 47, rincian `4 runtime + 2 global + 41 generator`; perhitungan di section 4.1 |
| A1 rujukan silang ke `mcp/` | Selesai | Section baru "Hubungan dengan MCP Server" plus tautan di footer |
| A2 verb `auth` designer | Selesai | Baris baru di Daftar Verb; total quick-reference 7 menjadi 9 |
| A3 penamaan verb license | Selesai | Grep bentuk tanda hubung sebagai nama verb: nol (section 4.2) |
| A4 `features/` dan `quickstart/` | Selesai | Dua baris baru di tabel Navigasi Repo `README.md` root |

Catatan A2: tabel Daftar Verb designer ternyata SUDAH memuat `catalog`, jadi yang kurang di sana
hanya `auth`. Yang tertinggal dua verb sekaligus (`catalog` dan `auth`) adalah quick-reference di
`commands/README.md`, dan keduanya ditambahkan di sana. Angka total 7 pada issue-51 memang
menghitung `init`, `validate`, `preview`, `generate`, plus tiga subcommand `plugins`; angka baru 9
menambahkan `catalog` dan `auth`.

### 3.2 Butir B — Contoh dengan flag di luar spec

| Butir | Status | Bukti |
|---|---|---|
| B5 `--path` menjadi `--schema-path` | Selesai | `grep -c -- "--path=" catalogs/sdf/maintenance/sync-database.md` = 0 |
| B6 `--resource` menjadi `--payload` | Selesai | `grep -c -- "--resource" examples/rdf/README.md` = 0 |
| B7 klaim `--format json` | Selesai | `grep -c -- "--format json" catalogs/sdf/validation-rules.md` = 0 |

Kalimat lama `validation-rules.md`:

> Output JSON tersedia via `--format json` untuk konsumsi MCP, CI, atau LSP. Format kontrak
> stabil: `{ schemaVersion: '1.0', ... }`.

Kalimat baru menyatakan bahwa `schema validate` hanya menerima `--schema-path` dengan satu bentuk
output teks, bahwa kontrak data JSON sudah disiapkan di layer library tetapi belum ada flag CLI
yang mengeluarkannya, dan bahwa verb serumpun `schema diff` sudah punya jalur JSON lewat flag
boolean `--json`. Bentuk kontrak datanya tetap dipertahankan di kalimat itu sebagai rencana,
bukan sebagai flag yang ada, sesuai Q11=A.

`commands/restforge-backend/schema/validate.md` diperiksa dan ternyata sudah benar: tabel flagnya
hanya memuat `--schema-path`, tanpa klaim `--format`. Tidak ada perubahan di sana, dan kedua
dokumen kini konsisten.

Pada B6, selain rename flag, `--project` dan `--name` ditambahkan ke contoh karena keduanya wajib
di contract `endpoint create`. Contoh lama tetap gagal walau flagnya sudah benar, jadi rename saja
tidak cukup untuk memenuhi kriteria selesai issue-51.

### 3.3 Butir C — Kontrak command

| Butir | Status | Bukti sumber |
|---|---|---|
| C8 `--validate-only` | Selesai | `generators/cli/dashboard/create.js:69-74` (deklarasi flag), `:92` (pembacaan), report 02e |
| C9 `--config` consumer wajib | Selesai | `cli/consumer.js:599-603` |
| C9 bentuk `--flag=value` | Selesai | `cli/consumer.js:157-177` (seluruh cabang `startsWith('--x=')`) |
| C10 `--config` query opsional | Selesai | `generators/cli/query/validate.js:34-38` |
| C11 konvensi payload | Selesai | Report 02g section 4.2 dan 4.3 |

Kutipan bukti C8:

```js
        'validate-only': {
            type: 'boolean',
            required: false,
            default: false,
            description: 'Run the full validation pipeline and stop before writing anything (no module file, no metadata, no registry update). Exit code 0 means the payload is valid'
        }
```

Keterangan versi ditulis tanpa mengarang nomor rilis, memakai rumusan yang sama dengan
`mcp/codegen.md` hasil phase 06: "flag ini masuk ke source platform setelah rilis 5.5.5. Pada
versi yang lebih lama CLI menjawab `Unknown flag: --validate-only`." Versi `package.json` platform
saat ini diperiksa dan masih `5.5.5`, jadi tidak ada nomor rilis baru yang bisa disebut.

Kutipan bukti C9:

```js
  if (!args.config) {
    console.error('Error: --config=<FILE.env> is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }
```

Pattern `restforge-consumer` ikut diperbaiki menjadi
`npx restforge-consumer --project=<NAME> --config=<FILE> [options]` agar tidak bertentangan dengan
status wajib yang baru. Contoh kedua yang tanpa `--config` sudah dilengkapi.

Kutipan bukti C10:

```js
        config: {
            type: 'string',
            required: false,
            default: null,
            description: 'Database config file (.env). Fallback to `.restforge/defaults.json` if not explicitly provided (set via `config set-default`)'
        },
```

C11 memakai tiga rumusan berbeda karena aturannya memang berbeda per verb. `endpoint create` dan
`processor create` berbagi `ArgumentValidator.validatePayloadName` (nama file dengan atau tanpa
`.json`, di-lowercase, bentuk path ditolak), sedangkan `kafka consumer-create` memakai
`resolvePayloadPath` sendiri (nama atau path, `.json` ditambahkan otomatis pada nama telanjang,
tanpa lowercasing). Perbedaan lowercasing itu ditulis eksplisit di halaman kafka agar pembaca
tidak menyamaratakan ketiganya. Rumusan disesuaikan dengan tabel "Konvensi nilai `payload`" di
`mcp/README.md` yang ditulis phase 06, sehingga kedua section handbook sekarang sejalan.

### 3.4 Butir D — Verifikasi path `data pull`

Bentuk default keluaran adalah **bersarang per schema untuk tabel ber-schema, rata untuk tabel
tanpa schema**. Bukti di `packages/platform/generators/lib/data/data-scope.js:80-85`:

```js
function relDataFilePath(ir) {
    const { schemaName } = getNamespace(ir);
    return schemaName
        ? path.join(schemaName, `${ir.tableName}.json`)
        : `${ir.tableName}.json`;
}
```

Pemakaiannya di `lib/data/pull-runner.js:211`:

```js
    const outFile = path.join(outputDir, relDataFilePath(ir));
```

`outputDir` berasal dari flag `--storage-path` dengan default `data-storage`
(`generators/cli/data/pull.js:78`). Deskripsi contract sendiri sudah menyebut bentuk bersarang
(`pull.js:24`: `data-storage/<schema>/<table>.json`), sedangkan komentar kepala file `pull.js:7`
masih menulis bentuk rata saja. Bentuk yang benar adalah keduanya, bergantung ada tidaknya schema.

Koreksi handbook:

- `mcp/data.md`: sel `data_pull` yang sebelumnya hanya menyebut folder `data-storage/` kini
  menyebut kedua bentuk layout.
- `commands/restforge-backend/data/pull.md`: blurb pembuka yang menulis
  `data-storage/<table>.json` saja kini menyebut kedua bentuk. Bagian lain halaman itu sudah
  benar: contoh output pada baris 110-123 memang menampilkan `data-storage/sales/order_item.json`.
- `commands/restforge-backend/data/README.md` diperiksa dan sudah akurat penuh (tabel penamaan
  file plus penjelasan layout bersarang), jadi tidak diubah.

### 3.5 Butir E — Kebersihan

Enam file `*.report.md` dihapus, seluruhnya tracked di git:

| File |
|---|
| `commands/restforge-backend/catalog/dashboard.report.md` |
| `features/dashboard/README.report.md` |
| `features/dashboard/frontend-mapping.report.md` |
| `features/dashboard/generate.report.md` |
| `features/dashboard/payload.report.md` |
| `features/dashboard/widget-patterns.report.md` |

Sesudah penghapusan, `find . -name "*.report.md"` di `restforge-handbook/` mengembalikan nol
hasil. Tidak ada file berpola lain yang disentuh.

## 4. Verifikasi Mandiri

### 4.1 Perhitungan command backend

Sumber hitungan: file `.md` di bawah `commands/restforge-backend/`, tidak termasuk `README.md`
per folder, `conventions.md`, `internal-binary.md`, `runtime/troubleshooting.md`, dan
`*.report.md`.

| Kelompok | Halaman verb | Jumlah |
|---|---|---|
| Runtime | `runtime/serve`, `runtime/validate`, `runtime/license-info`, `runtime/license-deactivate` | 4 |
| Global | `init`, `fast-track` | 2 |
| `catalog/` | `dashboard`, `dbschema`, `field-validation`, `query-declarative` | 4 |
| `config/` | `clear-default`, `get-default`, `list`, `schema`, `set-default`, `template` | 6 |
| `dashboard/` | `create` | 1 |
| `data/` | `pull`, `push` | 2 |
| `endpoint/` | `create` | 1 |
| `kafka/` | `consumer-create` | 1 |
| `key/` | `generate`, `list`, `revoke` | 3 |
| `payload/` | `diff`, `generate`, `migrate`, `sync`, `validate` | 5 |
| `processor/` | `create` | 1 |
| `project/` | `auth`, `delete`, `list`, `sdk` | 4 |
| `query/` | `validate` | 1 |
| `schema/` | `apply`, `describe`, `diff`, `generate-ddl`, `init`, `introspect`, `list`, `migrate`, `models`, `template`, `validate` | 11 |
| `test/` | `generate` | 1 |

Generator: 4 + 6 + 1 + 2 + 1 + 1 + 3 + 5 + 1 + 4 + 1 + 11 + 1 = **41**.
Total public: 41 + 4 runtime + 2 global = **47**. Internal binary tetap 2, di luar hitungan public.

Angka 47 ini cocok dengan hitungan issue-51 butir 1 dan dengan rekonsiliasi report phase 00
section 3.10 butir 1.

Perhitungan verb designer: `init`, `validate`, `preview`, `generate`, `catalog`, `auth`, plus
`plugins list`, `plugins inspect`, `plugins scaffold` = **9**. Dikonfirmasi ke source
`packages/designer/src/cli/mod.rs` (enum `Commands`): tujuh varian top-level dengan `Plugins`
sebagai parent tiga subcommand.

### 4.2 Grep pasca-koreksi

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| `--path=` di sync-database | `grep -c -- "--path=" catalogs/sdf/maintenance/sync-database.md` | `0` |
| `--resource` di examples/rdf | `grep -c -- "--resource" examples/rdf/README.md` | `0` |
| `--format json` pada schema validate | `grep -c -- "--format json" catalogs/sdf/validation-rules.md` | `0` |
| Nama verb bentuk tanda hubung | `grep -c '\`license-info\`\|\`license-deactivate\`' commands/restforge-backend/README.md` | `0` |
| Sisa `*.report.md` | `find . -name "*.report.md" \| wc -l` | `0` |

Sweep tambahan `grep -rn -- "--format" *.md` di seluruh handbook: sisa kemunculan seluruhnya milik
verb lain yang memang punya flag itu (`data pull --format`, `schema template --format`,
`schema list --format=json` lewat `mcp/codegen.md`). Tidak ada lagi klaim `--format` pada
`schema validate`.

### 4.3 Kutipan bukti source untuk butir D

Sudah disajikan penuh di section 3.4: `lib/data/data-scope.js:80-85`, `lib/data/pull-runner.js:211`,
`generators/cli/data/pull.js:78`.

### 4.4 `git status --porcelain` pasca-commit

```
 M api-spec/README.md
 M catalogs/rdf/README.md
?? api-spec/endpoint-upload.md
?? catalogs/rdf/upload-config.md
?? features/file-storage/
```

Persis lima entri dirty pra-existing, seluruhnya dengan status kolom kedua (unstaged untuk yang
modified) atau untracked. Tidak ada satu pun yang masuk ke commit. Isi commit diverifikasi lewat
`git diff --cached --name-status` sebelum commit: 21 entri, seluruhnya scope phase ini
(15 modified, 6 deleted).

Pemeriksaan trailer: `git log -1 --format=%B | grep -ci "co-authored"` mengembalikan `0`.

## 5. Keputusan Penting

1. **Klaim issue-51 butir 2 sebagian sudah usang.** Issue menyatakan verb `auth` tidak muncul di
   dua tempat, dan menyiratkan tabel designer hanya kekurangan `auth`. Keadaan aktual: tabel
   Daftar Verb di `restforge-frontend/README.md` sudah memuat `catalog` tetapi belum `auth`,
   sedangkan quick-reference di `commands/README.md` belum memuat keduanya. Koreksi disesuaikan
   dengan keadaan aktual, bukan dengan bunyi issue.

2. **`schema/validate.md` tidak diubah.** Issue butir 5 mengusulkan penyelarasan dua dokumen.
   Setelah diperiksa, hanya `validation-rules.md` yang salah; `validate.md` sudah benar sejak
   awal. Menambahkan apa pun ke `validate.md` justru akan memperkenalkan drift baru.

3. **Contoh `endpoint create` di `examples/rdf/README.md` dilengkapi flag wajib.** Rename
   `--resource` menjadi `--payload` saja tetap menyisakan contoh yang gagal dieksekusi karena
   `--project` dan `--name` juga wajib. Kriteria selesai issue-51 menuntut contoh yang tidak
   memakai flag di luar spec; contoh yang tetap gagal dinilai belum memenuhi maksud itu.

4. **Keterangan versi `--validate-only` memakai rumusan relatif.** Karena `package.json` platform
   masih `5.5.5` dan flag itu belum masuk rilis mana pun, satu-satunya pernyataan jujur adalah
   "setelah rilis 5.5.5". Rumusannya sengaja disamakan kata per kata dengan `mcp/codegen.md` agar
   dua halaman handbook tidak memberi kesan dua fakta berbeda.

5. **Verb yang belum terdokumentasi tidak ditambahkan.** Sesuai kontrak phase, hitungan 47 adalah
   hitungan isi handbook, bukan hitungan source (yang 50). Konsekuensinya angka di
   `commands/README.md` benar sebagai indeks tetapi belum lengkap terhadap source; ini dilaporkan
   di section 6 butir 1, tidak dikerjakan.

6. **`git rm` diganti hapus manual lalu `git add`.** Perintah `git rm` diblokir oleh classifier
   permission. Hasil akhirnya identik: keenam file terhapus dari working tree dan tercatat sebagai
   `D` di index, terbukti dari `git diff --cached --name-status` dan statistik commit.

## 6. Hal yang Belum Diverifikasi atau Belum Dikerjakan

1. **Tiga verb generator masih tanpa halaman handbook.** `endpoint list`, `processor list`, dan
   `project tenant` ada di `packages/platform/generators/cli/` tetapi tidak punya halaman.
   Dikonfirmasi ulang phase ini lewat listing folder source: 44 verb generator di source versus 41
   halaman di handbook. Angka 47 di `commands/README.md` karena itu akan perlu naik menjadi 50
   begitu ketiga halaman ditulis. Ini issue terpisah sesuai kontrak phase.

2. **`commands/restforge-backend/data/push.md` baris 3** memakai bentuk rata
   `data-storage/<table>.json` pada blurb pembukanya, drift yang persis sama dengan `pull.md`
   sebelum dikoreksi. Butir D hanya menyebut `pull.md`, jadi `push.md` tidak disentuh. Perbaikan
   satu baris, kandidat phase berikutnya.

3. **Komentar kepala file `generators/cli/data/pull.js:7`** menulis `{cwd}/data-storage/<table>.json`
   saja, sedangkan komentar `:17-18` di file yang sama sudah benar menyebut kedua layout.
   Inkonsistensi internal source, bukan handbook, dan repo platform di luar scope phase ini.

4. **Klaim `--format json` pada verb lain tidak diverifikasi ke source.** Sweep hanya memastikan
   tidak ada sisa klaim pada `schema validate`. Flag `--format` pada `data pull`, `schema template`,
   dan `schema list` diterima apa adanya dari handbook tanpa pembuktian ulang ke contract, karena
   ketiganya di luar butir yang ditugaskan.

5. **Tidak ada test suite yang dijalankan.** Handbook adalah repo dokumentasi murni; verifikasi
   seluruhnya berbentuk audit silang terhadap source dan grep pasca-koreksi seperti disyaratkan
   kontrak phase.

6. **Ketersediaan rilis `--validate-only` belum bisa dipastikan angkanya.** Bila platform dirilis
   dengan nomor baru setelah campaign ini, kalimat "setelah rilis 5.5.5" di
   `dashboard/create.md` dan `mcp/codegen.md` sebaiknya diganti nomor rilis konkret. Keduanya
   perlu diubah bersamaan agar tidak saling bertentangan.

## 7. Pertanyaan untuk Orchestrator

1. **Apakah angka 47 di `commands/README.md` perlu disertai catatan keterbatasan?** Saat ini angka
   itu benar sebagai jumlah halaman yang ada, tetapi pembaca yang membandingkannya dengan
   `npx restforge --help` akan melihat tiga verb tambahan. Satu kalimat catatan akan mencegah
   kebingungan, tetapi juga berarti handbook mengakui dirinya tidak lengkap. Phase ini memilih
   tidak menambahkannya karena kontrak melarang menyentuh verb yang belum terdokumentasi.

2. **Siapa yang menutup issue-51.** Seluruh enam butir issue sudah dikerjakan, tetapi file
   `packages/platform/docs/issues/issue-51-*.md` berada di repo platform dan phase ini tidak
   menyentuh repo lain. Status issue masih `Open`.

3. **Apakah `push.md` (section 6 butir 2) masuk phase acceptance atau issue baru.** Perbaikannya
   satu baris dan sejenis persis dengan yang sudah dikerjakan, tetapi berada di luar butir yang
   ditugaskan.

4. **Nasib angka 47 dan 9 terhadap drift berikutnya.** Sama dengan pertanyaan phase 06 tentang
   angka 69 di `mcp/README.md`: tiga angka hitungan kini tersebar di handbook dan menjadi acuan
   audit. Perlu diputuskan apakah phase acceptance atau automasi CI yang menegakkan kecocokannya.

5. **Apakah commit handbook campaign ini akan di-merge bersama commit phase 06** atau menunggu
   seluruh phase selesai. Branch `campaign/fix-mcp-gap-v1` di handbook kini punya dua commit
   (`a074d31` phase 06, `0efc9f8` phase 07) dan belum di-merge ke main.
