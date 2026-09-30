# Report Phase 05 — Sinkronisasi `restforge-skills` (Issue-49 + Perubahan Campaign)

Campaign: `fix-mcp-gap-v1`. Worker phase 05. Tanggal: 2026-08-23.

Branch kerja: `campaign/fix-mcp-gap-v1` di `restforge-skills` (baseline `4bc9041`).
Repo lain (`packages/mcp-server`, `packages/platform`, `restforge-handbook`) hanya dibaca.
Commit: `77afc06`.

## 1. Status Checklist per Butir

- [x] Butir 1 — Cakupan 69 tool. Inventaris diambil langsung dari
      `packages/mcp-server/src/tools/*/*.ts` (pola `registerTool('<nama>')`), bukan dari
      issue-49 yang masih menyebut angka 65. Hasil: 69 tool, seluruhnya kini berstatus
      (tabel audit di section 4). Sepuluh tool prioritas masuk alur, empat tool (`health_ping`,
      `key_generate`, `key_list`, `key_revoke`) plus `project_list` dinyatakan eksplisit di
      section baru "Tools outside this skill's workflows".
- [x] Butir 2 — Baris config schema (`setup_get_config_schema` + `references/config-schema.md`)
      ditambahkan ke tabel Grounding-First di SKILL.md dan SKILL-ID.md.
- [x] Butir 3 — `references/rdf-advanced.md` kini memuat tabel grounding tool di kepala file
      plus rujukan per section (Data Source Resolution, Query File Reference, Field Lookup,
      Aggregate Config, Adjust Config, Import Config, Processor, Components).
- [x] Butir 4 — Perilaku pasca phase 01-04 tercermin: `codegen_create_endpoint`
      (`createDemo` → `--create-examples`, `config`, `database` dibiarkan kosong, semantik
      `force`), `codegen_create_dashboard` (tanpa auto-deteksi database, `force` mengganti tipe
      database terdaftar, payload ber-ekstensi), konvensi payload per tool dalam bentuk tabel,
      `codegen_validate_sql` (verb `query validate` bentuk spasi, kebutuhan versi platform),
      `codegen_validate_dashboard_payload` (butuh platform lebih baru dari 5.5.5),
      `setup_validate_config` (`autoCreateDb`), dan `license deactivate` yang tidak di-wrap MCP.
- [x] Butir 5 — `docs/SKILL-ID.md` disinkronkan. Blok Backend Pipeline versi Indonesia kini
      paralel penuh dengan SKILL.md, termasuk langkah 1 `npx create-restforge-app` sebagai jalur
      primary dan `setup_install_package` sebagai jalur granular.
- [x] Butir 6 — `README.md`: lokasi MCP config project-scope Claude Code dikoreksi menjadi
      `./.mcp.json` sesuai `cli/index.js:44-48`; tabel "Where it installs" diperluas dengan baris
      scope project untuk kedua client.

## 2. File yang Dibuat/Dimodifikasi

Seluruhnya di `restforge-skills/` (4 file, 489 insertion, 57 deletion):

| File | Perubahan |
|---|---|
| `skills/restforge/SKILL.md` | +204/-23. Mental Model menambah domain `license_*`; Preflight menjadi 5 butir (`runtime_detect_config`, `runtime_validate_preflight`, `license_info`); Backend Pipeline direvisi (langkah 7b introspect, 8 models, 12 validate SQL, 16a/16b anotasi perilaku, 16d consumer launcher, 17 generate test, 18 SDK, 19 launcher trio) dan bernomor sampai 21; tabel konvensi nama payload; blok pemilihan config; sub-section `designer_auth_attach`; baris config schema di tabel Grounding-First; Decision Points bertambah 5 cabang; Guardrail 1/2/4 diperluas; section baru "Tools outside this skill's workflows"; tabel ketergantungan versi platform di Prerequisites |
| `docs/SKILL-ID.md` | +218/-25. Sinkron penuh dengan SKILL.md di atas, dalam bahasa Indonesia |
| `skills/restforge/references/rdf-advanced.md` | +50/-0. Tabel grounding tool di kepala file + 8 rujukan tool pada section yang relevan |
| `README.md` | +17/-9. Paragraf `--scope=project`, baris contoh Options, dan tabel "Where it installs" (kini 4 baris: user/project × Claude Code/Cursor) plus catatan asimetri `./.mcp.json` |

Tidak ada file lain yang disentuh: `references/auth.md`, `udf-catalog.md`,
`dbschema-catalog.md`, `field-validation.md`, `design-to-sdf.md`, `config-schema.md`,
`package.json`, `cli/`, dan `*.bat` tidak berubah.

## 3. Hasil Test

Tidak ada test suite di repo ini (sesuai kontrak phase). Verifikasi berbentuk pemeriksaan
silang, hasilnya di section 4.

## 4. Verifikasi Mandiri

### 4.1 Audit cakupan 69 tool

Inventaris dari `packages/mcp-server/src/tools/` pada branch campaign: 69 tool
(`codegen` 27, `setup` 13, `designer` 11, `runtime` 7, `project` 4, `key` 3, `data` 2,
`health` 1, `license` 1). Kolom "Lokasi" adalah bab SKILL.md tempat tool disebut; seluruh
baris juga tercermin di SKILL-ID.md.

| # | Tool | Status | Lokasi utama |
|---|---|---|---|
| 1 | `codegen_create_dashboard` | dalam alur | Backend Pipeline 16b, Decision Points, Guardrails, Prerequisites |
| 2 | `codegen_create_endpoint` | dalam alur | Backend Pipeline 16a, Decision Points, Guardrails |
| 3 | `codegen_create_kafka_consumer` | dalam alur | Backend Pipeline 16d, Decision Points |
| 4 | `codegen_create_processor` | dalam alur | Backend Pipeline 16c, Decision Points, tabel payload |
| 5 | `codegen_dbschema_apply` | dalam alur | Backend Pipeline 10b, Decision Points, Guardrails |
| 6 | `codegen_dbschema_diff` | dalam alur | Backend Pipeline 10b, Decision Points, Guardrails |
| 7 | `codegen_dbschema_generate_ddl` | dalam alur | Backend Pipeline 9 |
| 8 | `codegen_dbschema_init` | dalam alur | Backend Pipeline 7a, Decision Points |
| 9 | `codegen_dbschema_introspect` | dalam alur | Backend Pipeline 7b, Decision Points |
| 10 | `codegen_dbschema_migrate` | dalam alur | Backend Pipeline 10a, Decision Points, Guardrails |
| 11 | `codegen_dbschema_models` | dalam alur (baru) | Backend Pipeline 8, opsional |
| 12 | `codegen_dbschema_template` | dalam alur | Backend Pipeline 7a, Decision Points, Guardrails |
| 13 | `codegen_dbschema_validate` | dalam alur | Backend Pipeline 8, Decision Points |
| 14 | `codegen_describe_table` | dalam alur (baru) | Backend Pipeline 7b, Decision Points § Schema |
| 15 | `codegen_diff_payload` | dalam alur | Backend Pipeline 15, Decision Points |
| 16 | `codegen_generate_payload` | dalam alur | Backend Pipeline 13, Decision Points, Guardrails |
| 17 | `codegen_generate_test` | dalam alur (baru) | Backend Pipeline 17, Decision Points |
| 18 | `codegen_get_dashboard_catalog` | dalam alur | Backend Pipeline 16b, Grounding-First |
| 19 | `codegen_get_dbschema_catalog` | dalam alur | Backend Pipeline 6, Grounding-First |
| 20 | `codegen_get_field_validation_catalog` | dalam alur | Backend Pipeline 11, Grounding-First, rdf-advanced.md |
| 21 | `codegen_get_query_declarative_catalog` | dalam alur | Backend Pipeline 12, Grounding-First, rdf-advanced.md |
| 22 | `codegen_list_tables` | dalam alur (baru) | Backend Pipeline 7b, Decision Points § Schema |
| 23 | `codegen_migrate_payload` | dalam alur | Backend Pipeline 15, Decision Points |
| 24 | `codegen_sync_payload` | dalam alur | Backend Pipeline 15, Decision Points |
| 25 | `codegen_validate_dashboard_payload` | dalam alur (baru) | Backend Pipeline 16b (gate), Guardrail 4, tabel versi platform |
| 26 | `codegen_validate_payload` | dalam alur | Backend Pipeline 14, Guardrail 4 |
| 27 | `codegen_validate_sql` | dalam alur (baru) | Backend Pipeline 12, Decision Points § RDF, rdf-advanced.md, tabel versi platform |
| 28 | `data_pull` | dalam alur | Decision Points § Seeding data |
| 29 | `data_push` | dalam alur | Decision Points § Seeding data |
| 30 | `designer_auth_attach` | dalam alur (baru) | Auth Extension § Retrofit |
| 31 | `designer_auth_create` | dalam alur | Auth Extension, Decision Points |
| 32 | `designer_auth_remove` | dalam alur | Auth Extension, Guardrail 7 |
| 33 | `designer_generate` | dalam alur | Frontend Pipeline 7 |
| 34 | `designer_get_udf_catalog` | dalam alur | Frontend Pipeline 3, Grounding-First |
| 35 | `designer_init_project` | dalam alur | Frontend Pipeline 2, Decision Points |
| 36 | `designer_inspect_plugin` | dalam alur | Frontend Pipeline § plugin development |
| 37 | `designer_list_plugins` | dalam alur | Frontend Pipeline 1, Grounding-First |
| 38 | `designer_preview_files` | dalam alur | Frontend Pipeline 6 |
| 39 | `designer_scaffold_plugin` | dalam alur | Frontend Pipeline § plugin development |
| 40 | `designer_validate_payload` | dalam alur | Frontend Pipeline 5 (gate), Guardrail 4 |
| 41 | `health_ping` | di luar alur | Tools outside this skill's workflows — smoke test transport |
| 42 | `key_generate` | di luar alur | Tools outside — administrasi API key di `.env` |
| 43 | `key_list` | di luar alur | Tools outside — administrasi API key di `.env` |
| 44 | `key_revoke` | di luar alur | Tools outside — administrasi API key di `.env` |
| 45 | `license_info` | dalam alur (baru) | Preflight butir 4; disebut lagi di Tools outside sebagai pasangan `license deactivate` |
| 46 | `project_auth` | dalam alur | Auth Extension § Backend, Decision Points |
| 47 | `project_delete` | dalam alur | Guardrail 1 (destruktif) |
| 48 | `project_list` | di luar alur | Tools outside — inventaris registry |
| 49 | `project_sdk_generate` | dalam alur (baru) | Backend Pipeline 18, Decision Points, Guardrail 1 |
| 50 | `runtime_check_launcher_exists` | dalam alur (baru) | Backend Pipeline 19 |
| 51 | `runtime_check_status` | dalam alur | Backend Pipeline 21, Guardrail 2 |
| 52 | `runtime_detect_config` | dalam alur (baru) | Preflight butir 2 |
| 53 | `runtime_detect_project` | dalam alur | Preflight butir 2 |
| 54 | `runtime_generate_consumer_launcher` | dalam alur (baru) | Backend Pipeline 16d, Decision Points, Guardrail 2 |
| 55 | `runtime_generate_launcher` | dalam alur | Backend Pipeline 19, Guardrail 2 |
| 56 | `runtime_validate_preflight` | dalam alur (baru) | Preflight butir 3, Backend Pipeline 19 |
| 57 | `setup_clear_default_config` | dalam alur (baru) | Backend Pipeline § pemilihan config |
| 58 | `setup_create_folder` | dalam alur | Backend Pipeline 1 (jalur granular) |
| 59 | `setup_get_config_schema` | dalam alur (baru) | Backend Pipeline 4, Grounding-First, Prerequisites |
| 60 | `setup_get_default_config` | dalam alur (baru) | Backend Pipeline § pemilihan config |
| 61 | `setup_get_init_template` | dalam alur (baru) | Backend Pipeline 3 |
| 62 | `setup_init_config` | dalam alur | Backend Pipeline 3 |
| 63 | `setup_install_package` | dalam alur | Backend Pipeline 2 |
| 64 | `setup_list_configs` | dalam alur (baru) | Backend Pipeline § pemilihan config |
| 65 | `setup_read_env` | dalam alur | Backend Pipeline 4 |
| 66 | `setup_set_default_config` | dalam alur (baru) | Backend Pipeline § pemilihan config |
| 67 | `setup_update_env` | dalam alur | Backend Pipeline 4 |
| 68 | `setup_validate_config` | dalam alur | Preflight, Backend Pipeline 5 (gate), Guardrail 3 |
| 69 | `setup_write_env` | dalam alur | Backend Pipeline 4 |

Tool tanpa status: 0. Sebelum phase ini, 23 dari 69 tool tidak disebut sama sekali di seluruh
direktori `restforge-skills/` (issue-49 mencatat 19 dari basis 65 tool; selisihnya adalah empat
tool baru campaign phase 03-04).

### 4.2 Grep bukti tool prioritas

Jumlah kemunculan per file setelah revisi:

| Tool | `SKILL.md` | `docs/SKILL-ID.md` |
|---|---|---|
| `runtime_validate_preflight` | 2 | 2 |
| `codegen_list_tables` | 2 | 2 |
| `codegen_describe_table` | 2 | 2 |
| `codegen_validate_sql` | 3 | 3 |
| `codegen_validate_dashboard_payload` | 6 | 6 |
| `codegen_generate_test` | 2 | 2 |
| `project_sdk_generate` | 3 | 3 |
| `designer_auth_attach` | 3 | 3 |
| `license_info` | 2 | 2 |
| `runtime_generate_consumer_launcher` | 3 | 3 |
| `setup_get_config_schema` | 3 | 3 |

Baris config schema pada tabel Grounding-First:

```
SKILL.md:412     | Setting `db-connection.env` parameters | `setup_get_config_schema` | references/config-schema.md |
SKILL-ID.md:444  | Mengisi parameter `db-connection.env` | `setup_get_config_schema` | references/config-schema.md |
```

`references/rdf-advanced.md` memuat 13 kemunculan nama tool grounding
(`codegen_get_field_validation_catalog`, `codegen_get_query_declarative_catalog`,
`codegen_validate_sql`), dari sebelumnya nol.

### 4.3 Paralelitas SKILL-ID.md vs SKILL.md

Langkah 1 pipeline (drift utama yang disebut issue-49 butir 4):

```
SKILL.md:98      1.  npx create-restforge-app <name>     ── PRIMARY ── human-run scaffolder
SKILL-ID.md:117  1.  npx create-restforge-app <nama>     ── PRIMARY ── scaffolder yang dijalankan user
```

Sebelumnya SKILL-ID.md langkah 1 masih `setup_create_folder` dan langkah 2
`setup_install_package` tanpa syarat.

Ujung pipeline juga sejajar:

```
SKILL.md:227     19. runtime_check_launcher_exists  →  runtime_validate_preflight
SKILL.md:236     21. runtime_check_status
SKILL-ID.md:248  19. runtime_check_launcher_exists  →  runtime_validate_preflight
SKILL-ID.md:256  21. runtime_check_status
```

Kalimat penutup kedua dokumen sama-sama menyebut "langkah 5 gate" dan "langkah 19 titik agent
berhenti" (sebelumnya langkah 17 di kedua file).

### 4.4 `git status` sebelum commit

```
 M README.md
 M docs/SKILL-ID.md
 M skills/restforge/SKILL.md
 M skills/restforge/references/rdf-advanced.md
```

Hanya file scope. Branch `campaign/fix-mcp-gap-v1` (tidak berpindah), commit `77afc06` tanpa
trailer co-author.

### 4.5 Konsistensi klaim vs kode

Setiap klaim perilaku baru ditelusuri ke source pada branch `campaign/fix-mcp-gap-v1`
`packages/mcp-server`:

| Klaim di skill | Rujukan source |
|---|---|
| `createDemo` memetakan ke `--create-examples`; `config` tersedia; `database` dibiarkan kosong agar auto-deteksi `DB_TYPE` jalan (fallback postgres) | `src/tools/codegen/create-endpoint.ts` — deskripsi "Database type is resolved by the CLI…", parameter `createDemo` ("Maps to the CLI flag '--create-examples'"), parameter `config`, komentar `dbTypeLabel` |
| `force` endpoint default true; `force=false` berhenti saat konflik tanpa menulis | `create-endpoint.ts` — `force: z.boolean().default(true)` dan paragraf "Passing force=false gives a non-overwrite path" |
| Dashboard tanpa auto-deteksi database (default postgres polos) | `src/tools/codegen/create-dashboard.ts` — "the 'dashboard create' CLI handler resolves the dialect with a plain default only… It does NOT read DB_TYPE from the active config" |
| `force` dashboard default true dan bisa mengganti tipe database project terdaftar; `force=false` menolak bersih | `create-dashboard.ts` — "with force=true the CLI re-registers the project under whatever 'database' value this call carries" dan daftar tiga kondisi error non-force |
| Payload dashboard wajib nama ber-ekstensi apa adanya | `create-dashboard.ts` parameter `payload` + helper `resolvePayloadPath` di `src/tools/codegen/validate-dashboard-payload.ts` ("the value is used verbatim… No extension is appended anywhere") |
| Payload endpoint/processor: nama dengan atau tanpa `.json`, di-lowercase CLI, bentuk path ditolak | `create-endpoint.ts` dan `src/tools/codegen/create-processor.ts` parameter `payload` |
| Payload kafka consumer: nama atau path | `src/tools/codegen/create-kafka-consumer.ts` parameter `payload` ("Path or file name of the consumer payload JSON") |
| `codegen_validate_sql` memakai verb bentuk spasi `query validate` dan butuh platform pendukung | `src/tools/codegen/validate-sql.ts:36` (`npx restforge query validate …`), `:40`, `:175`, `:207` |
| `codegen_validate_dashboard_payload` butuh platform lebih baru dari 5.5.5, jika tidak menjawab saran upgrade | `validate-dashboard-payload.ts` — "Platform version requirement… That flag exists in the platform source AFTER release 5.5.5" |
| `setup_validate_config` punya opsi `autoCreateDb` yang bersifat write | `src/tools/setup/validate-config.ts:40`, `:54-57`, `:97` |
| `license deactivate` tidak tersedia via MCP | Tidak ada tool `license_*` selain `license_info` di `src/tools/license/index.ts`; alasan tercatat di report phase 03 section 5 butir 6 |
| `project_sdk_generate` menimpa tanpa arsip saat `force=true` | `src/tools/project/sdk-generate.ts` — "the SDK files are rewritten IN PLACE, with NO archive backup" |
| `designer_auth_attach` tidak menyentuh file halaman, mode plugin merender artefak login plugin | `src/tools/designer/auth-attach.ts` — "Page files are never touched", dua lapis pada bagian "What this command does" |
| `runtime_generate_consumer_launcher`: nama file tetap, `config` wajib berekstensi `.env`, mode pm2 mendelegasikan ke `restforge-consumer-deploy` | `src/tools/runtime/generate-consumer-launcher.ts` bagian MODES dan REQUIRED FLAGS |
| `runtime_validate_preflight` memeriksa `.restforge/server.pid` dan ketersediaan port | `src/tools/runtime/validate-preflight.ts` deskripsi tool |
| README: MCP config project-scope Claude Code di `./.mcp.json` | `restforge-skills/cli/index.js:44-48` |

## 5. Keputusan Penting

1. **Basis inventaris 69 tool diambil dari source, bukan dari angka 65 di issue-49.** Issue-49
   ditulis sebelum phase 03-04 menambah empat tool. Memakai daftar lama akan menghasilkan
   "cakupan penuh" yang bohong. Angka 69 dihitung ulang dari `registerTool('…')` di seluruh
   `src/tools/` dan dicocokkan dengan daftar pemanggilan di tiap `index.ts` domain.

2. **Lima tool dinyatakan di luar alur, bukan dipaksakan masuk pipeline.** `health_ping` menguji
   transport MCP dan tidak menyentuh RESTForge; trio `key_*` mengurus API key di file `.env`
   yang tidak berhubungan dengan definition file maupun code generation; `project_list` berguna
   untuk orientasi tetapi tidak pernah menjadi prasyarat langkah lain. Kontrak phase menyebut
   status eksplisit lebih penting daripada cakupan semu, dan itu yang diambil. `license_info`
   sebaliknya justru dimasukkan ke Preflight karena menjawab pertanyaan license yang memang
   muncul sebelum gate `setup_validate_config`.

3. **Lima tool config default (`setup_list_configs`, `setup_set_default_config`,
   `setup_get_default_config`, `setup_clear_default_config`, `setup_get_init_template`)
   dimasukkan sebagai blok tersendiri, bukan sebagai langkah bernomor.** Kelimanya tidak punya
   posisi tetap dalam urutan pipeline, tetapi menentukan config mana yang dipakai tool lain saat
   parameter `config` dikosongkan. Menempatkannya sebagai catatan setelah pipeline menjaga
   golden path tetap terbaca sementara statusnya tetap eksplisit.

4. **Penomoran pipeline naik dari 19 ke 21 langkah, dan kalimat "step 17" ikut dikoreksi.**
   Alternatifnya adalah menyisipkan langkah baru sebagai sub-nomor agar penomoran lama awet,
   tetapi trio launcher (`check_launcher_exists` → `validate_preflight` → `generate_launcher`)
   memang satu langkah berurutan dan test/SDK adalah langkah opsional setelah generate, bukan
   varian dari langkah lain. Kedua kalimat checkpoint di SKILL.md dan SKILL-ID.md diperbarui
   agar tidak menunjuk nomor yang sudah bergeser.

5. **`codegen_dbschema_models` masuk pipeline sebagai catatan opsional di langkah 8, bukan ke
   section "outside".** Tool ini membaca file SDF yang persis sedang disusun di langkah itu,
   jadi menempatkannya sebagai listing pendamping `codegen_dbschema_validate` lebih jujur
   daripada menyebutnya "jarang dipakai".

6. **Konvensi nama payload disajikan sebagai tabel tiga baris, bukan sebagai catatan tersebar
   di tiap langkah.** Perbedaan bentuk argumen antar generator adalah tepat jenis fakta yang
   dilupakan agent saat memanggil dua tool berbeda dalam satu sesi (temuan phase 02f/02g), dan
   tabel membuat ketiganya terbaca sekaligus.

7. **`references/` lain tidak disentuh.** Pemeriksaan terhadap `auth.md`, `udf-catalog.md`,
   `config-schema.md`, `dbschema-catalog.md`, `field-validation.md`, dan `design-to-sdf.md`
   tidak menemukan pernyataan yang menjadi salah akibat campaign: perubahan phase 01-04 semua
   berada di lapisan parameter dan deskripsi tool MCP, bukan di catalog SDF/RDF/UDF. Karena itu
   larangan "jangan ubah references selain rdf-advanced.md" tidak perlu dikecualikan.

8. **README diperluas satu baris tabel per client, bukan sekadar mengganti kata.** Tabel lama
   hanya punya kolom user scope, sehingga koreksi `./.mcp.json` tidak punya tempat untuk hidup.
   Menambahkan baris project scope membuat asimetri Claude Code (skill di `./.claude/skills/`,
   MCP di `./.mcp.json`) terlihat, karena justru asimetri itulah yang membuat teks lama salah
   dibaca.

## 6. Hal yang Belum Diverifikasi

1. **Efek skill pada agent nyata belum diuji.** Tidak ada cara memverifikasi di phase ini bahwa
   agent yang membaca SKILL.md hasil revisi benar-benar memanggil `codegen_validate_sql` sebelum
   menulis query. Klaim yang bisa dipertanggungjawabkan hanya bahwa instruksinya ada, tidak
   ambigu, dan cocok dengan perilaku tool.

2. **Angka versi platform diambil apa adanya dari deskripsi tool.** "confirmed present in 5.5.5"
   untuk `query validate` dan "after release 5.5.5" untuk `dashboard create --validate-only`
   disalin dari `validate-sql.ts` dan `validate-dashboard-payload.ts`; tidak ada uji CLI live di
   phase ini. Ambang minimum sebenarnya untuk `query validate` tetap belum diketahui, dan itu
   dinyatakan eksplisit di dokumen.

3. **Nomor baris yang dikutip di section 4 mengacu pada working tree saat commit `77afc06`.**
   Bila SKILL.md disunting lagi, nomornya bergeser; nama bab tetap menjadi rujukan yang stabil.

## 7. Pertanyaan untuk Orchestrator

1. **`docs/SKILL-ID.md` kini memuat dua tabel baru yang isinya identik dengan SKILL.md
   (konvensi payload dan ketergantungan versi platform).** Dokumen itu berlabel "terjemahan
   internal", jadi duplikasi tabel teknis wajar. Bila kebijakannya justru meminta SKILL-ID.md
   hanya merangkum, bagian itu bisa diringkas menjadi rujukan silang.

2. **`project_list` ditempatkan di luar alur.** Argumen tandingannya ada: tool itu bisa jadi
   langkah orientasi pertama pada project yang sudah berjalan ("project apa saja yang terdaftar
   di sini"). Ditempatkan di luar alur karena tidak pernah menjadi prasyarat langkah berikutnya.
   Bila orchestrator menghendaki sebaliknya, pemindahannya satu baris.

3. **Empat tool baru campaign belum punya jejak di handbook.** `project_sdk_generate`,
   `designer_auth_attach`, `license_info`, dan `runtime_generate_consumer_launcher` kini
   terdokumentasi di skill, tetapi issue-48 (handbook tanpa dokumentasi MCP server) adalah milik
   phase 06-07. Skill dan handbook karenanya masih berbeda cakupan sampai phase itu selesai.

4. **Temuan di luar scope, tidak dikerjakan:** `README.md` menyebut instalasi MCP server dengan
   `npm install -g @restforgejs/mcp-server` di section Prerequisites SKILL.md, sementara
   `cli/index.js` default-nya justru `npx -y @restforgejs/mcp-server` tanpa global install.
   Keduanya valid sebagai cara registrasi, tetapi kalimat di SKILL.md membaca seolah global
   install adalah satu-satunya jalan. Perbaikannya bukan bagian dari tujuh butir spesifikasi
   phase ini, jadi hanya dilaporkan.
