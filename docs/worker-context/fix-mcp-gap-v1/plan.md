# Campaign: fix-mcp-gap-v1

Master plan penutupan temuan audit gap MCP (issue-46 s.d. issue-51). Dikelola oleh
orchestrator; worker mengerjakan satu phase per prompt.

## Goal

Menutup keenam issue hasil audit gap MCP 2026-08-21 sehingga:

1. Setiap verb publik CLI punya tool MCP atau catatan eksplisit "sengaja tidak di-wrap"
   (issue-46).
2. Setiap flag CLI terdokumentasi untuk verb yang di-wrap berstatus diekspos, hardcode
   beralasan, atau sengaja tidak diekspos; `endpoint create` via MCP punya jalur
   non-overwrite (issue-47).
3. Handbook memuat spec MCP (daftar tool + pemetaan verb CLI) sebagai baseline deteksi
   drift (issue-48).
4. Semua 65+ tool MCP punya status cakupan di restforge-skills; drift SKILL-ID.md dan
   README installer terkoreksi (issue-49).
5. Tidak ada deskripsi tool yang menyebut verb bentuk lama; bentuk verb yang dieksekusi
   `codegen_validate_sql` terverifikasi cocok dengan kontrak CLI (issue-50).
6. Indeks command handbook mencerminkan file aktual dan tidak ada contoh dengan flag di
   luar spec (issue-51).

Kriteria tercapai: seluruh checklist "Kriteria Selesai" pada keenam file issue
terpenuhi, dibuktikan report phase acceptance, dan status issue diupdate saat penutupan.

## Konfigurasi Campaign

| Item | Nilai |
|---|---|
| Sumber kebenaran | `packages/platform/docs/issues/issue-46-*.md` s.d. `issue-51-*.md` (+ issue-45 sebagai konteks terkait) |
| Working directory utama | `packages/mcp-server` |
| Worker-context | `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/` |
| Mode eksekusi | Mode A (background agent) |
| Model worker | opus (override saat launch subagent) |
| Tracking issue GitHub | Tidak aktif |
| Branch mcp-server | `campaign/fix-mcp-gap-v1` (dari `main`) |
| Branch restforge-skills | `campaign/fix-mcp-gap-v1` (repo baru di-init, baseline `4bc9041` di `main`) |
| Branch platform | `campaign/fix-mcp-gap-v1` (dari `main`; dibuat setelah Q13=A memperluas scope ke issue-45) |
| Branch handbook | `campaign/fix-mcp-gap-v1` (dari ujung `campaign/single-table-lookup-v1` commit `5863163`, keputusan Q15=B; merge nanti membawa perubahan lookup yang belum merge). Gate phase 06-07 dibuka user (Q14=A). Working tree memuat file dirty pra-existing di luar campaign: `api-spec/README.md`, `catalogs/rdf/README.md` (modified), upload/file-storage (untracked); JANGAN di-stage worker |

## Aturan Campaign

Aturan global default section 8 skill mode-orchestrator berlaku, ditambah:

1. Perubahan `restforge-handbook/` digate konfirmasi user per phase (aturan repo).
   Phase 06 dan 07 TIDAK boleh dimulai tanpa konfirmasi eksplisit.
2. Tanpa bump version atau release artifact di semua repo.
3. Phase 00 bersifat read-only (verifikasi): tidak ada commit, dikecualikan dari aturan
   "satu phase minimal satu commit".
4. Commit tanpa trailer co-author (aturan global user).
5. Worker dilarang menjalankan `npm publish`/`npm login` (kebijakan user; publish
   ditangani user sendiri).
6. `packages/restforge-plugins/skills/restforge-skills/` adalah mirror hasil generate
   (`sync-to-plugin.bat`); jangan di-hand-edit.

## Keputusan Campaign (dari evaluasi phase 00)

1. **Q10=A:** `codegen_validate_sql` diganti ke bentuk spasi `query validate` TANPA
   fallback bentuk kolon. Deskripsi tool menyebut kebutuhan platform yang mendukung
   sub-command `query validate`.
2. **Q11=A:** klaim `--format json` di `validation-rules.md:41` dikoreksi di phase 07;
   issue platform baru (wire `reportJson` ke CLI, kandidat flag `--json` konsisten
   dengan `schema diff`) dibuat saat penutupan campaign.
3. `license_info` meneruskan output teks CLI apa adanya, tanpa parsing terstruktur.
4. Temuan baru di luar scope dicatat sebagai issue terpisah saat penutupan, TIDAK
   dikerjakan campaign ini: 3 verb tak terdokumentasi (`endpoint list`,
   `processor list`, `project tenant`), drift `--config` wajib di `restforge-consumer`,
   drift `query validate --config` (opsional di CLI vs wajib di handbook).
5. Lingkungan uji live standar campaign: `smoke-test-home/` (platform ter-install
   5.5.5, identik source, bebas anti-tamper).
6. **Q13=A (perluasan scope):** issue-45 masuk campaign. Phase 02e menambahkan flag
   `--validate-only` ke contract `dashboard create` di `packages/platform`; phase 02f
   menyelaraskan sisi mcp-server + parameter `force` pada `codegen_create_dashboard`
   (menutup bypass proteksi ganti tipe database). Scope platform DIBATASI pada
   `dashboard create` validate-only; temuan platform lain (asimetri auto-deteksi,
   tanpa validasi dbtype jalur dashboard) tetap jadi issue baru saat penutupan.

## Breakdown Phase

| Phase | Topik | Repo/Area | Issue | Dependensi |
|---|---|---|---|---|
| 00 | Verifikasi kontrak CLI platform (read-only): bentuk verb `query validate` vs `query:validate`, `--format json` pada `schema validate`, perilaku `--validate-only` pada `dashboard create` saat ini, keberadaan + flag `project sdk` / `designer auth --attach` / `license info` / `license deactivate` / `restforge-consumer(-deploy)` di source | `packages/platform` (baca saja) + uji CLI di project playground | Grounding 46, 47, 50, 51 | — |
| 01 | Fix deskripsi verb kolon lama (4 tool) + selaraskan bentuk eksekusi `codegen_validate_sql` sesuai verdict phase 00 | `packages/mcp-server` | 50 | 00 |
| 02 | Ekspos flag yang hilang (`generate_payload`, `validate_config`, `create_endpoint`, `dbschema_init`) + jalur non-overwrite `create_endpoint` + peringatan destruktif pada deskripsi tool ber-hardcode | `packages/mcp-server` | 47 | 00 |
| 03 | Tool baru: `project_sdk_generate`, `designer_auth_attach`, `license_info`; catat keputusan `license_deactivate` di SERVER_INSTRUCTIONS | `packages/mcp-server` | 46 (butir 1-3) | 00 |
| 04 | Launcher consumer: perluasan `runtime_generate_launcher` atau tool baru untuk `restforge-consumer`/`restforge-consumer-deploy` | `packages/mcp-server` | 46 (butir 4) | 00, 03 |
| 05 | Sinkronisasi restforge-skills: status 19 tool, tabel Grounding-First, `rdf-advanced.md`, `SKILL-ID.md`, README installer, jalankan sync-to-plugin | `restforge-skills` | 49 | 01-04 (agar tool baru ikut tercakup) |
| 06 | Handbook: bagian spec MCP (`restforge-handbook/mcp/`) — **GATE: konfirmasi user + keputusan branch handbook** | `restforge-handbook` | 48 | 01-04 |
| 07 | Handbook: perbaikan indeks command + contoh flag salah — **GATE: konfirmasi user** | `restforge-handbook` | 51 | 00, 06 (branch sama) |
| 08 | Acceptance: build + test mcp-server, smoke test tool baru/berubah terhadap project uji, cek silang kriteria selesai keenam issue | lintas repo | semua | 01-07 |

Penutupan (setelah phase 08 diterima): update `Status:` keenam file issue di
`packages/platform/docs/issues/`, rekap commit per repo, daftar follow-up. Ditangani
orchestrator, bukan worker.

## Status Tracking

| Phase | Status | Prompt | Report | Commit | Catatan |
|---|---|---|---|---|---|
| 00 | Diterima | `prompts/phase-00-verifikasi-kontrak-cli.md` | `reports/phase-00-verifikasi-kontrak-cli.md` | — (read-only) | 8 klaim tuntas, bukti ganda source + CLI live 5.5.5. Temuan kunci: `query:validate` bentuk kolon MATI (codegen_validate_sql rusak fungsional); `--validate-only` ditolak keras (tanpa risiko silent-generate); `--format json` tidak ter-wire di CLI; prasyarat issue-46 semua valid. Temuan baru di luar scope: 3 verb tak terdokumentasi (`endpoint list`, `processor list`, `project tenant`), drift `--config` wajib di `restforge-consumer`, `query validate --config` opsional vs handbook wajib. |
| 01 | Diterima | `prompts/phase-01-fix-deskripsi-dan-verb-form.md` | `reports/phase-01-fix-deskripsi-dan-verb-form.md` | `59ddc04` | 6 file (termasuk temuan tambahan `get-init-template.ts`, diterima). Build lolos; CLI live: bentuk kolon ditolak dispatch, bentuk spasi sampai handler. Follow-up penutupan: klaim versi stale `>= 2.4.0`/`>= 2.3.1` di 3 tool; jalur sukses validate-sql diuji phase 08. |
| 02 | Diterima | `prompts/phase-02-ekspos-flag-dan-non-overwrite.md` | `reports/phase-02-ekspos-flag-dan-non-overwrite.md` | `cca21ef` | force=false di-wire aman (stdin ignore, deteksi aborted); butir 4 terbantah (`schema init` tanpa `--force`, deskripsi dikoreksi); butir 5 nihil (peringatan sudah ada). Temuan bug baru: `--create-demo` vs `--create-examples` → phase 02b. Uji lapangan force=false → phase 08. |
| 02b | Diterima | `prompts/phase-02b-fix-create-demo-dan-ekspos-config.md` | `reports/phase-02b-fix-create-demo-dan-ekspos-config.md` | `9e31e0e` | Flag `--create-examples` diperbaiki (bukti live: bentuk lama exit 2), `config` diekspos; harness build membuktikan jalur default identik. Keputusan: nama `createDemo` permanen untuk 1.x. Temuan baru → phase 02c (Q12=A). |
| 02c | Diterima | `prompts/phase-02c-database-autodetect-dan-sqlite.md` | `reports/phase-02c-database-autodetect-dan-sqlite.md` | `c0997ea` | Flag kondisional + enum sqlite terbukti via harness build + CLI live; fallback postgres tetap di CLI. Uji auto-deteksi non-postgres → phase 08. Sweep orchestrator: pola sama di create-dashboard + validate-dashboard-payload → phase 02d. |
| 02d | Diterima | `prompts/phase-02d-database-kondisional-dashboard.md` | `reports/phase-02d-database-kondisional-dashboard.md` | `434be05` | GATE menolak pola 02c (dashboard create tanpa auto-deteksi, hanya `\|\| 'postgres'`); dikerjakan enum sqlite + deskripsi. Temuan: validate_dashboard_payload rusak 100% (= issue-45) → Q13; asimetri auto-deteksi + tanpa validasi dbtype di jalur dashboard platform → issue baru saat penutupan; force=true bypass proteksi ganti dbtype → ikut keputusan Q13. |
| 02e | Diterima | `prompts/phase-02e-platform-dashboard-validate-only.md` | `reports/phase-02e-platform-dashboard-validate-only.md` | `96bce81` (platform) | Flag validate-only berfungsi; test 3784→3795 pass 0 fail; verifikasi via cli-entry.js (server.js diblokir anti-tamper). Temuan: MCP dashboard strip ekstensi payload + findPayloadFile tanpa auto-.json = akar issue-45 butir 2 → phase 02f. Backlog penutupan: test stale generators/tests. Phase 07 + dokumentasi flag baru. |
| 02f | Diterima | `prompts/phase-02f-mcp-selaraskan-dashboard-tools.md` | `reports/phase-02f-mcp-selaraskan-dashboard-tools.md` | `1ecc27a` | GATE: konflik dashboard error bersih tanpa readline → force tanpa stdin machinery. Payload passthrough terbukti live (run C reproduksi gejala issue-45, run A bentuk baru lolos). Deteksi platform lama via string pesan. Run H konfirmasi risiko force=true ganti dbtype (didokumentasikan). Temuan: bug ekstensi payload di create_endpoint (+processor/kafka belum dicek) → phase 02g. |
| 02g | Diterima | `prompts/phase-02g-sweep-payload-passthrough.md` | `reports/phase-02g-sweep-payload-passthrough.md` | `95eedde` | Audit membantah premis 02f: endpoint/processor kebal bug ekstensi (validatePayloadName normalisasi); diperbaiki schema/pre-flight/deskripsi yang tidak sinkron; kafka tanpa mismatch, tidak diubah. Catatan penutupan issue-45: butir 2 hanya jalur dashboard. Backlog: sweep payload Designer, penyeragaman konvensi payload platform. |
| 03 | Diterima | `prompts/phase-03-tool-baru-sdk-attach-license.md` | `reports/phase-03-tool-baru-sdk-attach-license.md` | `0651ffc` | 68 tool terdaftar (harness McpServer asli); perilaku force SDK dari source; force tidak diekspos di auth attach (relevan --remove saja). Keputusan: plugins-dir → backlog; license deactivate final tidak di-wrap; project tenant → issue baru; phase 08 pakai playground segar. |
| 04 | Diterima | `prompts/phase-04-consumer-launcher.md` | `reports/phase-04-consumer-launcher.md` | `b0c1f0f` | 69 tool; mode host tulis skrip `--flag=value`, mode pm2 delegasi consumer-deploy (prompt interaktif dihindari via pre-check + stdin ignore). Keputusan: koreksi handbook --config consumer → phase 07; check tool consumer/nama per-consumer/status consumer → backlog; phase 08 verifikasi pm2 saja. |
| 05 | Diterima | `prompts/phase-05-sinkronisasi-restforge-skills.md` | `reports/phase-05-sinkronisasi-restforge-skills.md` | `77afc06` (restforge-skills) | 69/69 tool berstatus (64 alur, 5 eksplisit di luar); SKILL-ID sinkron; README `./.mcp.json`; mirror plugin identik. Follow-up penutupan: kalimat global-install mcp-server di Prerequisites kedua dokumen skill. |
| 06 | Diterima | `prompts/phase-06-handbook-spec-mcp.md` | `reports/phase-06-handbook-spec-mcp.md` | `a074d31` (handbook) | mcp/ 10 file; audit dua arah 69=69 nol selisih; install lokal ditegakkan; dirty pra-existing utuh. Temuan → 06b (README mcp-server stale), phase 07 (+navigasi repo, data pull path, tautan commands→mcp). Backlog: penegakan angka 69. |
| 06b | Diterima | `prompts/phase-06b-readme-mcp-server.md` | `reports/phase-06b-readme-mcp-server.md` | `89d7017` | README package sinkron 69 tool + koreksi klaim (Node>=18, sqlite, data_* license); global install hilang. Konfirmasi user saat penutupan: URL handbook publik, status publish create-restforge-skills. |
| 07 | Diterima | `prompts/phase-07-handbook-koreksi-drift.md` | `reports/phase-07-handbook-koreksi-drift.md` | `0efc9f8` (handbook) | Butir A-E tuntas; hitungan 47 terverifikasi; layout data pull bersarang per schema (bukti source); 6 .report.md dihapus. Temuan → 07b (push.md), backlog (penegakan angka 47/9/69). |
| 07b | Diterima | `prompts/phase-07b-push-md-layout.md` | `reports/phase-07b-push-md-layout.md` | `911d164` (handbook) | Blurb push.md dua bentuk layout; verba `dibaca` (akurasi arah) diterima. |
| 08 | Diterima | `prompts/phase-08-acceptance.md` | `reports/phase-08-acceptance.md` | — (verifikasi) | E2E MCP nyata pertama kali: 69 tool live; platform test identik baseline; 10 uji (9 CONFIRMED). Verdict: 46/48/49/50/51 CONFIRMED; 45 PARTIAL (butir smoke test → backlog); 47 PARTIAL (bug detektor abortedOnPrompt → phase 08b). Temuan insidental: dbschema_init non-.js, skeleton dummy → issue baru. Playground 179 MB dibiarkan. |
| 08b | Diterima | `prompts/phase-08b-fix-aborted-detector.md` | `reports/phase-08b-fix-aborted-detector.md` | `1eced89` | Detektor OR (y/N \| CONFLICTS DETECTED); uji A/B/C via MCP nyata lolos; issue-47 naik CONFIRMED. |

## Status Campaign: SELESAI (2026-08-23)

Seluruh phase diterima; acceptance phase 08 + 08b memenuhi ketujuh kriteria issue
(45 dengan catatan butir smoke test dipindah ke issue-57). Penutupan: status ketujuh
issue diubah menjadi "Fixed di branch campaign, menunggu merge"; issue baru 52-58
dibuat untuk temuan di luar scope; playground `D:\restforge-playground\mcp-gap-acceptance\`
(179 MB) menunggu penghapusan oleh user setelah tidak diperlukan.

Commit per repo (semua di branch `campaign/fix-mcp-gap-v1`, belum merge):

| Repo | Commit (urut) |
|---|---|
| packages/mcp-server | `59ddc04`, `cca21ef`, `9e31e0e`, `c0997ea`, `434be05`, `1ecc27a`, `95eedde`, `0651ffc`, `b0c1f0f`, `89d7017`, `1eced89` |
| packages/platform | `96bce81` |
| restforge-skills | `77afc06` (baseline repo baru `4bc9041` di main) |
| restforge-handbook | `a074d31`, `0efc9f8`, `911d164` (basis: ujung single-table-lookup-v1 `5863163`) |
