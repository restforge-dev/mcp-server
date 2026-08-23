# Phase 07b — Koreksi Satu Baris: Layout Output di `data/push.md`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 07b (mikro-phase temuan phase 07
section 6 butir 2). Sumber kebenaran: report phase 07 section 3.4 dan bukti source
`packages/platform/generators/lib/data/data-scope.js:80-85` (layout bersarang per
schema untuk tabel ber-schema, rata untuk tabel tanpa schema).

## Tujuan

Blurb pembuka `restforge-handbook/commands/restforge-backend/data/push.md` (sekitar
baris 3) tidak lagi menyebut bentuk rata `data-storage/<table>.json` saja; sebut kedua
bentuk layout, konsisten kata per kata dengan rumusan yang dipakai `data/pull.md`
hasil phase 07.

## Branch

`campaign/fix-mcp-gap-v1` di `restforge-handbook`. Verifikasi branch; JANGAN sentuh
lima entri dirty pra-existing (`api-spec/README.md`, `catalogs/rdf/README.md`,
`api-spec/endpoint-upload.md`, `catalogs/rdf/upload-config.md`, `features/file-storage/`).

## Aturan

Hanya file `data/push.md`, hanya blurb tersebut (periksa juga apakah ada kemunculan
bentuk rata lain di file yang sama yang menjadi salah; koreksi bila sekelas, laporkan).
Bahasa konvensi handbook. Tanpa bump/publish.

## Verifikasi Mandiri

1. Diff hanya menyentuh `data/push.md`.
2. Rumusan identik dengan `data/pull.md`.
3. `git status --porcelain` pasca-commit: hanya lima entri dirty pra-existing tersisa.

## Kontrak Laporan

Commit di branch campaign handbook (pesan menyebut `fix-mcp-gap-v1 phase-07b`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-07b-push-md-layout.md`

Report 7 section standar (boleh ringkas mengingat scope satu file). Paste isi report,
tutup dengan path lengkap file report.
