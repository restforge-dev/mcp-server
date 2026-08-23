# Report Phase 01 — Fix Deskripsi Verb Kolon Lama + Bentuk Eksekusi `codegen_validate_sql`

Campaign: `fix-mcp-gap-v1`. Worker phase 01. Tanggal: 2026-08-22.
Repo: `packages/mcp-server`, branch `campaign/fix-mcp-gap-v1`.

## 1. Status Checklist

- [x] `validate-sql.ts` — argumen eksekusi `'query:validate'` menjadi dua elemen `'query', 'validate'`
- [x] `validate-sql.ts` — seluruh sebutan `query:validate` di deskripsi dan teks tool diganti `query validate`
- [x] `validate-sql.ts` — blok error handling "Unknown command" diperbarui ke bentuk yang benar-benar dicetak CLI
- [x] `validate-sql.ts` — klaim versi minimum `>= 2.4.8` dihapus, tanpa mengarang angka versi baru
- [x] `get-dashboard-catalog.ts` — `dashboard:catalog` menjadi `catalog dashboard`
- [x] `get-field-validation-catalog.ts` — `field-validation:catalog` menjadi `catalog field-validation`
- [x] `get-query-declarative-catalog.ts` — `query-declarative:catalog` menjadi `catalog query-declarative`
- [x] `get-config-schema.ts` — `config:schema` menjadi `config schema`
- [x] Build TypeScript lolos tanpa error
- [x] Uji CLI live di `smoke-test-home/` (bentuk baru dikenali, bentuk lama ditolak)
- [x] Commit di branch campaign, tanpa trailer co-author
- [+] Tambahan di luar daftar spec: `get-init-template.ts` — `config:template` menjadi `config template` (lihat Keputusan Penting butir 3)

Seluruh butir spesifikasi phase 01 selesai. Satu perubahan tambahan sekelas dilakukan
dan didokumentasikan eksplisit di section 5.

## 2. File yang Dibuat/Dimodifikasi

Commit: **`59ddc04`** (`59ddc04eb62dd377a3c2b45195c86f2407a1742e`) di branch `campaign/fix-mcp-gap-v1`,
6 file diubah, 12 insertion, 11 deletion.

| File (relatif ke `packages/mcp-server/`) | Jenis perubahan | Detail |
|---|---|---|
| `src/tools/codegen/validate-sql.ts` | Kode + deskripsi | Argumen eksekusi, 3 sebutan verb di teks, 1 blok error handling, 2 klaim versi |
| `src/tools/codegen/get-dashboard-catalog.ts` | Deskripsi saja | 1 baris |
| `src/tools/codegen/get-field-validation-catalog.ts` | Deskripsi saja | 1 baris |
| `src/tools/codegen/get-query-declarative-catalog.ts` | Deskripsi saja | 1 baris |
| `src/tools/setup/get-config-schema.ts` | Deskripsi saja | 1 baris |
| `src/tools/setup/get-init-template.ts` | Deskripsi saja | 1 baris, di luar daftar spec (section 5 butir 3) |

Dibuat (TIDAK ikut commit, sesuai kontrak):

- `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-01-fix-deskripsi-dan-verb-form.md` (file report ini)

Tidak ada file di repo lain yang disentuh. Tidak ada bump versi `package.json`, tidak ada
perubahan changelog maupun artefak rilis. Folder `dist/` masuk `.gitignore` sehingga hasil
build tidak ikut ter-commit.

### 2.1 Rincian Perubahan `validate-sql.ts`

Perubahan fungsional (satu-satunya di phase ini):

```
       const cliArgs = [
         'restforge',
-        'query:validate',
+        'query',
+        'validate',
         `--config=${config}`,
```

Perubahan teks yang menyangkut kebenaran, bukan kosmetik:

```
-  * Unknown command 'query:validate' — the installed RESTForge version may be older than this CLI subcommand; suggest upgrading the package (requires @restforgejs/platform >= 2.4.8).
+  * "Unknown command: query" — the installed RESTForge version does not provide the 'query validate' sub-command; suggest upgrading @restforgejs/platform to a version that supports it (confirmed present in 5.5.5).
```

```
-- The project must have @restforgejs/platform installed in node_modules (>= 2.4.8 for query:validate support).
+- The project must have @restforgejs/platform installed in node_modules, in a version that provides the 'query validate' sub-command (confirmed present in 5.5.5; the exact minimum version is not established).
```

Bentuk pesan `Unknown command: query` diverifikasi langsung dari source platform, bukan
diperkirakan. `packages/platform/generators/cli-entry.js:109-122` menunjukkan bahwa cabang
else yang mencetak `Error: Unknown command: ${first}` dicapai pada dua kondisi: resource
tidak dikenal, dan resource dikenal tetapi verb-nya tidak ada di bawahnya. Jadi token yang
dicetak selalu `query` (token pertama), bukan `query validate`. Ini penting karena pesan
lama justru akan cocok dengan pola yang salah dan menyesatkan agent.

Klaim `>= 2.4.8` muncul di tiga tempat, bukan dua seperti yang tersirat di prompt: baris
40 (Preconditions), 174 (error handling), dan 206 (branch JSON parse failure). Ketiganya
diperbarui agar tidak ada klaim versi menggantung yang merujuk bentuk kolon.

## 3. Hasil Test

### 3.1 Build TypeScript

Command persis: **`npm run build`** di `packages/mcp-server`, yang oleh `package.json`
dipetakan ke **`tsc`** (tanpa flag tambahan).

```
$ npm run build

> @restforgejs/mcp-server@1.3.0 build
> tsc

EXIT=0
```

Lolos tanpa error maupun warning. Build dijalankan dua kali: setelah lima perubahan sesuai
spec, dan sekali lagi setelah perubahan tambahan `get-init-template.ts`. Keduanya exit 0.

Verifikasi output build benar-benar membawa perubahan argumen:

```
$ grep -n "'query'" dist/tools/codegen/validate-sql.js
98:            'query',
```

### 3.2 Test Suite

**Tidak ada script test di `package.json`.** Blok `scripts` hanya memuat `build`, `dev`,
`start`, dan `inspect`. Tidak ada `test`, tidak ada `vitest`/`jest`/`node:test` di
`devDependencies` (isinya hanya `@types/node`, `tsx`, `typescript`). Karena itu tidak ada
baseline pass/fail maupun delta yang bisa dilaporkan. Gate verifikasi phase ini bertumpu
pada build TypeScript plus uji CLI live di section 4.2.

## 4. Verifikasi Mandiri

### 4.1 Grep Bentuk Kolon Tersisa

```
$ grep -rn ":validate\|:catalog\|config:schema" src/
(no match)
```

Nol hasil. Pemeriksaan diperluas dua kali untuk menutup celah pola grep:

```
$ grep -rn "2\.4\.8" src/
(no match)

$ grep -rnE "restforge [a-z-]+:[a-z-]+" src/
src/tools/setup/get-init-template.ts:29:This tool runs: npx restforge config:template in the given cwd.
```

Grep ketiga inilah yang memunculkan kemunculan keenam di luar daftar issue-50. Setelah
diperbaiki, ketiga grep bersih:

```
$ grep -rnE "restforge [a-z-]+:[a-z-]+" src/
(no match)
```

Tidak ada kemunculan sah bentuk kolon yang perlu dikecualikan; seluruh sebutan yang ada
memang verb CLI.

### 4.2 Uji CLI Read-Only di `smoke-test-home/`

Bentuk baru yang kini dibangun tool, dijalankan apa adanya:

```
$ npx restforge query validate --help
Command: query validate

Validate SQL statement (SELECT/CTE) against a live database using EXPLAIN (read-only, does not execute data modification)

Usage:
  npx restforge query validate --sql=<STRING> [options]

Required Flags:
  --sql <string>      SQL statement to validate (SELECT or WITH/CTE only)

Optional Flags:
  --config <string>   Database config file (.env). Fallback to `.restforge/defaults.json` if not
                      explicitly provided (set via `config set-default`) (default: null)
  --pretty            Pretty-print output JSON (default: true)

Examples:
  npx restforge query validate --config=db.env --sql="SELECT * FROM users WHERE id = 1"
  npx restforge query validate --config=db.env --sql="WITH t AS (SELECT 1 a) SELECT * FROM t"

EXIT=0
```

Uji pembanding kedua bentuk dengan argumen persis seperti yang disusun `validate-sql.ts`
(`--config=`, `--sql=`, `--pretty=false`), memakai config yang sengaja tidak ada agar tetap
read-only:

```
$ npx restforge query:validate --config=db-connection.env --sql="SELECT 1" --pretty=false
Error: Unknown command: query:validate

Did you mean:
  query

Run 'npx restforge --help' for available commands.
```

```
$ npx restforge query validate --config=db-connection.env --sql="SELECT 1" --pretty=false
Error: Config file not found: D:\workspace\03_projects\restforge-systems\smoke-test-home\db-connection.env
Error: Failed to load config from D:\workspace\03_projects\restforge-systems\smoke-test-home\db-connection.env
```

Ini bukti yang lebih kuat daripada `--help` saja: bentuk lama gagal di lapis **dispatch**
(CLI tidak mengenali command sama sekali), sedangkan bentuk baru lolos dispatch, lolos
parsing flag, dan sampai ke **handler** yang mulai memuat config. Satu-satunya kegagalan
tersisa adalah ketiadaan config, bukan bentuk verb.

**Uji `--sql="SELECT 1"` penuh tidak bisa dijalankan.** Folder `smoke-test-home/config/`
ada tetapi **kosong** (nol file), dan tidak ada file `.env` di level atas project. Tidak ada
config database yang berfungsi di lingkungan ini, sehingga jalur EXPLAIN ke database nyata
tidak tersentuh. Sesuai instruksi prompt, hal ini dinyatakan eksplisit alih-alih dipaksakan.

### 4.3 Status Git Sebelum Commit

```
$ git -C packages/mcp-server status --porcelain
 M src/tools/codegen/get-dashboard-catalog.ts
 M src/tools/codegen/get-field-validation-catalog.ts
 M src/tools/codegen/get-query-declarative-catalog.ts
 M src/tools/codegen/validate-sql.ts
 M src/tools/setup/get-config-schema.ts
 M src/tools/setup/get-init-template.ts
?? docs/
```

Hanya enam file yang memang diubah phase ini, plus `docs/` yang sudah untracked sejak
phase 00. `docs/` **tidak di-stage**; staging dilakukan dengan menyebut keenam path source
secara eksplisit, bukan `git add -A`.

Sesudah commit:

```
$ git status --porcelain
?? docs/

$ git branch --show-current
campaign/fix-mcp-gap-v1

$ git log -1 --format="%B" | grep -i "co-authored"
(no co-author trailer)
```

Tidak ada perpindahan branch sepanjang phase ini; branch `campaign/fix-mcp-gap-v1` sudah
aktif sejak awal sesi sehingga checkout tidak diperlukan. Repo `packages/platform` dan
`packages/designer` tidak disentuh sama sekali.

## 5. Keputusan Penting

1. **Pesan error disesuaikan ke bentuk aktual CLI, bukan ke bentuk yang diperkirakan.**
   Prompt menawarkan dua kemungkinan (`Unknown command: query` atau kegagalan verb).
   Pembacaan `generators/cli-entry.js:109-134` menunjukkan keduanya menghasilkan pesan yang
   sama persis, karena verb yang tidak ada membuat kondisi `manifest.resources[first][argv[1]]`
   gagal dan jatuh ke cabang else yang mencetak token pertama saja. Jadi satu pola
   `Unknown command: query` sudah menutup kedua skenario, dan tidak perlu pola kedua.

2. **Klaim versi diganti pernyataan tanpa angka minimum karangan.** Formulasi yang dipakai
   adalah "in a version that provides the 'query validate' sub-command (confirmed present
   in 5.5.5; the exact minimum version is not established)". Angka 5.5.5 bukan klaim ambang
   minimum, melainkan fakta yang sudah diverifikasi phase 00 dan diverifikasi ulang phase ini
   lewat uji CLI live. Ambang minimum sebenarnya tetap dinyatakan belum diketahui, sesuai
   larangan mengarang versi.

3. **Satu perbaikan di luar daftar spec: `get-init-template.ts`.** Grep pola umum menemukan
   kemunculan keenam yang tidak tercatat di issue-50 maupun di daftar lima butir prompt:
   deskripsi tool `setup_get_init_template` menyebut `config:template`, sedangkan kodenya
   (`get-init-template.ts:79`) sudah mengeksekusi `['restforge', 'config', 'template']`.
   Keberadaan verb dikonfirmasi dari struktur folder platform:
   `packages/platform/generators/cli/config/template.js` ada.

   Alasan tetap dikerjakan, bukan sekadar dilaporkan: ini kelas defect yang identik persis
   dengan empat butir deskripsi lain (drift teks satu baris, kode sudah benar), berada di
   dalam repo dan scope file phase ini, dan kriteria selesai issue-50 berbunyi "tidak ada
   deskripsi tool yang menyebut verb dalam bentuk yang tidak dieksekusi kodenya" — meninggalkannya
   berarti kriteria itu tidak benar-benar terpenuhi meski checklist lima butir tercentang.
   Batasan strict-per-phase yang disebut prompt mengecualikan ekspos flag, tool baru, skills,
   dan handbook; tidak satu pun berlaku di sini. Perubahannya nol risiko: teks deskripsi,
   tanpa sentuhan input schema maupun perilaku.

   Bila orchestrator menilai ini melanggar batas phase, revert bersifat trivial dan terisolasi
   pada satu baris di commit `59ddc04`.

4. **Klaim versi di tool lain sengaja TIDAK disentuh.** `get-field-validation-catalog.ts`
   menyebut `>= 2.4.0`, sedangkan `get-config-schema.ts` dan `get-init-template.ts` menyebut
   `>= 2.3.1`. Ketiganya berpotensi stale dengan alasan yang sama seperti `>= 2.4.8`, tetapi
   tidak ada satu pun yang merujuk bentuk kolon, dan keputusan orchestrator hanya mengikat
   untuk klaim `>= 2.4.8`. Menyentuhnya berarti menulis ulang deskripsi di luar bentuk verb,
   yang dilarang eksplisit. Dicatat sebagai kandidat phase berikutnya (section 7 butir 2).

5. **Bentuk `--pretty=false` tidak diubah.** Uji live mengonfirmasi flag `--pretty` diterima
   verb `query validate` dan bentuk `--flag=value` dikenali parser generator, sehingga tidak
   ada alasan menyentuhnya di phase ini.

## 6. Hal yang Belum Diverifikasi

1. **Jalur sukses `codegen_validate_sql` end-to-end terhadap database nyata.** Yang terbukti
   adalah argumen baru lolos dispatch dan parsing flag lalu masuk handler. Cabang B (ok:true),
   C (ok:false), dan D (penolakan non-SELECT) belum pernah dieksekusi karena
   `smoke-test-home/config/` kosong dan tidak ada database yang terkonfigurasi. Struktur JSON
   yang di-parse `validate-sql.ts` (`root.ok`, `root.database`, `root.error.{code,message,hint}`)
   karena itu belum dikonfirmasi ulang terhadap output nyata platform 5.5.5.

2. **Perilaku tool lewat MCP client sungguhan.** Tidak ada tool yang dipanggil melalui
   MCP client; verifikasi berhenti di level CLI dan build. Bentuk persis pesan yang sampai
   ke agent belum diamati (ini juga tercatat sebagai gap di phase 00 section 6 butir 1).

3. **Ambang versi platform minimum untuk bentuk spasi.** Tetap tidak diketahui, sama seperti
   sesudah phase 00. Bisection memakai playground 5.2.x tidak dijalankan karena prompt
   memutuskan tanpa fallback (Q10=A) sehingga bisection tidak menjadi blocker phase ini.
   Konsekuensinya, deskripsi tool kini tidak memuat ambang minimum apa pun.

4. **Keempat tool deskripsi-saja tidak diuji ulang secara live.** `catalog dashboard`,
   `catalog field-validation`, `catalog query-declarative`, `config schema`, dan
   `config template` diverifikasi dari source (argumen `execProcess` dan keberadaan file verb
   di `packages/platform/generators/cli/`), bukan dengan menjalankan kelimanya di
   `smoke-test-home/`. Risikonya rendah karena kodenya tidak diubah sama sekali, tetapi ini
   berarti klaim "deskripsi kini cocok dengan eksekusi" bersandar pada pembacaan source untuk
   kelima tool tersebut.

5. **Dampak perubahan deskripsi terhadap perilaku pemilihan tool oleh agent.** Deskripsi
   adalah kontrak yang dibaca agent; apakah perubahan kata memengaruhi routing tool tidak
   diuji dan memang tidak ada mekanisme ujinya di repo ini.

## 7. Pertanyaan untuk Orchestrator

1. **Apakah perbaikan `get-init-template.ts` diterima sebagai bagian phase 01?** Bila
   orchestrator memilih strict-per-phase secara literal, satu baris di commit `59ddc04` perlu
   di-revert dan dipindahkan ke phase lain. Bila diterima, issue-50 bisa ditutup dengan
   catatan bahwa cakupannya ternyata enam tool, bukan lima seperti yang tertulis di issue.

2. **Klaim versi stale di tool lain (`>= 2.4.0` dan `>= 2.3.1` di tiga tempat) masuk phase
   mana?** Ketiganya tidak terverifikasi dan berpotensi menyesatkan dengan cara yang sama
   seperti `>= 2.4.8`, tetapi tidak menyentuh bentuk verb sehingga di luar mandat phase 01.
   Perlu keputusan: dihapus seluruhnya (konsisten dengan perlakuan `>= 2.4.8`), diverifikasi
   dulu lewat bisection, atau dibiarkan.

3. **Apakah issue-50 boleh ditandai Done sekarang, atau menunggu uji end-to-end dengan
   database nyata?** Kriteria selesai issue-50 sudah terpenuhi secara tekstual dan struktural,
   tetapi jalur sukses `codegen_validate_sql` belum pernah benar-benar berjalan sampai EXPLAIN.
   Bila validasi lapangan diwajibkan sebelum penutupan, dibutuhkan project uji dengan database
   hidup — `smoke-test-home/` tidak memenuhi syarat karena `config/` kosong.

4. **Perlukah `smoke-test-home/` diberi config database yang berfungsi untuk campaign ini?**
   Phase 00 menetapkannya sebagai lingkungan uji live standar, tetapi ketiadaan config membatasi
   uji pada jalur kegagalan saja. Bila phase berikutnya butuh verifikasi jalur sukses (validate-sql,
   list-tables, describe-table), keputusan penyediaan config sebaiknya diambil sekarang.

5. **Apakah `dist/` perlu ikut dirilis ulang di phase ini?** Build sudah dijalankan dan
   `dist/` ter-update di working tree, tetapi `dist/` masuk `.gitignore` dan prompt melarang
   menyentuh artefak rilis. Publikasi paket diasumsikan milik phase rilis terpisah dan
   ditangani user, sesuai kebijakan repo.
