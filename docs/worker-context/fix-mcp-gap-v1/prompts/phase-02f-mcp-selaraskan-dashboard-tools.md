# Phase 02f — MCP: Selaraskan Dua Tool Dashboard dengan CLI Baru (Penutup Issue-45 Sisi MCP)

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02f. Sumber kebenaran:

- `packages/platform/docs/issues/issue-45-mcp-dashboard-create-validate-tidak-kompatibel-cli-5-4-4.md`
  (butir 2 dan 3)
- Report phase 02e (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02e-platform-dashboard-validate-only.md`),
  khususnya section 6 butir 4 (temuan `findPayloadFile` tanpa auto-`.json`)
- Report phase 02d (harness menunjukkan tool mengirim `--payload=z` untuk input `z.json`)

Baca ketiganya sebelum mengubah apa pun.

## Tujuan (Objective)

Menutup sisa issue-45 di sisi mcp-server:

1. **Payload diteruskan apa adanya (butir 2 issue-45).** Selidiki di
   `src/tools/codegen/create-dashboard.ts` dan `validate-dashboard-payload.ts`
   bagaimana argumen payload dinormalisasi sebelum masuk `--payload=`; hilangkan
   transformasi yang menyebabkan `dashboard-mck.json` menjadi `dashboard-mck`.
   Path/nama file dari parameter dikirim ke CLI tanpa diubah. Periksa juga apakah
   tool codegen dashboard lain atau helper bersama ikut memakai normalisasi yang sama;
   bila helper dipakai tool non-dashboard, JANGAN ubah helper bersama, tangani lokal.
2. **Deskripsi versi platform pada `codegen_validate_dashboard_payload`.** CLI baru
   (`--validate-only`) baru ada di source platform SESUDAH rilis 5.5.5. Tulis jujur:
   butuh versi platform yang menyediakan `dashboard create --validate-only` (hadir di
   source setelah 5.5.5; versi rilis pastinya ditentukan saat user merilis). JANGAN
   mengarang angka versi. Perbarui pula bagian deskripsi/error handling yang masih
   menyiratkan tool ini tidak berfungsi, dan tambahkan penanganan yang membantu bila
   CLI lama menjawab `Unknown flag: --validate-only` (artinya platform ter-install
   belum memuat flag; sarankan upgrade).
3. **Parameter `force` pada `codegen_create_dashboard`** mengikuti pola phase 02
   (`force` default `true`; bila `false` jangan kirim `--force=true`). GATE: baca dulu
   `packages/platform/generators/cli/dashboard/create.js` untuk memastikan perilaku
   jalur non-force saat konflik, karena berbeda dari endpoint: report 02e run G
   menunjukkan konflik registry menghasilkan ERROR bersih exit 1 (bukan prompt
   readline). Periksa apakah konflik FILE juga error bersih atau memakai prompt; bila
   ada jalur prompt, terapkan `stdin: 'ignore'` + deteksi aborted seperti
   `create-endpoint.ts`; bila semuanya error bersih, cukup parameter force tanpa
   mekanisme stdin. Kutip bukti barisnya di report. Deskripsi tool diperbarui
   (default destruktif + cara non-overwrite), termasuk catatan bahwa `force=true`
   dapat mengganti tipe database project terdaftar (temuan 02d).
4. **Deskripsi `codegen_validate_payload` (butir 3 issue-45):** tambahkan satu-dua
   kalimat bahwa tool ini untuk payload CRUD per tabel; payload dashboard divalidasi
   lewat `codegen_validate_dashboard_payload`. Tanpa perubahan perilaku.

## Branch Campaign

`campaign/fix-mcp-gap-v1` di `packages/mcp-server`. Verifikasi
`git -C packages/mcp-server branch --show-current`; dilarang pindah branch; jangan
menyentuh repo platform (perubahan platform sudah selesai di phase 02e).

## Aturan Implementasi

- DO: ikuti idiom phase 02 (parameter opsional, default mempertahankan perilaku, flag
  kondisional, deskripsi jujur).
- DON'T: mengubah perilaku `--database` kedua tool (sudah final di 02d).
- DON'T: bump version, commit `docs/worker-context/`, `npm publish`.

## Test yang Wajib Dijalankan

1. `npm run build` — lolos tanpa error.
2. Nyatakan kembali tidak ada script test di package ini.

## Verifikasi Mandiri

1. Harness argumen terhadap hasil build (pola report 02b-02d) untuk kedua tool
   dashboard: input payload `dashboard-x.json` → argumen memuat
   `--payload=dashboard-x.json` utuh; jalur default `create_dashboard` (tanpa `force`)
   identik perilaku lama; `force=false` menghilangkan `--force=true`.
2. Uji CLI live terhadap PLATFORM WORKING TREE (bukan smoke-test-home, karena platform
   ter-install 5.5.5 belum punya flag baru): jalankan
   `node packages/platform/generators/cli-entry.js dashboard create ... --validate-only=true`
   dengan payload uji minimal di direktori temporer (pola report 02e), memakai bentuk
   argumen PERSIS seperti yang kini dibangun tool (termasuk `--payload=<nama>.json`).
   Buktikan exit 0 payload valid + nol file baru, dan exit 1 payload cacat.
3. Uji negatif versi lama di `smoke-test-home/` (platform 5.5.5 ter-install):
   jalankan bentuk argumen tool → `Unknown flag: --validate-only`; tunjukkan bahwa
   error handling baru tool menghasilkan saran upgrade yang benar (cukup lewat
   pembacaan kode jalur error + kecocokan string pesan CLI).
4. `git status --porcelain` sebelum commit: hanya file scope; `docs/` tidak di-stage.

## Kontrak Laporan

Commit dulu di branch campaign (pesan menyebut `fix-mcp-gap-v1 phase-02f`, TANPA
trailer co-author), lalu tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02f-mcp-selaraskan-dashboard-tools.md`

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA empat butir di atas. Temuan baru dilaporkan, tidak dikerjakan.
