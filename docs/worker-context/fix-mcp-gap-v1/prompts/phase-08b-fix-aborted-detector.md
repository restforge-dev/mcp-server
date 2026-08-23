# Phase 08b — Fix Detektor `abortedOnPrompt` pada `codegen_create_endpoint`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 08b. Sumber kebenaran: report
phase 08 (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-08-acceptance.md`),
section 3.2 uji 2 dan section 7 butir 1.

## Tujuan

Jalur `force=false` `codegen_create_endpoint` melaporkan hasil dengan benar: saat CLI
berhenti di prompt konflik (EOF via stdin ignore), tool menjawab "aborted, nothing
generated", BUKAN "created successfully / no conflicting module was present".

## Latar Bukti (dari phase 08)

Pada platform 5.5.5, stdout yang tertangkap dari jalur konflik HANYA berisi
`"\nDo you want to proceed and overwrite existing files? (y/N): "`. String
`CONFLICTS DETECTED` tidak pernah sampai ke pipe. Detektor saat ini
(`create-endpoint.ts` sekitar baris 296-301) mensyaratkan KEDUA string, sehingga
tidak pernah menyala.

## Spesifikasi

Hanya `packages/mcp-server/src/tools/codegen/create-endpoint.ts`:

1. Longgarkan deteksi menjadi berbasis string prompt yang terbukti selalu sampai
   (kandidat: `'(y/N)'` atau frasa `'overwrite existing files'`; pilih yang paling
   spesifik-aman dan jelaskan). `CONFLICTS DETECTED` boleh tetap diperiksa sebagai
   sinyal tambahan (OR), jangan lagi jadi syarat AND.
2. Pastikan teks respons cabang aborted akurat (module memang ada, tidak ada yang
   ditulis, dua pilihan lanjutan force=true atau biarkan).
3. Periksa apakah teks fakta "no conflicting module was present" di cabang sukses
   non-force masih bisa muncul menyesatkan; koreksi seperlunya.

## Branch

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi branch; dilarang
pindah; repo lain hanya dibaca.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri (lapangan, wajib)

Playground phase 08 masih ada di `D:\restforge-playground\mcp-gap-acceptance\`
dengan module `product` existing. Ulangi uji 2 phase 08 lewat server MCP nyata
(pola harness stdio `tools/call` report 08): panggil `codegen_create_endpoint`
`force=false` pada endpoint `product` →

1. Respons kini menyatakan aborted/nothing generated (kutip teksnya).
2. Hash ketiga file module identik sebelum/sesudah.
3. Jalur sukses normal tidak rusak: satu panggilan `force=false` pada endpoint BARU
   (payload sama, name baru, mis. `productok`) → benar-benar generate dan dilaporkan
   sukses (bukti file baru ada). Ini penting: deteksi berbasis `(y/N)` tidak boleh
   false positive pada run tanpa konflik.
4. `git status --porcelain` sebelum commit: hanya `create-endpoint.ts`.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-08b`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-08b-fix-aborted-detector.md`

Report 7 section standar. Paste isi report, tutup dengan path lengkap file report.

## Strict Per-Phase

Hanya detektor dan teks respons tool ini. Sisi platform (console.log conflict-checker)
adalah issue terpisah. Temuan baru dilaporkan, tidak dikerjakan.
