# Phase 02g — Sweep Resolusi Payload pada Tool Codegen Non-Dashboard

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02g. Sumber kebenaran:

- Report phase 02f (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02f-mcp-selaraskan-dashboard-tools.md`),
  khususnya section 5 butir 1-3 (pola passthrough + pre-flight kandidat CLI) dan
  section 7 butir 1 (temuan endpoint/processor/kafka)
- Resolusi payload sisi CLI: `packages/platform/generators/lib/validators/payload-validator.js`
  (`findPayloadFile`, `readPayloadFile`) dan pemanggilnya per verb

## Tujuan (Objective)

Menutup kelas bug issue-45 butir 2 di seluruh tool codegen yang mengirim `--payload`:
`create-endpoint.ts`, `create-processor.ts`, `create-kafka-consumer.ts` (dan tool lain
bila sweep menemukan pengirim `--payload` tambahan; `generate-payload.ts` memakai
`--table`, bukan payload file, jadi di luar scope).

Untuk TIAP tool:

1. **Audit dulu, wiring kemudian.** Baca bagaimana CLI verb terkait me-resolve argumen
   `--payload` (kutip baris), lalu bagaimana tool MCP membentuk nilai `--payload=` dan
   pre-flight-nya. Tentukan per tool apakah ada mismatch (strip ekstensi, tebakan path
   pre-flight yang berbeda dari kandidat CLI, deskripsi parameter yang menyesatkan).
2. Bila mismatch ada: terapkan pola phase 02f — nilai parameter diteruskan APA ADANYA,
   pre-flight meniru daftar kandidat CLI verb tersebut (jangan asumsikan sama dengan
   dashboard; audit per verb), petunjuk ekstensi di pesan pre-flight bila
   `<payload>.json` ada, deskripsi parameter diperbarui (tidak lagi "without the .json
   extension" bila itu bohong).
3. Bila TIDAK ada mismatch di sebuah tool: jangan diubah; laporkan bukti singkatnya.

PERHATIAN kompatibilitas: klien lama mungkin sudah terbiasa mengirim nama TANPA
ekstensi ke tool ini (sesuai deskripsi lama). Audit apakah CLI verb terkait menerima
bentuk tanpa ekstensi (mis. `findPayloadFile` menerima nama apa adanya bila file
memang bernama begitu, tetapi TIDAK menambah `.json`). Bila bentuk tanpa ekstensi
memang tidak pernah berfungsi (selalu `Payload file not found`), perubahan ini murni
perbaikan. Bila ada jalur yang membuatnya berfungsi, jelaskan di report bagaimana
kompatibilitas dijaga (mis. pre-flight hint, schema tetap menerima kedua bentuk).

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current`; dilarang pindah branch; JANGAN
menyentuh repo platform.

## Aturan Implementasi

- DO: helper `resolvePayloadPath` lokal per file (pola 02f), sesuaikan kandidatnya
  dengan hasil audit CLI per verb.
- DON'T: mengubah parameter/perilaku lain tool-tool ini (force, database, dsb. sudah
  final di phase sebelumnya).
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Harness argumen terhadap hasil build untuk tiap tool yang diubah: input
   `nama.json` → `--payload=nama.json` utuh; input path → utuh; jalur default lain
   tidak bergeser.
2. Uji CLI live di `smoke-test-home/` (platform 5.5.5 cukup untuk verb-verb ini) per
   tool yang diubah: jalankan bentuk argumen BARU dengan payload tidak ada → error
   "not found" yang menyebut nama utuh (bukti diterima parser dan resolusi berjalan);
   bila memungkinkan tanpa mutasi, tunjukkan juga bentuk LAMA (tanpa ekstensi) memang
   gagal `Payload file not found` pada file ber-ekstensi.
3. `git status --porcelain` sebelum commit: hanya file scope; `docs/` tidak di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-02g`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02g-sweep-payload-passthrough.md`

Report 7 section standar, dengan tabel audit per tool (tool | resolusi CLI | kondisi
lama MCP | mismatch? | tindakan). Paste isi report sebagai response, tutup dengan
baris path lengkap file report.

## Strict Per-Phase

Kerjakan HANYA sweep resolusi payload. Temuan baru dilaporkan, tidak dikerjakan.
