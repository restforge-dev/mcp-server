# Phase 06 — Handbook: Bagian Spec MCP Server (Issue-48)

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 06. Gate konfirmasi user sudah
dibuka (Q14=A). Sumber kebenaran:

- `packages/platform/docs/issues/issue-48-handbook-tanpa-dokumentasi-mcp-server.md`
- Surface tool aktual: `packages/mcp-server/src/` branch `campaign/fix-mcp-gap-v1`
  (69 tool; inventarisasi sendiri, JANGAN memakai angka dari issue yang stale)
- `restforge-skills/skills/restforge/SKILL.md` branch campaign (rujukan silang gaya
  penjelasan perilaku, BUKAN untuk disalin mentah)
- Report phase 00-05 di `packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/`
  (khususnya keputusan verb yang sengaja tidak di-wrap dan catatan perilaku per tool)

## Tujuan (Objective)

Menutup issue-48: handbook memuat spec publik MCP server sehingga audit "setiap tool
punya spec, setiap spec punya tool" bisa dijalankan, dan penambahan/penghapusan tool
tanpa update handbook terdeteksi sebagai drift.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di repo `restforge-handbook` (sudah dibuat orchestrator dari
ujung `campaign/single-table-lookup-v1`, commit `5863163`). Verifikasi
`git -C restforge-handbook branch --show-current`; dilarang pindah branch.

**PERINGATAN staging:** working tree memuat perubahan pra-existing di LUAR campaign
ini: `api-spec/README.md` dan `catalogs/rdf/README.md` (modified) serta file untracked
`api-spec/endpoint-upload.md`, `catalogs/rdf/upload-config.md`, `features/file-storage/`.
JANGAN menyentuh dan JANGAN men-stage file-file itu. Stage HANYA file yang kamu buat
di `mcp/` (dan file indeks yang kamu ubah, lihat spesifikasi butir 4).

## Spesifikasi Perubahan

1. **Folder baru `restforge-handbook/mcp/`** berisi:
   - `README.md` — ikhtisar: apa itu `@restforgejs/mcp-server`, cara instal/registrasi
     (via `npx create-restforge-skills` atau entri manual `npx -y @restforgejs/mcp-server`
     / binary `restforge-mcp`; JANGAN menyarankan `npm install -g` sebagai jalur utama,
     kebijakan repo adalah install lokal), prasyarat (`@restforgejs/platform` di
     `node_modules` project target; lisensi untuk `codegen_*`/`runtime_*`/
     `setup_validate_config`), pola umum (precondition non-error, flag hardcode
     `--yes`/`--force` pada tool destruktif, masking field sensitif, pola dua langkah
     launcher), dan tabel ringkas 9 domain + jumlah tool.
   - Satu halaman per domain (`setup.md`, `codegen.md`, `designer.md`, `runtime.md`,
     `data.md`, `key.md`, `project.md`, `health.md`, `license.md`) berisi tabel:
     tool | verb CLI yang di-wrap (atau "operasi file langsung") | parameter |
     catatan perilaku. Catatan perilaku memuat hal yang menyimpang dari CLI atau
     penting bagi pemakai: hardcode, default yang berubah perilaku (mis. `database`
     endpoint yang auto-deteksi vs dashboard yang tidak), konvensi payload per tool,
     kebutuhan versi platform (`query validate` bentuk spasi; `dashboard create
     --validate-only` hadir setelah 5.5.5), sifat destruktif.
   - Section **"Verb yang sengaja tidak di-wrap"** di README mcp: `fast-track`
     (interaktif), `serve`/runtime start-stop (pola launcher), `license deactivate`
     (mutasi aktivasi lintas mesin), beserta satu kalimat alasan masing-masing.
2. **Akurasi adalah kriteria utama.** Setiap baris tabel harus dicek terhadap source
   tool di `packages/mcp-server/src/`. Jangan menyalin klaim dari issue (stale) atau
   dari ingatan. Jumlah tool di dokumen harus 69 dan cocok dengan hitungan
   `registerTool` di source.
3. **Audiens handbook:** pengguna publik. Jelaskan alur dan perilaku; JANGAN dump
   internal implementasi (nama fungsi TS, struktur folder src, mekanisme execa).
   Nama parameter dan flag CLI adalah kontrak publik, itu boleh dan wajib.
4. **Indeks handbook:** tautkan bagian baru dari `restforge-handbook/README.md`
   (satu baris/entri di daftar isi utama, konsisten gaya existing). Bila ada file
   indeks lain yang jelas relevan, tambahkan minimal; jangan merombak.
5. **JANGAN menyentuh** `commands/`, `catalogs/`, `examples/`, `features/` — koreksi
   drift di sana adalah phase 07.

## Aturan Bahasa dan Gaya

Handbook berbahasa Indonesia. Patuhi konvensi dokumen .md repo ini:
- Heading Indonesia murni tanpa terjemahan kurung; istilah teknis IT bentuk asli
  (file, tool, server, endpoint, payload, flag, wrapper, dst.).
- Em dash tidak dipakai di dalam kalimat (gunakan kata hubung); baku tetapi natural,
  bukan terjemahan harfiah.
- Preposisi "di" dipisah dari kata tempat; awalan "di-" pada kata kerja disambung.
- Lihat file handbook existing (mis. `commands/restforge-backend/README.md`) sebagai
  acuan format tabel dan nada.

## Test yang Wajib Dijalankan

Tidak ada test suite. Verifikasi berbentuk audit silang (bagian berikut).

## Verifikasi Mandiri

1. **Audit dua arah:** daftar 69 tool dari source vs daftar tool di halaman-halaman
   `mcp/` → keduanya identik, nol selisih. Tunjukkan hitungan per domain.
2. Grep `npm install -g @restforgejs/mcp-server` di `mcp/` → nol hasil (kebijakan
   install lokal).
3. Spot-check minimal 5 baris tabel terhadap source (kutip file rujukannya di report):
   termasuk satu tool dengan hardcode, satu dengan kebutuhan versi, satu launcher.
4. `git -C restforge-handbook status --porcelain` sebelum commit: file baru `mcp/`
   + indeks yang diubah SAJA yang di-stage; file dirty pra-existing tidak tersentuh
   dan tidak di-stage.

## Kontrak Laporan

Commit dulu di branch campaign handbook (pesan menyebut `fix-mcp-gap-v1 phase-06`,
TANPA trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-06-handbook-spec-mcp.md`

Report 7 section standar, termasuk hasil audit dua arah. Paste isi report sebagai
response, tutup dengan baris path lengkap file report.

## Strict Per-Phase

Kerjakan HANYA bagian `mcp/` + tautan indeks. Koreksi drift `commands/`/`catalogs/`
adalah phase 07. Temuan baru dilaporkan, tidak dikerjakan.
