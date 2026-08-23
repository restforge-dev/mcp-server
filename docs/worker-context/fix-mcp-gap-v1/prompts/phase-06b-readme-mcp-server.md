# Phase 06b — README Package `@restforgejs/mcp-server`: Sinkronkan dengan Surface Aktual

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 06b (phase kecil hasil temuan
phase 06). Sumber kebenaran: surface tool aktual `packages/mcp-server/src/` (69 tool)
dan `restforge-handbook/mcp/` hasil phase 06 (branch campaign handbook) sebagai acuan
angka dan pengelompokan.

## Tujuan (Objective)

`packages/mcp-server/README.md` tidak lagi menyesatkan: jumlah dan daftar tool
mencerminkan 69 tool aktual, dan jalur instalasi tidak lagi menempatkan
`npm install -g` sebagai jalur utama (kebijakan repo: install lokal; jalur yang
disarankan `npx create-restforge-skills` atau entri manual
`npx -y @restforgejs/mcp-server`).

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current`; dilarang pindah branch; repo lain
hanya dibaca.

## Spesifikasi Perubahan

Hanya `packages/mcp-server/README.md`:

1. Perbarui jumlah tool (69) dan daftar/pengelompokan per domain (9 domain). Bila
   README lama mendaftar tool satu per satu, pertimbangkan meringkas menjadi tabel
   domain + jumlah + contoh, dengan rujukan ke `restforge-handbook/mcp/` sebagai spec
   lengkap; jangan menduplikasi 69 baris yang akan basi lagi.
2. Ganti instruksi instalasi global dengan jalur lokal (npx). Bila binary global
   `restforge-mcp` disebut, posisikan sebagai alternatif konfigurasi, bukan jalur
   utama.
3. Periksa klaim lain di README yang bertentangan dengan keadaan sekarang (mis.
   daftar prasyarat, contoh konfigurasi client) dan koreksi seperlunya; laporkan tiap
   koreksi.
4. Bahasa mengikuti bahasa README existing (jangan ganti bahasa dokumen).

## Aturan Implementasi

- DON'T: menyentuh file lain, bump version, `npm publish`, commit `docs/worker-context/`.

## Test yang Wajib Dijalankan

1. `npm run build` tidak diperlukan (dokumen saja); nyatakan itu.

## Verifikasi Mandiri

1. Grep `npm install -g @restforgejs/mcp-server` di README → nol hasil (atau hanya
   dalam konteks alternatif yang eksplisit ditandai bukan jalur utama; jelaskan).
2. Angka tool di README cocok dengan hitungan `registerTool` di `src/` (tunjukkan
   keduanya).
3. `git status --porcelain` sebelum commit: hanya `README.md`; `docs/` tidak di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-06b`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-06b-readme-mcp-server.md`

Report 7 section standar (section Hasil Test cukup menyatakan tidak ada test yang
relevan). Paste isi report sebagai response, tutup dengan baris path lengkap file
report.

## Strict Per-Phase

Kerjakan HANYA README package mcp-server. Temuan baru dilaporkan, tidak dikerjakan.
