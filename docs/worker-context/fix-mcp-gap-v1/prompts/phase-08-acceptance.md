# Phase 08 — Acceptance Campaign fix-mcp-gap-v1

Kamu adalah worker phase 08 (acceptance). Phase ini VERIFIKASI: repo TIDAK boleh
diubah dan TIDAK ada commit di repo mana pun. Mutasi hanya diizinkan di playground
uji yang kamu buat sendiri. Satu-satunya file yang ditulis di repo adalah file report.

Sumber kebenaran: ketujuh issue (`packages/platform/docs/issues/issue-45-mcp-dashboard-*.md`
dan `issue-46` s.d. `issue-51`), `plan.md` campaign
(`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/plan.md`), dan seluruh report
phase 00-07b di folder reports.

## Tujuan (Objective)

Memutuskan per issue apakah "Kriteria Selesai"-nya terpenuhi oleh deliverable campaign,
dengan verdict CONFIRMED / PARTIAL / FAILED per kriteria, plus menjalankan uji lapangan
yang ditunda phase-phase sebelumnya.

## Branch (verifikasi saja, jangan pindah)

- `packages/mcp-server` → `campaign/fix-mcp-gap-v1` (HEAD diharapkan `b0c1f0f` atau
  lebih baru bila ada 89d7017; catat HEAD aktual)
- `packages/platform` → `campaign/fix-mcp-gap-v1` (`96bce81`)
- `restforge-skills` → `campaign/fix-mcp-gap-v1` (`77afc06`)
- `restforge-handbook` → `campaign/fix-mcp-gap-v1` (`911d164`)

## Bagian 1 — Verifikasi Statis

1. `npm run build` di `packages/mcp-server` → lolos.
2. Test suite platform: `npm test` di `packages/platform` → bandingkan dengan baseline
   report 02e (3795 pass, 0 fail).
3. Surface runtime: jalankan server MCP hasil build via stdio JSON-RPC
   (`node dist/index.js`, kirim `initialize` + `tools/list`) → 69 tool terdaftar
   secara LIVE, termasuk 4 tool baru. Ini menutup gap "hitungan statis vs runtime"
   dari report 06b.
4. Audit silang angka: 69 di `mcp/README.md` handbook, 69 di README package, 69 hasil
   `tools/list` → identik.

## Bagian 2 — Uji Lapangan (playground)

Buat playground segar `D:\restforge-playground\mcp-gap-acceptance\` (folder baru;
JANGAN memakai cascade-e2e atau playground campaign lain). Siapkan project backend di
dalamnya: boleh `npm install @restforgejs/platform` (install lokal; versi rilis 5.5.5)
atau menyalin pola dari `smoke-test-home/`. Gunakan `DB_TYPE=sqlite` pada
`config/db-connection.env` agar tidak butuh server database. JANGAN `npm publish`
atau install global.

Cara eksekusi tool MCP: PANGGIL LEWAT SERVER MCP NYATA — jalankan
`node packages/mcp-server/dist/index.js` (build branch campaign) sebagai subprocess
stdio dan kirim `tools/call` JSON-RPC dengan `cwd` menunjuk playground. Ini
verifikasi end-to-end yang belum pernah dilakukan campaign ini. Bila pendekatan
JSON-RPC macet, fallback ke eksekusi CLI bentuk argumen tool + catat deviasinya.

Uji yang wajib (tandai hasil per butir):

1. **Auto-deteksi DB_TYPE (phase 02c):** siapkan SDF minimal + `schema migrate`
   (sqlite), `payload generate`, lalu `codegen_create_endpoint` TANPA parameter
   `database` → module hasil generate harus sqlite (bukti: cabang sqlite di module
   atau output CLI), membuktikan auto-deteksi hidup lewat MCP.
2. **`force=false` endpoint (phase 02):** panggil `codegen_create_endpoint` kedua kali
   dengan `force=false` → respons "aborted/nothing generated" dalam ≤ beberapa detik
   (tanpa hang), file module tidak berubah (bandingkan hash).
3. **`createDemo=false` + `config` eksplisit (phase 02b):** satu run nyata → sukses,
   folder `examples/` tidak dibuat.
4. **Payload ber-ekstensi (phase 02g):** panggilan dengan `payload="<nama>.json"` →
   sukses (bukti resolusi).
5. **`codegen_validate_sql` jalur sukses (phase 01):** `tools/call` dengan SQL
   `SELECT 1` dan config sqlite → verdict ok dari EXPLAIN. Bila sqlite tidak
   mendukung jalur ini, coba playground existing dengan config DB hidup
   (READ-ONLY, jangan mutasi project itu); bila tidak ada, catat FAILED-ENV dan
   alasan.
6. **`project_sdk_generate` (phase 03):** setelah endpoint ada → generate SDK →
   folder sdk/ berisi client; run kedua tanpa `force` → error guard; dengan
   `force=true` → menimpa.
7. **`license_info` (phase 03):** via tools/call → output teks license diteruskan.
8. **`runtime_generate_consumer_launcher` mode pm2 (phase 04):** buat satu consumer
   via `codegen_create_kafka_consumer` (generate saja, tanpa Kafka), lalu tool mode
   pm2 → `deploy/ecosystem.config.js` + `consumer-manager.sh` tertulis; amati isi
   ecosystem (port, npx restforge-consumer per consumer). Mode host cukup verifikasi
   file skrip tertulis; JANGAN menjalankan consumer.
9. **`--validate-only` dashboard (phase 02e/02f):** platform rilis 5.5.5 di playground
   BELUM punya flag ini; uji dua sisi: (a) `codegen_validate_dashboard_payload` via
   tools/call terhadap playground → harus mengembalikan cabang "upgrade required"
   (bukti error handling 02f); (b) jalur sukses flag via
   `node packages/platform/generators/cli-entry.js` (working tree) seperti report 02e
   → validasi lolos tanpa file baru.
10. **`designer_auth_attach` (phase 03):** OPSIONAL. Bila mudah, `designer_init_project`
    ke playground frontend lalu `designer_auth_attach`; bila tidak, cukup
    `tools/call` sampai precondition/error bersih dan catat belum diuji penuh.

## Bagian 3 — Cek Silang Kriteria Selesai per Issue

Untuk TIAP issue (45, 46, 47, 48, 49, 50, 51): kutip kalimat "Kriteria Selesai",
petakan ke deliverable (commit + report phase), beri verdict per kriteria dengan
bukti. Sertakan juga catatan koreksi yang sudah diputuskan orchestrator (mis. butir
`dbschema_init --force` issue-47 terbantah; butir 2 issue-45 hanya pernah terjadi di
jalur dashboard).

## Aturan

- DILARANG mengubah file repo mana pun; temuan dicatat, tidak diperbaiki.
- Playground boleh dimutasi bebas; bersihkan artefak besar bila wajar, atau laporkan
  lokasinya.
- Uji yang butuh lingkungan yang tidak tersedia → verdict FAILED-ENV dengan alasan,
  bukan dipaksakan.

## Verifikasi Mandiri

`git status --porcelain` di keempat repo pasca-kerja → identik dengan kondisi awal
(catat kondisi awal lebih dulu; dirty pra-existing platform/handbook boleh ada).

## Kontrak Laporan

Phase read-only terhadap repo: TANPA commit. Tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-08-acceptance.md`

Report 7 section standar + tabel verdict per issue + tabel hasil uji lapangan 1-10.
Paste isi report sebagai response, tutup dengan baris path lengkap file report.
