# Phase 05 — Sinkronisasi `restforge-skills` (Issue-49 + Perubahan Campaign)

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 05. Sumber kebenaran:

- `packages/platform/docs/issues/issue-49-restforge-skills-19-tool-tanpa-jalur-pemakaian-dan-drift-internal.md`
- Surface tool aktual: `packages/mcp-server/src/` di branch `campaign/fix-mcp-gap-v1`
  (69 tool; inventarisasi sendiri dari `src/tools/*/index.ts` + `server.ts`)
- Report phase 01-04 di `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/`
  untuk perubahan perilaku yang harus tercermin di skill

Baca issue-49 dan skim report 01-04 (minimal section "Keputusan Penting") sebelum
mengubah apa pun.

## Tujuan (Objective)

Menutup issue-49: setiap tool dari 69 tool MCP berstatus tercakup di SKILL.md/references
atau tercatat sengaja di luar cakupan; drift internal terkoreksi; dan dokumentasi skill
mencerminkan perilaku tool PASCA phase 01-04.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di repo `restforge-skills` (repo baru di-init orchestrator,
baseline `4bc9041`). Verifikasi `git -C restforge-skills branch --show-current`;
dilarang pindah branch; repo lain hanya boleh DIBACA.

## Spesifikasi Perubahan

Semua di `restforge-skills/`:

1. **Cakupan 69 tool.** Buat inventaris tool terdaftar, lalu pastikan tiap tool punya
   satu dari dua status:
   - Disebut di `skills/restforge/SKILL.md` (bab yang relevan) atau di references
     yang sesuai, ATAU
   - Tercatat di section baru ringkas di SKILL.md (mis. "Tools outside this skill's
     workflows") yang menyebut nama tool + satu frasa alasan (diagnostik, jarang
     dipakai, dsb.). Jangan memaksakan tool masuk pipeline bila memang bukan bagian
     alur; status eksplisit lebih penting daripada cakupan semu.
   Prioritas yang DIMASUKKAN ke alur (keputusan issue-49): `runtime_validate_preflight`
   (bab Preflight), `codegen_list_tables` + `codegen_describe_table` (alur introspect),
   `codegen_validate_sql` (sebelum menulis query di RDF), `codegen_validate_dashboard_payload`
   (gate sebelum `codegen_create_dashboard`, dengan catatan butuh platform lebih baru
   dari 5.5.5), `codegen_generate_test` (setelah endpoint jadi). Tool baru campaign
   juga wajib masuk: `project_sdk_generate`, `designer_auth_attach`, `license_info`,
   `runtime_generate_consumer_launcher` (pipeline consumer: create → launcher → user
   menjalankan).
2. **Tabel Grounding-First:** tambah baris config schema (`setup_get_config_schema` +
   `references/config-schema.md`).
3. **`references/rdf-advanced.md`:** tambahkan referensi tool grounding pada bagian
   yang relevan (minimal `codegen_get_field_validation_catalog` dan
   `codegen_get_query_declarative_catalog`).
4. **Perubahan perilaku campaign yang wajib tercermin** (perbarui bagian SKILL.md /
   references yang menyentuhnya; jangan menulis ulang seluruh dokumen):
   - `codegen_create_endpoint`: parameter `createDemo` memetakan ke CLI
     `--create-examples`; parameter `config` tersedia; `database` DIBIARKAN KOSONG
     agar auto-deteksi `DB_TYPE` config jalan (fallback postgres); `force` default
     true, `force=false` = jalur non-overwrite yang berhenti saat konflik.
   - `codegen_create_dashboard`: TIDAK ada auto-deteksi database (default postgres
     polos); `force` default true dan bisa mengganti tipe database project terdaftar,
     `force=false` menolak bersih; payload WAJIB nama ber-ekstensi apa adanya.
   - Konvensi payload per tool: dashboard = nama/path ber-ekstensi apa adanya;
     endpoint/processor = nama (dengan/tanpa `.json`, di-lowercase CLI, bentuk path
     ditolak); kafka consumer = nama atau path.
   - `codegen_validate_sql`: verb `query validate` bentuk spasi; butuh platform yang
     mendukungnya.
   - `codegen_validate_dashboard_payload`: berfungsi hanya dengan platform yang punya
     `dashboard create --validate-only` (lebih baru dari 5.5.5); pada platform lama
     tool menjawab saran upgrade.
   - `setup_validate_config`: opsi `autoCreateDb`.
   - `license deactivate` tidak tersedia via MCP (user menjalankan manual).
5. **`docs/SKILL-ID.md`:** sinkronkan blok Backend Pipeline (dan bagian lain yang
   drift) dengan SKILL.md hasil revisi phase ini. Terjemahan mengikuti gaya dokumen
   itu (bahasa Indonesia).
6. **`README.md`:** koreksi tabel/teks lokasi instalasi MCP config project-scope
   Claude Code menjadi `./.mcp.json` sesuai perilaku `cli/index.js`.

## Aturan Implementasi

- DO: pertahankan gaya penulisan SKILL.md (bahasa Inggris, struktur bab, format
  tabel existing); SKILL-ID.md berbahasa Indonesia.
- DO: patuhi aturan bahasa dokumen .md Indonesia pada SKILL-ID.md (istilah teknis
  bentuk asli, tanpa em dash dalam kalimat).
- DON'T: mengubah `skills/restforge/references/*.md` selain `rdf-advanced.md` kecuali
  ada drift faktual langsung akibat campaign (mis. bila `udf-catalog.md`/`auth.md`
  menyebut perilaku yang kini salah; perubahan minimal, laporkan).
- DON'T: bump version `package.json` restforge-skills, jalankan `bump-and-publish.bat`,
  atau `npm publish`.
- DON'T: commit file `docs/worker-context/` (itu di repo mcp-server, bukan di sini).

## Test yang Wajib Dijalankan

Tidak ada test suite. Verifikasi berbentuk pemeriksaan silang (bagian berikut).

## Verifikasi Mandiri

1. **Audit cakupan:** tabel 69 tool → status (bab/section yang menyebutnya, atau
   "outside workflows"). Nol tool tanpa status.
2. Grep bukti: tiap tool prioritas butir 1 muncul di SKILL.md; baris config schema ada
   di tabel Grounding-First; `rdf-advanced.md` memuat nama tool grounding.
3. Diff ringkas SKILL-ID.md vs SKILL.md: blok pipeline kini paralel (tunjukkan
   beberapa baris kunci, mis. langkah 1 create-restforge-app).
4. Output `git -C restforge-skills status` sebelum commit: hanya file scope.
5. Konsistensi klaim vs kode: setiap klaim perilaku baru yang kamu tulis harus cocok
   dengan source mcp-server branch campaign; sebutkan file rujukan untuk tiap klaim
   utama di report.

## Kontrak Laporan

Commit dulu di branch campaign restforge-skills (pesan menyebut
`fix-mcp-gap-v1 phase-05`, TANPA trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-05-sinkronisasi-restforge-skills.md`

Report 7 section standar, termasuk tabel audit cakupan 69 tool. Paste isi report
sebagai response, tutup dengan baris path lengkap file report.

## Strict Per-Phase

Kerjakan HANYA restforge-skills. Handbook milik phase 06-07 (digate konfirmasi user).
Temuan baru dilaporkan, tidak dikerjakan.
