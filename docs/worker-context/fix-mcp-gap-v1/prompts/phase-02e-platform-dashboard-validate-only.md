# Phase 02e — Platform: Flag `--validate-only` pada `dashboard create`

Campaign: `fix-mcp-gap-v1`. Kamu adalah worker phase 02e. Ini phase SISI PLATFORM
(perluasan scope Q13=A, menutup issue-45). Sumber kebenaran:

- `packages/platform/docs/issues/issue-45-mcp-dashboard-create-validate-tidak-kompatibel-cli-5-4-4.md`
- Report phase 00 section 3.4 dan report phase 02d section 4.1-4.2
  (`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/`)

Baca ketiganya sebelum mengubah apa pun.

## Tujuan (Objective)

CLI `npx restforge dashboard create --validate-only` berfungsi: menjalankan seluruh
pipeline validasi dashboard (payload processing + DashboardValidator + SQL validation
sesuai flag) lalu BERHENTI tanpa menulis file apa pun dan tanpa menyentuh registry.
Exit 0 bila valid, exit non-nol bila tidak. Ini mengembalikan kontrak yang diandalkan
tool MCP `codegen_validate_dashboard_payload` (yang mengirim `--validate-only=true`).

## Branch Campaign

`campaign/fix-mcp-gap-v1` di repo `packages/platform` (sudah dibuat orchestrator dari
`main`). Verifikasi `git -C packages/platform branch --show-current` sebelum mengubah
apa pun; dilarang pindah branch. File `docs/issues/issue-4*.md` untracked di working
tree adalah artefak campaign, JANGAN di-stage. JANGAN menyentuh repo lain di phase ini.

## Spesifikasi Perubahan

Semua di `packages/platform/generators/`:

1. `cli/dashboard/create.js` — tambahkan flag `validate-only` ke contract:
   `type: 'boolean'`, `required: false`, `default: false`, deskripsi jelas (validasi
   penuh tanpa menulis file). Ikuti gaya deklarasi flag existing.
2. Handler `dashboard create` — bila `validate-only` aktif: jalankan jalur validasi
   yang sama persis dengan jalur generate (pemrosesan payload, DashboardValidator,
   validasi SQL kecuali `--skip-sql-validation`) sampai titik TEPAT SEBELUM penulisan
   file/registry, lalu berhenti dengan output ringkas yang menyatakan hasil validasi.
   Pelajari struktur handler dulu; jangan menduplikasi logika validasi, gunakan titik
   percabangan sesedikit mungkin.
3. Interaksi dengan `--force`: pada mode validate-only, `--force` tidak relevan dan
   tidak boleh disyaratkan; pemeriksaan konflik file/registry BOLEH dilewati atau
   dilaporkan sebagai informasi, tetapi tidak boleh menulis/mengubah apa pun.
4. Komentar kepala file `create.js:10-12` yang menyatakan flag legacy `--validate-only`
   tidak di-expose perlu diperbarui karena tidak lagi benar.
5. Perbarui halaman help/contract description seperlunya. JANGAN menyentuh handbook
   (itu phase lain yang digate konfirmasi user).

Batas scope keras: HANYA verb `dashboard create`. Jangan menambahkan auto-deteksi
database, jangan mengubah validasi tipe database, jangan menyentuh verb lain. Kedua
temuan itu ditangani di luar phase ini.

## Aturan Implementasi

- DO: cari test suite platform (`generators/tests/` terlihat ada; temukan runner-nya
  di `package.json`) dan tambahkan minimal satu unit test untuk mode validate-only
  bila pola test untuk CLI dashboard sudah ada; bila belum ada pola yang bisa diikuti,
  laporkan dan andalkan verifikasi CLI live.
- DO: pertahankan bahasa output user-facing Inggris (kebijakan repo), komentar kode
  boleh Indonesia mengikuti gaya file.
- DON'T: bump version `package.json`, menyentuh changelog/artefak rilis.
- DON'T: commit file `docs/` (issue files maupun worker-context).
- DON'T: mengubah perilaku jalur generate normal sedikit pun; jalur tanpa
  `--validate-only` harus byte-identical secara perilaku.

## Test yang Wajib Dijalankan

1. Test suite platform yang relevan (laporkan command persis + total/pass/fail +
   delta dari baseline SEBELUM perubahan; jalankan baseline dulu).
2. Verifikasi CLI live. PERHATIAN anti-tamper: memory project menyatakan CLI bisa
   menolak berjalan dari working tree source. Coba dulu dari `packages/platform`
   (mis. `node server.js dashboard create --help` atau mekanisme yang dipakai test
   suite); bila terblokir anti-tamper, laporkan buktinya dan lakukan verifikasi
   fungsional lewat unit test terhadap handler/contract. JANGAN mem-publish atau
   meng-install ulang package ke playground (build-and-bump adalah wewenang user).

## Verifikasi Mandiri

1. Contract: `--help` (atau dump contract) menampilkan `--validate-only`.
2. Mode validate-only pada payload valid → exit 0, tidak ada file baru di project uji
   (buktikan dengan pemeriksaan filesystem sebelum/sesudah).
3. Mode validate-only pada payload cacat (mis. placeholder tak dideklarasi, kasus
   report 02d) → exit non-nol dengan pesan validasi yang sama seperti jalur generate.
4. Jalur generate normal tanpa flag → tidak berubah (tunjukkan lewat test atau diff
   perilaku).
5. `git -C packages/platform status --porcelain` sebelum commit: hanya file
   generators yang diubah + test; `docs/` tidak di-stage.

## Kontrak Laporan

Selesaikan kode dan test, **commit dulu** di branch campaign platform (pesan menyebut
`fix-mcp-gap-v1 phase-02e`, TANPA trailer co-author), baru tulis report ke:
`packages/mcp-server/docs/worker-context/fix-mcp-gap-v1/reports/phase-02e-platform-dashboard-validate-only.md`

(report tetap di worker-context mcp-server, lokasi worker-context utama campaign).

Report 7 section standar. Paste isi report sebagai response, tutup dengan baris path
lengkap file report.

## Strict Per-Phase

Kerjakan HANYA spesifikasi di atas. Penyelarasan sisi mcp-server adalah phase 02f.
