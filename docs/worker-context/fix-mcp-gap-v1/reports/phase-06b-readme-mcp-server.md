# Report Phase 06b — README Package `@restforgejs/mcp-server`

Campaign: `fix-mcp-gap-v1`. Worker phase 06b. Tanggal: 2026-08-23.

Repo kerja: `packages/mcp-server`, branch `campaign/fix-mcp-gap-v1`.
Commit: `89d7017`. Repo lain (`restforge-handbook`, `packages/platform`)
hanya dibaca, tidak diubah, tidak di-commit.

## 1. Status Checklist per Butir

- [x] Butir 1 — Jumlah tool diperbarui 39 → 69, daftar per-tool diganti tabel 9 domain
- [x] Butir 1 lanjutan — Rujukan ke `mcp/` handbook sebagai spec lengkap, tanpa duplikasi 69 baris
- [x] Butir 2 — `npm install -g` dihapus, diganti jalur npx; binary `restforge-mcp` jadi alternatif
- [x] Butir 3 — Koreksi klaim lain: versi Node, daftar database, prasyarat install lokal, angka `63 parameters`
- [x] Butir 4 — Bahasa README tetap Inggris (tidak diganti)

## 2. File yang Dibuat/Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `packages/mcp-server/README.md` | Modifikasi | 63 insertions, 93 deletions |

Tidak ada file lain yang disentuh. Folder `docs/worker-context/` tetap untracked
dan tidak di-stage.

### Rincian perubahan

**Section "Requirements"**

| Klaim lama | Klaim baru | Bukti koreksi |
|---|---|---|
| `Node.js >= 20` | `Node.js >= 18` | `package.json` → `engines.node: ">=18"` |
| `npm >= 9` | dihapus | Tidak ada `engines.npm` di `package.json`; klaim tanpa dasar |
| `PostgreSQL / MySQL / Oracle` | `PostgreSQL, MySQL, Oracle, atau SQLite` | `src/tools/codegen/create-endpoint.ts:128` dan 3 file lain: `.enum(['postgres','oracle','mysql','sqlite'])` |
| (tidak ada) | Syarat `@restforgejs/platform` terpasang lokal di `node_modules` project target | Handbook `mcp/README.md` tabel Prasyarat; hampir semua tool menjalankan `npx restforge ...` di dalam folder project |

**Section "Access & License"**

- Daftar domain yang butuh license dipertegas mengikuti handbook: seluruh `codegen_*`,
  `runtime_*`, `data_*`, plus `setup_validate_config`. README lama hanya menyebut
  `setup_validate_config`, `codegen_*`, `runtime_*` (melewatkan `data_*`).
- Ditambahkan keterangan bahwa domain `designer_*` berjalan tanpa license karena
  mekanisme license sudah dilepas dari binary `restforge-designer`.

**Section "Installation" → "Installation & Registration"**

- Blok `npm install -g @restforgejs/mcp-server` dan kalimat "the `restforge-mcp` command
  is available in PATH" dihapus sebagai jalur utama.
- Jalur utama sekarang `npx create-restforge-skills`, disertai snippet entri MCP
  (`"command": "npx", "args": ["-y", "@restforgejs/mcp-server"]`) untuk registrasi manual.
- Binary `restforge-mcp` dipertahankan sebagai paragraf **Alternative** dengan penanda
  eksplisit "not the recommended installation path" dan syarat "only resolves when the
  package is already present in the environment that launches the client".

**Section "Quick Start"**

- Perintah verifikasi `... | restforge-mcp` diganti `... | npx -y @restforgejs/mcp-server`.
- Ekspektasi output `39 tools across the health_*, setup_*, codegen_*, and runtime_*
  domains` diganti `69 tools across the nine domains` (daftar domain lama hanya menyebut
  4 dari 9 domain yang ada).
- Registrasi Claude CLI: `-- restforge-mcp` → `-- npx -y @restforgejs/mcp-server`.
- Config Cursor dan Claude Desktop: `"command": "restforge-mcp"` → bentuk npx + args.

**Section "Available Tools"**

- Empat tabel per-tool (Health 1, Setup 9, Codegen 23, Runtime 6 = 39 baris) diganti satu
  tabel 9 domain berisi kolom Domain / Count / Coverage / Representative tools.
- Ditambahkan paragraf rujukan ke section `mcp/` handbook sebagai spec per-tool lengkap,
  plus catatan bahwa surface live selalu bisa ditemukan lewat MCP `tools/list`.
- Ditambahkan kalimat kontrak publik nama tool (drift bila tool berubah tanpa update handbook).
- Ditambahkan subsection "Cross-domain behaviour worth knowing" berisi 4 pola dari handbook:
  parameter `cwd`, precondition bukan error, flag hardcode pada tool destruktif, masking
  field sensitif.
- Catatan "Runtime principle" dipertahankan, ditambah kalimat pola dua langkah untuk
  `runtime_generate_consumer_launcher`.

**Koreksi klaim tersembunyi**

- Deskripsi `setup_get_config_schema` di README lama menyebut "all **63 parameters**
  available in `db-connection.env`". Angka itu tidak lagi ada di source:
  `src/tools/setup/get-config-schema.ts:12` berbunyi "Get JSON schema of all parameters
  available in db-connection.env template" tanpa angka. Baris per-tool tersebut ikut hilang
  saat tabel diringkas jadi tabel domain, sehingga angka basi tidak lagi terbawa.
- README lama sama sekali tidak menyebut 5 domain: `designer_*` (11), `project_*` (4),
  `key_*` (3), `data_*` (2), `license_*` (1). Total 21 tool tidak terdokumentasi.
- Selain jumlah domain yang hilang, domain yang terdaftar pun kurang hitung:
  Setup 9 vs aktual 13, Codegen 23 vs aktual 27, Runtime 6 vs aktual 7.

## 3. Hasil Test

Tidak ada test yang relevan untuk phase ini. Perubahan sepenuhnya dokumen
(`README.md`), tanpa perubahan pada `src/`, `package.json`, maupun konfigurasi build.

Sesuai kontrak phase, `npm run build` tidak dijalankan karena tidak diperlukan:
tidak ada file TypeScript yang berubah, sehingga output `dist/` tidak terpengaruh.

## 4. Verifikasi Mandiri

### Verifikasi 1 — `npm install -g` nol hasil

```
$ grep -n "install -g" README.md
(exit 1, tidak ada match)
```

Nol hasil, bukan "hanya dalam konteks alternatif". Frasa install global sudah hilang
sepenuhnya dari README. Yang tersisa sebagai alternatif adalah binary `restforge-mcp`,
dan itu ditulis sebagai pilihan nilai `"command"` pada config MCP client, bukan sebagai
perintah instalasi global.

Grep kontrol untuk angka basi lain:

```
$ grep -n "39 tools\|63 parameters\|Node.js >= 20" README.md
(exit 1, tidak ada match)
```

### Verifikasi 2 — Angka tool cocok dengan hitungan `registerTool`

Hitungan di source:

```
$ grep -roh "registerTool" src/ | wc -l
69
```

Per domain:

```
$ for d in codegen data designer health key license project runtime setup; do \
    n=$(grep -roh "registerTool" src/tools/$d/ | wc -l); echo "$d: $n"; done
codegen: 27
data: 2
designer: 11
health: 1
key: 3
license: 1
project: 4
runtime: 7
setup: 13
```

Jumlah: 27 + 2 + 11 + 1 + 3 + 1 + 4 + 7 + 13 = **69**.

Angka di README:

```
$ grep -n "69" README.md
64:Output should list 69 tools across the nine domains described in [Available Tools](#available-tools).
114:69 tools grouped into nine domains by name prefix. ...
128:... this table is a summary and deliberately does not restate all 69 rows. ...
```

Kolom Count pada tabel domain README: setup 13, codegen 27, designer 11, runtime 7,
project 4, key 3, data 2, license 1, health 1. Sama persis dengan hitungan per domain
di atas, dan jumlahnya 69.

Cocok pula dengan tabel domain di `restforge-handbook/mcp/README.md:63-71` (hasil phase 06),
sehingga README package dan handbook tidak saling bertentangan.

Nama tool pada kolom "Representative tools" diambil dari ekstraksi argumen pertama
`registerTool` di `src/tools/`, bukan dari ingatan, sehingga tidak ada nama karangan.
Contoh yang dipakai semuanya ada di daftar aktual (mis. `project_sdk_generate`,
`runtime_generate_consumer_launcher`, `designer_auth_create`).

### Verifikasi 3 — `git status --porcelain` sebelum commit

```
$ git status --porcelain
 M README.md
?? docs/
```

Hanya `README.md` yang modified. `docs/` berstatus untracked (`??`) dan tidak pernah
di-`git add`. Konfirmasi setelah staging:

```
$ git add README.md && git status --porcelain
M  README.md
?? docs/
```

`docs/` tetap untracked, tidak masuk index. Commit menyentuh 1 file:

```
[campaign/fix-mcp-gap-v1 89d7017] docs(readme): sinkronkan README mcp-server dengan surface 69 tool
 1 file changed, 63 insertions(+), 93 deletions(-)
```

### Verifikasi 4 — Branch dan trailer commit

```
$ git branch --show-current
campaign/fix-mcp-gap-v1

$ git log -1 --format="%B" | grep -i "co-authored"
(exit 1, tidak ada match)
```

Branch benar, tidak ada perpindahan branch. Commit message menyebut
`fix-mcp-gap-v1 phase-06b` dan bebas trailer co-author.

## 5. Keputusan Penting

1. **Tabel domain, bukan daftar 69 tool.** Kontrak phase memberi ruang untuk memilih;
   dipilih tabel domain (9 baris) dengan kolom contoh tool. Alasannya persis yang
   disebut kontrak: README lama basi karena mendaftar tool satu per satu, dan
   mendaftar 69 baris hanya memindahkan masalah yang sama ke angka yang lebih besar.
   Spec per-tool sudah punya rumah di handbook hasil phase 06.

2. **Rujukan handbook ditulis sebagai nama section, bukan link relatif.** README ini
   ikut terdistribusi ke npm (`files: ["dist", "README.md", "LICENSE.md"]`), sehingga
   path relatif seperti `../../restforge-handbook/mcp/` akan mati di halaman npm dan
   GitHub package. Ditulis sebagai "the `mcp/` section of the RESTForge Handbook" tanpa
   URL karangan. Konsekuensinya pembaca perlu mencari sendiri; lihat section 7.

3. **Binary `restforge-mcp` dipertahankan, tidak dihapus.** Bin entry masih nyata ada di
   `package.json` (`"restforge-mcp": "./dist/index.js"`), jadi menghapusnya dari README
   justru membuat dokumen tidak lengkap. Diposisikan sebagai alternatif dengan penanda
   eksplisit, sesuai butir 2 kontrak.

4. **Empat pola lintas domain diangkat dari handbook ke README.** Awalnya di luar
   permintaan literal, tapi butir 3 kontrak meminta koreksi klaim yang bertentangan
   dengan keadaan sekarang. Catatan flag hardcode destruktif (`--yes`, `--force`,
   `--force=true`) adalah informasi keselamatan: README lama tidak menyebutnya sama
   sekali padahal `project_delete` dan `key_revoke` menghapus tanpa konfirmasi CLI.

5. **Em dash dan gaya kalimat mengikuti README existing.** Dokumen ini berbahasa Inggris
   dan sudah memakai em dash sebelum perubahan (mis. "MIT — see LICENSE.md"). Butir 4
   kontrak melarang ganti bahasa dokumen, jadi gaya asli dipertahankan.

6. **`npm >= 9` dihapus alih-alih dikoreksi.** Tidak ada `engines.npm` di `package.json`
   dan tidak ditemukan sumber lain yang menetapkan batas itu. Menuliskan angka tanpa
   dasar adalah jenis klaim yang justru sedang dibersihkan phase ini.

## 6. Hal yang Belum Diverifikasi

1. **Keberadaan package `create-restforge-skills` di registry npm.** Nama ini diambil
   dari `restforge-handbook/mcp/README.md:22` (hasil phase 06, branch campaign handbook)
   dan dari kontrak phase 06b sendiri. Tidak dilakukan `npm view` untuk mengonfirmasi
   package sudah terbit, sesuai kebijakan repo bahwa operasi npm atas nama user tidak
   dijalankan. Bila package belum terbit, jalur utama di README akan gagal saat dicoba.

2. **Output aktual `tools/list`.** Angka 69 diverifikasi lewat hitungan statis
   `registerTool` di `src/`, bukan dengan menjalankan server dan menghitung respons
   JSON-RPC. Bila ada registrasi bersyarat (tool yang hanya didaftarkan pada kondisi
   tertentu), hitungan statis bisa berbeda dari surface runtime. Pemeriksaan kasar tidak
   menemukan indikasi registrasi bersyarat, tapi ini tidak dibuktikan dengan eksekusi.

3. **Klaim daftar client di section "Compatibility"** (Windsurf, Cline, Continue, Zed)
   tidak diverifikasi ulang. Klaim ini sudah ada di README lama, sifatnya kompatibilitas
   transport stdio secara umum, dan di luar cakupan temuan phase 06.

4. **Anchor link `#quick-start` dan `#available-tools`.** Bekerja di GitHub; rendering
   anchor di halaman npm tidak diuji.

5. **Klaim "closed evaluation" dan tiga jalur akuisisi license** di section Access &
   License dipertahankan apa adanya dari README lama; status komersialnya tidak
   diverifikasi terhadap sumber mana pun.

## 7. Pertanyaan untuk Orchestrator

1. **Rujukan handbook perlu URL publik?** Saat ini README menyebut "the `mcp/` section of
   the RESTForge Handbook" tanpa link, karena path relatif akan mati di halaman npm dan
   tidak ada URL handbook publik yang terverifikasi. Bila handbook sudah punya URL tetap
   (mis. di bawah `restforge.dev`), rujukan itu sebaiknya diganti link agar pembaca npm
   bisa sampai ke spec lengkap.

2. **`create-restforge-skills` sudah terbit?** README kini menempatkannya sebagai jalur
   utama instalasi. Perlu konfirmasi package sudah tersedia di registry sebelum README
   ini ikut terbit, agar jalur utama tidak menjadi jalan buntu.

3. **Timing rilis package.** Perubahan ini dokumen saja dan tidak menyentuh `dist/`, tapi
   README hanya sampai ke pengguna npm lewat publish berikutnya. Sampai itu terjadi,
   halaman npm `@restforgejs/mcp-server` masih menampilkan versi lama yang menyebut
   39 tool dan `npm install -g`. Sesuai kontrak, bump version dan publish tidak dilakukan
   di phase ini.

### Temuan baru (dilaporkan, tidak dikerjakan)

Temuan berikut muncul saat verifikasi dan berada di luar cakupan phase 06b:

1. **`designer_auth_attach` terdaftar di source tapi tidak muncul di daftar tool MCP
   yang aktif pada sesi ini.** File `src/tools/designer/auth-attach.ts` memanggil
   `registerTool` dengan nama `designer_auth_attach`, dan tool itu ikut dihitung dalam
   angka 11 untuk domain `designer_*`. Namun daftar tool MCP yang tersedia di sesi
   worker ini hanya memuat `designer_auth_create` dan `designer_auth_remove`, tanpa
   `designer_auth_attach`.

   Registrasi sudah diverifikasi benar dan tidak bersyarat:
   `src/tools/designer/index.ts:11` meng-import `registerDesignerAuthAttach` dan
   baris 24 memanggilnya tanpa guard apa pun. Tool ini juga dirujuk dari
   `src/server.ts:400` dan `src/tools/designer/auth-create.ts:27`. Jadi angka 69
   tetap sahih untuk working tree, dan penyebab paling mungkin adalah sesi MCP
   memakai versi package terpasang yang lebih lama dari working tree, bukan bug
   registrasi. Yang belum diverifikasi hanya versi terpasang di sesi ini; tidak ada
   implikasi terhadap angka di README maupun handbook.

2. **`engines.node` (`>=18`) mungkin terlalu longgar.** `devDependencies` menyebut
   `@types/node: ^25.6.0` dan `typescript: ^6.0.3`. README kini mengikuti `package.json`
   apa adanya (>= 18), tapi bila runtime sebenarnya butuh versi lebih baru, yang perlu
   dikoreksi adalah `package.json`-nya, bukan README. Di luar cakupan phase ini.
