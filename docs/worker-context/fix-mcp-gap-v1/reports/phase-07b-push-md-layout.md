# Report Phase 07b — Koreksi Layout Output di `data/push.md`

Campaign: `fix-mcp-gap-v1`. Worker phase 07b (mikro-phase temuan phase 07 section 6
butir 2). Tanggal: 2026-08-23.

Repo kerja: `restforge-handbook`, branch `campaign/fix-mcp-gap-v1`.
Commit: `911d164`. Repo lain (`packages/platform`, `packages/mcp-server`) hanya
dibaca, tidak diubah, tidak di-commit.

## 1. Status Checklist per Butir

- [x] Blurb pembuka `data/push.md` tidak lagi menyebut bentuk rata sebagai satu-satunya layout
- [x] Kedua bentuk layout disebut (bersarang per schema dan rata)
- [x] Rumusan konsisten dengan `data/pull.md` hasil phase 07
- [x] Sweep kemunculan bentuk rata lain di file yang sama (tidak ada yang salah, lihat section 5)
- [x] Commit di branch campaign handbook, pesan menyebut `fix-mcp-gap-v1 phase-07b`, tanpa trailer co-author
- [x] Tanpa bump/publish

## 2. File yang Dibuat/Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `restforge-handbook/commands/restforge-backend/data/push.md` | Modifikasi | 5 insertions, 3 deletions (blurb baris 3–5) |

Tidak ada file lain yang disentuh.

### Rincian perubahan

Blurb lama:

```
> Muat isi file envelope JSON (`data-storage/<table>.json`) ke tabel tujuan via INSERT
> batch berdasarkan metadata SDF. Bersifat **append-only**. Mendukung satu tabel
> (`--table`), per schema (`--schema`), atau seluruh tabel terdaftar (`--all-schemas`).
```

Blurb baru:

```
> Muat isi file envelope JSON ke tabel tujuan via INSERT batch berdasarkan metadata SDF.
> Tabel ber-schema dibaca bersarang (`data-storage/<schema>/<table>.json`), tabel tanpa
> schema dibaca rata (`data-storage/<table>.json`). Bersifat **append-only**. Mendukung
> satu tabel (`--table`), per schema (`--schema`), atau seluruh tabel terdaftar
> (`--all-schemas`).
```

Path inline dicabut dari kalimat pertama dan dipindah ke kalimat layout tersendiri,
mengikuti struktur blurb `data/pull.md`.

## 3. Hasil Test

Tidak ada test otomatis untuk dokumentasi. Verifikasi dilakukan lewat pembacaan
source dan pemeriksaan diff (section 4).

## 4. Verifikasi Mandiri

### Verifikasi 1 — Diff hanya menyentuh `data/push.md`

`git show --stat --oneline HEAD`:

```
911d164 docs(data): sebut dua bentuk layout file pada blurb data push
 commands/restforge-backend/data/push.md | 8 +++++---
 1 file changed, 5 insertions(+), 3 deletions(-)
```

### Verifikasi 2 — Rumusan sejajar dengan `data/pull.md`

`data/pull.md` baris 4–5 (hasil phase 07):

```
> ber-schema ditulis bersarang (`data-storage/<schema>/<table>.json`), tabel tanpa
> schema ditulis rata (`data-storage/<table>.json`).
```

`data/push.md` baris 4–5 (hasil phase ini):

```
> Tabel ber-schema dibaca bersarang (`data-storage/<schema>/<table>.json`), tabel tanpa
> schema dibaca rata (`data-storage/<table>.json`).
```

Struktur kalimat, pasangan istilah `bersarang` / `rata`, dan kedua path literal
identik. Satu-satunya beda adalah verba arah operasi: `ditulis` (pull menghasilkan
file) menjadi `dibaca` (push mengonsumsi file). Lihat section 5.

### Verifikasi 3 — Konsisten dengan source

`packages/platform/generators/lib/data/data-scope.js:80-85`:

```js
function relDataFilePath(ir) {
    const { schemaName } = getNamespace(ir);
    return schemaName
        ? path.join(schemaName, `${ir.tableName}.json`)
        : `${ir.tableName}.json`;
}
```

Fungsi ini adalah satu-satunya titik derivasi nama file untuk pull maupun push
(dinyatakan pada docblock baris 70–75), sehingga rumusan yang sama memang berlaku
untuk kedua verb.

### Verifikasi 4 — `git status --porcelain` pasca-commit

```
 M api-spec/README.md
 M catalogs/rdf/README.md
?? api-spec/endpoint-upload.md
?? catalogs/rdf/upload-config.md
?? features/file-storage/
```

Persis lima entri dirty pra-existing, tidak ada tambahan, tidak ada sisa perubahan
phase ini yang belum di-commit.

### Verifikasi 5 — Branch dan trailer commit

Branch aktif `campaign/fix-mcp-gap-v1`. Body commit menyebut `fix-mcp-gap-v1
phase-07b`; tidak ada trailer `Co-Authored-By` maupun variasinya.

## 5. Keputusan Penting

1. **Verba disesuaikan arah operasi.** Prompt meminta rumusan "konsisten kata per
   kata" dengan `pull.md`. Menyalin `ditulis` ke `push.md` akan salah secara faktual
   karena push membaca file, bukan menulisnya. Yang dipertahankan identik adalah
   bagian yang load-bearing: struktur kalimat, pasangan `bersarang` / `rata`, dan
   kedua path literal. Hanya verbanya yang menjadi `dibaca`.

2. **Path literal dikeluarkan dari kalimat pertama.** Menyisipkan kedua bentuk layout
   ke dalam kurung kalimat pertama membuat kalimat itu berat dan tidak sejajar dengan
   `pull.md` yang memisahkan kalimat layout. Kalimat pertama karena itu dibuat murni
   soal aksi push, layout dipindah ke kalimat kedua.

3. **Kemunculan `data-storage` lain di file dibiarkan.** Sweep atas seluruh `push.md`
   menemukan tiga kemunculan lain, semuanya sudah benar:
   - Baris 31 — `--storage-path` default `data-storage`: nama folder, bukan layout.
   - Baris 210 — tabel skenario "Push satu tabel dari `data-storage/`": menyebut
     folder, tanpa mengklaim bentuk path file.
   - Langkah Behavior nomor 4 (baris 55–59) sudah menyatakan kedua bentuk secara
     lengkap sejak sebelum phase ini, termasuk catatan bahwa path diturunkan dari
     schema SDF, bukan dari field `schema` di envelope.

   Baris 213 (skenario tabel ber-schema) juga sudah menyebut file bersarang
   `sales/order_item.json` dengan benar. Jadi drift memang terbatas pada blurb saja,
   sesuai temuan phase 07.

## 6. Hal yang Belum Diverifikasi

- Kesesuaian anchor `README.md#nama-file-output-output-file-naming` yang dirujuk
  `pull.md` tidak diperiksa ulang di phase ini karena `push.md` tidak menambah rujukan
  baru ke section tersebut.
- Verifikasi runtime (menjalankan `data push` pada tabel ber-schema) tidak dilakukan;
  bukti bersifat source-level (`relDataFilePath`) plus report phase 07 section 3.4.

## 7. Pertanyaan untuk Orchestrator

Tidak ada blocker. Satu catatan untuk keputusan orchestrator: bila konvensi campaign
menuntut rumusan benar-benar identik huruf per huruf antara `pull.md` dan `push.md`,
verba `dibaca` pada `push.md` perlu diputuskan ulang (lihat section 5 butir 1). Worker
memilih akurasi arah operasi di atas keseragaman literal.
