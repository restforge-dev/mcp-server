# Report Phase 03 — Tool Baru: `project_sdk_generate`, `designer_auth_attach`, `license_info`

Campaign: `fix-mcp-gap-v1`. Worker phase 03. Tanggal: 2026-08-23.

Branch kerja: `campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Repo lain hanya dibaca.
Commit: `0651ffc`.

## 1. Status Checklist per Butir

- [x] Butir 1 — Tool `project_sdk_generate` (`src/tools/project/sdk-generate.ts`, terdaftar di `project/index.ts`)
- [x] Butir 2 — Tool `designer_auth_attach` (`src/tools/designer/auth-attach.ts`, terdaftar di `designer/index.ts`) + rujukan silang minimal di `auth-create.ts`
- [x] Butir 3 — Tool `license_info` (`src/tools/license/info.ts` + `license/index.ts` baru, domain terdaftar di `server.ts`)
- [x] Butir 4 — SERVER_INSTRUCTIONS: domain `license_*`, `project sdk` ter-wrap, auth attach tersedia, dan catatan eksplisit `license deactivate` sengaja tidak di-wrap
- [x] Test wajib 1 — `npm run build` lolos tanpa error
- [x] Test wajib 2 — dinyatakan kembali: tidak ada script test di package ini

Ketiga tool memakai nama persis seperti kontrak dan seluruh teks user-facing berbahasa Inggris.

## 2. File yang Dibuat/Dimodifikasi

Dibuat:

- `packages/mcp-server/src/tools/project/sdk-generate.ts`
- `packages/mcp-server/src/tools/designer/auth-attach.ts`
- `packages/mcp-server/src/tools/license/info.ts`
- `packages/mcp-server/src/tools/license/index.ts`
- `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-03-tool-baru-sdk-attach-license.md` (file report ini, tidak di-commit)

Dimodifikasi:

- `packages/mcp-server/src/tools/project/index.ts` — import + panggil `registerProjectSdkGenerate`
- `packages/mcp-server/src/tools/designer/index.ts` — import + panggil `registerDesignerAuthAttach`
- `packages/mcp-server/src/tools/designer/auth-create.ts` — rujukan silang minimal (satu butir di blok `DO NOT USE FOR`)
- `packages/mcp-server/src/server.ts` — import + registrasi domain `license`, plus empat penambahan SERVER_INSTRUCTIONS

Tidak ada bump version, tidak ada `npm publish`, dan tidak ada file di repo lain yang disentuh.

### 2.1 Pola yang Diikuti

Pola tool existing dipelajari lebih dulu dan diikuti apa adanya:

| Aspek | Rujukan yang diikuti |
|---|---|
| Precondition `node_modules/@restforgejs/platform` (respons non-error, `isError: false`) | `project/auth.ts:85-103`, `project/list.ts:45-63` |
| Precondition probe `npx restforge-designer --version` | `designer/auth-create.ts:89-112` (nomor baris setelah edit section 2.2) |
| Struktur deskripsi (`USE WHEN` / `DO NOT USE FOR` / "This tool wraps" / `Preconditions` / `PRESENTATION GUIDANCE`) | seluruh domain |
| Fact block respons (path, project, command, exit code, blok output CLI berpagar) | `project/auth.ts:112-161`, `designer/auth-create.ts:124-175` |
| Flag opsional dikirim hanya bila di-set (`if (force === true)`) | `project/auth.ts:106-108` |
| Anotasi ber-komentar alasan | `codegen/create-endpoint.ts:161-165` |
| Index domain minimal | `key/index.ts` |

### 2.2 Perubahan `auth-create.ts` (rujukan silang, minimal)

Satu butir di `DO NOT USE FOR` diganti. Sebelum:

```
- Projects that already use the vanilla-js-auth plugin (which has auth built in)
```

Sesudah:

```
- Retrofitting the auth scaffold onto a project whose pages are already generated, or a
  project running the 'vanilla-js-auth'/'vanilla-js-custom' plugin -> use 'designer_auth_attach'
```

Butir lama adalah larangan tanpa tujuan rute; versi baru menyebut tool tujuannya. Tidak ada
baris lain di file itu yang diubah.

### 2.3 Penambahan SERVER_INSTRUCTIONS

Empat blok baru, gaya mengikuti section existing (heading kapital, bullet, tanpa menulis
ulang bagian lain):

1. `FRONTEND AUTH — CREATE VS ATTACH:` (setelah `DESIGNER (FRONTEND) DOMAIN`) — memisahkan
   tiga mode `--create` / `--attach` / `--remove` beserta kapan dipakai.
2. `CLIENT SDK GENERATION:` — `project_sdk_generate` menulis source saja; build dan deploy
   milik user; `force=true` menimpa tanpa backup.
3. `LICENSE DOMAIN:` — `license_info` satu-satunya tool license, output teks apa adanya,
   dipakai untuk diagnosis kegagalan lisensi pada `setup_validate_config`.
4. `MUTATIONS DELIBERATELY NOT WRAPPED:` (section baru di akhir, setelah `INTERACTIVE
   COMMANDS`) — memuat `license deactivate` beserta alasan (melepas seat aktivasi di license
   server, efeknya lintas mesin, tidak bisa di-undo dari sini) dan instruksi mengarahkan user
   menjalankan `npx restforge license deactivate` sendiri, bukan lewat Bash tool.

Section baru dipisah dari `INTERACTIVE COMMANDS` karena alasan tidak-di-wrap-nya berbeda:
`fast-track` tidak bisa didorong karena prompt interaktif, sedangkan `license deactivate`
non-interaktif tetapi efeknya keluar dari folder project.

## 3. Hasil Test

### 3.1 Test Wajib

```
$ npm run build
> @restforgejs/mcp-server@1.3.0 build
> tsc

BUILD_EXIT=0
```

`tsc` lolos tanpa error maupun warning.

**Tidak ada script test di package ini.** `packages/mcp-server/package.json` hanya memuat
script `build`, `dev`, `start`, dan `inspect`; tidak ada `test` dan tidak ada test runner di
`devDependencies` (hanya `@types/node`, `tsx`, `typescript`). Pernyataan ini konsisten dengan
report phase 01 sampai 02g.

### 3.2 Bukti Registrasi (65 → 68)

Hitungan mentah:

```
$ grep -rn "server.registerTool(" src --include=*.ts | wc -l
65        # sebelum (HEAD 95eedde)
68        # sesudah
```

Harness registrasi meng-instantiate `McpServer` ASLI dari `@modelcontextprotocol/sdk`,
menjalankan sembilan pemanggilan `register*Tools` persis seperti `src/server.ts`, lalu
membaca daftar nama tool yang benar-benar terdaftar pada instance:

```
TOTAL REGISTERED TOOLS: 68
  PRESENT: project_sdk_generate | title="Generate Project JavaScript SDK" readOnlyHint=false destructiveHint=true idempotentHint=false
  PRESENT: designer_auth_attach | title="Retrofit Frontend Auth Scaffold" readOnlyHint=false destructiveHint=false idempotentHint=true
  PRESENT: license_info | title="Show License Info" readOnlyHint=true destructiveHint=undefined idempotentHint=true

project_* tools : project_auth, project_delete, project_list, project_sdk_generate
designer_auth_* : designer_auth_attach, designer_auth_create, designer_auth_remove
license_* tools : license_info
```

`destructiveHint=undefined` pada `license_info` disengaja: tool read-only mengikuti pola
`project_list` yang hanya menyetel `readOnlyHint` dan `idempotentHint`.

### 3.3 Harness Argumen terhadap Hasil Build

Pola sama dengan report 02b sampai 02g: harness me-load file hasil build
(`dist/tools/project/sdk-generate.js`, `dist/tools/designer/auth-attach.js`,
`dist/tools/license/info.js`), memasang stub `McpServer` untuk menangkap `inputSchema` dan
handler, lalu mengganti modul `lib/exec.js` lewat ESM loader hook sehingga `execProcess`
hanya merekam argumen tanpa pernah men-spawn CLI. Input tiap skenario di-parse lewat
`z.object(inputSchema)` lebih dulu. Folder `fake-cwd` berisi
`node_modules/@restforgejs/platform`, folder `no-platform` sengaja tidak ada. Harness dihapus
setelah dipakai.

```
================ project_sdk_generate ================

A. minimal (project only)
  argv  : ["npx","restforge","project","sdk","--generate","--project=myapp"]
  isError: false

B. all optionals set
  argv  : ["npx","restforge","project","sdk","--generate","--project=myapp","--sdk-path=./client-sdk","--base-url=https://api.example.com/api/myapp","--force"]
  isError: false

C. force=false (flag must be absent)
  argv  : ["npx","restforge","project","sdk","--generate","--project=myapp"]
  isError: false

D. precondition (cwd without platform)
  argv  : (no subprocess)
  isError: false
  facts : Precondition not met: the RESTForge package is not installed in this project.

================ designer_auth_attach ================

A. minimal (project only)
  argv  : ["npx","restforge-designer","--version"]
  argv  : ["npx","restforge-designer","auth","--attach","--project=myapp"]
  isError: false

B. all optionals set
  argv  : ["npx","restforge-designer","--version"]
  argv  : ["npx","restforge-designer","auth","--attach","--project=myapp","--frontend-path=frontend/apps","--api-base-url=http://localhost:3032/api","--overwrite"]
  isError: false

C. overwrite=false (flag must be absent)
  argv  : ["npx","restforge-designer","--version"]
  argv  : ["npx","restforge-designer","auth","--attach","--project=myapp"]
  isError: false

================ license_info ================

A. cwd only
  argv  : ["npx","restforge","license","info"]
  isError: false

B. precondition (cwd without platform)
  argv  : (no subprocess)
  isError: false
  facts : Precondition not met: the RESTForge package is not installed in this project.

================ input schema keys ================
  project_sdk_generate: cwd, project, sdkPath, baseUrl, force
  designer_auth_attach: cwd, project, frontendPath, apiBaseUrl, overwrite
  license_info: cwd
```

Tiga hal yang dibuktikan harness:

1. Array argumen persis sesuai spesifikasi phase, termasuk `--generate` yang selalu ikut dan
   `license info` yang berupa dua token tanpa flag.
2. Flag opsional hanya muncul bila di-set. Skenario C pada kedua tool mutasi membuktikan
   `force: false` / `overwrite: false` **tidak** memunculkan flag apa pun (pola
   `if (force === true)` dan `if (overwrite)`), sehingga default CLI dipertahankan.
3. `designer_auth_attach` menjalankan probe `--version` lebih dulu, persis seperti
   `designer_auth_create`.

### 3.4 Uji CLI Live di `smoke-test-home/` (Read-Only)

Platform ter-install 5.5.5 (lingkungan uji standar campaign, keputusan plan poin 5).

**`npx restforge project sdk --help`** — kelima flag terdaftar, cocok dengan yang dikirim tool:

```
Command: project sdk

Generate a JavaScript SDK for a project (derived from backend metadata + payload)

Usage:
  npx restforge project sdk --project=<STRING> --generate [options]

Required Flags:
  --project <string>    Target project name (also the SDK package name)
  --generate            Trigger SDK source generation

Optional Flags:
  --sdk-path <string>   Output folder for the SDK source (default: <project-root>/sdk) (default: null)
  --base-url <string>   Override the API base URL baked into sdk-client.js (default: derived from the project config) (default: null)
  --force               Overwrite existing SDK source (default: false)
```

**Satu run `project sdk --generate` terhadap project yang tidak ada** — error bersih, tanpa
mutasi:

```
$ npx restforge project sdk --generate --project=ghost-project-p03

Generating SDK for project 'ghost-project-p03'...

  Default config not found — baseUrl falls back to http://127.0.0.1:3000/api/ghost-project-p03
Error: Metadata for project 'ghost-project-p03' not found. Looked in:
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\metadata\ghost-project-p03.json
  - D:\workspace\03_projects\restforge-systems\smoke-test-home\backend\metadata\ghost-project-p03.json
Make sure the project has been generated (endpoint create / fast-track) before creating an SDK.

EXIT=1
```

Bukti tanpa mutasi: `ls -d sdk` sesudah run mengembalikan
`ls: cannot access 'sdk': No such file or directory`, dan isi `metadata/` tidak bertambah.
Kegagalan terjadi saat membaca metadata, jauh sebelum satu pun file ditulis.

**`npx restforge license info`** — berhasil, exit code 0 (nilai kunci diredaksi):

```
==========================================
  RESTFORGE LICENSE INFO
==========================================

  License Key:  7A54-****-****-****
  Email:        <email pemilik license>
  Type:         enterprise
  Machine ID:   5495d31bdc93a357...
  Validated:    2026-08-22 14:30:21
  Last Check:   2026-08-22 14:30:21
  Expires:      Never

==========================================

EXIT=0
```

Bentuknya teks berbingkai, tanpa mode terstruktur — konsisten dengan temuan phase 00 section
3.7 dan dengan keputusan campaign meneruskan teks apa adanya.

**`npx restforge-designer auth --help`** — mode `--attach` terdaftar beserta keempat parameter
yang dipakai tool:

```
      --attach                         Retrofit the full auth scaffold onto an already-generated project without touching page files: always installs the `window.Auth` (rfx_auth) contract, and, when the project payload enables auth on an auth-capable plugin, also renders the AuthClient artifacts (auth.js, login.html, login.js, config auth block). Idempotent and safe for customizations (mutually exclusive with `--create`/`--remove`; exactly one of the three is required)
      --project <PROJECT>              Project name → app-code, localStorage prefix, route path `/api/<project>/rfx_auth`
      --frontend-path <FRONTEND_PATH>  Frontend apps root folder; target app = `<frontend-path>/<project>` [default: ./frontend/apps]
      --api-base-url <API_BASE_URL>    Override backend base URL (skip auto-resolve from app-config.json)
      --overwrite                      Overwrite existing auth files (+ archive backup); relevant for `--create`/`--attach` only
      --force                          Skip the removal confirmation prompt (y/N); relevant for `--remove` only
```

Catatan: `--force` eksplisit ditandai "relevant for `--remove` only", jadi keputusan phase
untuk tidak mengekspos `force` pada `designer_auth_attach` sesuai kontrak binary.

### 3.5 Bukti Perilaku Overwrite `project sdk --force` (dari Source)

Kontrak phase meminta perilaku saat target sudah ada dibaca dari handler dan dikutip.
Handler `generators/cli/project/sdk.js:84-91` hanya meneruskan `force: args.force === true`
ke `generateSdk`. Guard sesungguhnya ada di
`packages/platform/generators/lib/sdk/generator.js:656-662`:

```js
const indexMarker = path.join(outputDir, 'src', 'index.js');
if (fs.existsSync(indexMarker) && !force) {
    throw generateError(
        `An SDK already exists at ${outputDir} (found src/index.js). Use --force to overwrite.`,
        1
    );
}
```

Tiga fakta yang diturunkan dari kode itu dan ditulis ke deskripsi tool:

1. **Guard berbasis satu marker file**, `<sdk-path>/src/index.js` — bukan pemeriksaan folder
   kosong. Bila marker ada dan `--force` tidak diberikan, exit code 1 dan tidak ada file yang
   ditulis (guard berjalan sebelum blok `fs.mkdirSync` di baris berikutnya).
2. **`--force` menimpa di tempat tanpa backup.** Seluruh penulisan memakai
   `fs.writeFileSync` langsung (`generator.js:678-689`); tidak ada mekanisme arsip seperti
   `.archive.NNN` yang dipakai `endpoint create`. Edit lokal di dalam folder SDK hilang.
3. **File resource basi tidak dihapus.** `resourcesDir` tidak pernah dibersihkan sebelum
   penulisan, jadi file resource milik endpoint yang sudah dihapus tetap tertinggal setelah
   regenerasi paksa. Ini dicatat eksplisit di deskripsi tool agar agent memperingatkan user
   saat daftar resource menyusut.

Fakta tambahan yang juga dipakai deskripsi: generate dibatalkan seluruhnya bila payload salah
satu endpoint terdaftar tidak ditemukan (`generator.js:640-641` memanggil `readPayloadMeta`
sebelum folder output dibuat), dan `client.auth` ikut disertakan bila
`src/modules/<project>/rfx_auth.js` terdeteksi (`generator.js:592`, `detectAuth`).

## 4. Verifikasi Mandiri

```
$ git -C packages/mcp-server branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/platform branch --show-current
campaign/fix-mcp-gap-v1

$ git -C packages/designer branch --show-current
main
```

Tidak ada checkout, tidak ada perubahan di `packages/platform`, `packages/designer`, maupun
`restforge-handbook` (ketiganya hanya dibaca).

`git status --porcelain` di `packages/mcp-server` sebelum commit:

```
 M src/server.ts
 M src/tools/designer/auth-create.ts
 M src/tools/designer/index.ts
 M src/tools/project/index.ts
?? docs/
?? src/tools/designer/auth-attach.ts
?? src/tools/license/
?? src/tools/project/sdk-generate.ts
```

Sesudah `git add` selektif (hanya file scope; `docs/` tidak di-stage):

```
M  src/server.ts
A  src/tools/designer/auth-attach.ts
M  src/tools/designer/auth-create.ts
M  src/tools/designer/index.ts
A  src/tools/license/index.ts
A  src/tools/license/info.ts
M  src/tools/project/index.ts
A  src/tools/project/sdk-generate.ts
?? docs/
```

Commit: `0651ffc` — `feat(mcp): tambah tool project_sdk_generate, designer_auth_attach, dan
license_info (fix-mcp-gap-v1 phase-03)`, 8 file, 603 insertion, 1 deletion. Tanpa trailer
co-author. `docs/worker-context/` tetap untracked.

Enam file issue untracked di `packages/platform/docs/issues/` adalah artefak audit 2026-08-21
yang sudah ada sebelum phase ini (tercatat di report phase 00 section 4); tidak ada yang
disentuh worker ini.

## 5. Keputusan Penting

1. **`force` tidak diekspos pada `designer_auth_attach`.** Bukti dari `auth --help` binary
   1.6.5: `--force` hanya relevan untuk `--remove` (skip prompt konfirmasi). Mengekspos flag
   yang diabaikan pada mode ini akan menyesatkan agent. Sesuai spesifikasi phase, yang
   diekspos hanya `frontend-path`, `api-base-url`, dan `overwrite`.
2. **`plugins-dir` tidak diekspos.** `auth --help` mendaftarkannya untuk ketiga mode (temuan
   tambahan phase 00 section 3.6), tetapi `designer_auth_create` yang jadi cermin juga tidak
   mengekspos parameter itu. Menambahkannya hanya di `attach` akan membuat kedua tool tidak
   simetris; keputusan ini dicatat sebagai kandidat backlog, bukan dikerjakan di sini
   (batas strict per-phase).
3. **`project_sdk_generate` diberi `destructiveHint: true` dan `idempotentHint: false`.**
   Alasannya konkret dan berbasis source (section 3.5): `--force` menimpa tanpa arsip, dan
   run kedua tanpa `--force` justru gagal (exit 1) sehingga tidak idempoten. Ini mengikuti
   preseden `codegen_create_endpoint` yang menandai dirinya destruktif dengan komentar alasan,
   bukan preseden `project_auth` yang menyetel `idempotentHint: true`.
4. **`license_info` menyetel exit code sebagai fakta di respons sukses.** Kontrak phase minta
   fact minimal (exit code, cwd); karena output diteruskan apa adanya, exit code jadi satu-
   satunya sinyal terstruktur yang tersedia untuk agent.
5. **Guidance redaksi data sensitif ditulis di deskripsi `license_info`.** License key, e-mail,
   dan machine id diminta hanya diulang bila user memintanya. Output CLI tetap diteruskan utuh
   ke agent (sesuai keputusan campaign poin 3); pembatasan hanya pada tahap presentasi ke user.
6. **`license deactivate` ditempatkan di section SERVER_INSTRUCTIONS baru**, bukan disisipkan
   ke `INTERACTIVE COMMANDS`, karena alasan tidak-di-wrap-nya berbeda kategori (efek lintas
   mesin vs prompt interaktif). Kriteria selesai issue-46 tetap terpenuhi: verb tersebut kini
   punya catatan eksplisit beserta alasannya.

## 6. Hal yang Belum Diverifikasi

1. **Eksekusi mutasi nyata ketiga tool.** `project sdk --generate` hanya dijalankan pada
   project yang tidak ada (jalur error), dan `auth --attach` tidak dijalankan sama sekali.
   Jalur sukses keduanya memutasi filesystem project, jadi disisakan untuk phase acceptance
   (phase 08) di project uji yang boleh dikotori.
2. **Perilaku `--force` yang sebenarnya terhadap SDK existing.** Kesimpulan "menimpa tanpa
   backup" dan "file resource basi tertinggal" diturunkan dari pembacaan
   `generators/lib/sdk/generator.js`, bukan dari run nyata dengan dua kali generate.
3. **Pemanggilan nyata dari client MCP.** Seluruh verifikasi sisi MCP memakai harness terhadap
   hasil build; belum ada round-trip lewat MCP client sungguhan (keterbatasan sama dengan
   report 02b sampai 02g).
4. **Perilaku `license info` saat tidak ada aktivasi.** Mesin uji punya lisensi enterprise
   aktif, jadi cabang gagal (`isError: true`) pada `license_info` belum pernah terpicu; bentuk
   pesan dan exit code untuk kondisi belum-aktivasi belum diamati.
5. **Jalur `--attach` dua lapis.** Klaim deskripsi tentang lapis kedua (artefak login plugin
   `vanilla-js-auth`/`vanilla-js-custom`, injeksi blok `js/config.js`) diambil dari handbook
   `commands/restforge-frontend/auth.md` dan teks `--help` binary, bukan dari pembacaan
   `packages/designer/src/cli/auth.rs` maupun run nyata.
6. **Dampak panjang SERVER_INSTRUCTIONS.** Empat blok baru menambah ukuran instruksi server;
   belum diukur apakah ada batas praktis di sisi client MCP.

## 7. Pertanyaan untuk Orchestrator

1. **`plugins-dir` untuk domain designer.** Parameter ini tersedia di ketiga mode `auth` dan
   juga di verb designer lain, tetapi tidak diekspos oleh satu pun tool `designer_*`. Apakah
   dibuka sebagai phase penyapuan tersendiri (konsisten untuk semua tool designer), dicatat
   sebagai issue baru saat penutupan, atau memang sengaja disembunyikan karena auto-detect
   dianggap cukup?
2. **Wrapper `license deactivate` dengan konfirmasi.** Issue-46 usulan 3 membuka dua opsi:
   diekspos dengan konfirmasi, atau dinyatakan out-of-scope. Phase ini menjalankan opsi kedua
   sesuai keputusan campaign. Konfirmasi bahwa opsi ini final untuk 1.x, atau tetap dibuka
   sebagai kandidat setelah pola konfirmasi eksplisit tersedia di server ini?
3. **Cakupan `project tenant` menyusul `project sdk`.** Domain `project_*` kini berisi empat
   tool. Verb `project tenant` (temuan phase 00 section 3.10, tanpa halaman handbook) masih
   berstatus "tidak ter-wrap tanpa alasan tercatat". Bila kriteria selesai issue-46 mau
   dipenuhi secara ketat, verb itu juga butuh salah satu dari dua status. Apakah cukup
   ditutup lewat catatan SERVER_INSTRUCTIONS di phase lanjutan, atau tetap dilempar ke issue
   baru saat penutupan (keputusan campaign poin 4 saat ini memilih issue baru)?
4. **Uji mutasi phase 08.** `project sdk --generate` jalur sukses membutuhkan project dengan
   metadata dan payload lengkap, sedangkan `auth --attach` membutuhkan project frontend
   ber-plugin `vanilla-js-auth`/`vanilla-js-custom` yang halamannya sudah di-generate. Apakah
   phase 08 menyiapkan keduanya dari nol di playground, atau memakai app existing (mis.
   `cascade-e2e` untuk frontend) dengan risiko mengotori artefak campaign lain?
