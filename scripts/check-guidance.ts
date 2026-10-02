/**
 * check-guidance.ts
 *
 * Guard ukuran panduan agent (issue skills/MCP #002). Claude Code memotong
 * instruksi server MCP dan deskripsi tool di sekitar 2.050 karakter, sehingga
 * bagian yang menentukan pemilihan tool harus berada di awal.
 *
 * Aturan:
 *   1. SERVER_INSTRUCTIONS paling banyak 2.000 karakter.
 *   2. Setiap deskripsi tool memuat blok USE WHEN (atau USE ONLY WHEN) dan
 *      DO NOT USE yang selesai sebelum karakter ke-1.900.
 *   3. Tool destruktif memuat penanda DESTRUCTIVE sebelum karakter ke-1.900.
 *   4. Tidak ada blok PRESENTATION GUIDANCE (aturan presentasi ada di skill).
 *
 * Jalankan: npm run check:guidance. Dipanggil build-pack.mjs sebelum build rilis.
 * Opsi --report mencetak ukuran per tool tanpa mengubah exit code.
 */
import { SERVER_INSTRUCTIONS, registerAllTools } from '../src/server.js';

const INSTRUCTIONS_LIMIT = 2000;
const ROUTING_LIMIT = 1900;

// Tool yang mengubah atau menghapus data, file, atau project di luar kendali
// undo. Deskripsinya wajib memuat peringatan DESTRUCTIVE di awal.
const DESTRUCTIVE_TOOLS = new Set([
  'codegen_dbschema_migrate',
  'codegen_dbschema_apply',
  'project_delete',
  'project_sdk_generate',
  'designer_auth_remove',
  'key_revoke',
  'data_push',
  'codegen_create_endpoint',
  'codegen_create_dashboard',
  'designer_generate',
  'codegen_migrate_payload',
]);

type Collected = { name: string; description: string };

const tools: Collected[] = [];
const fakeServer = {
  registerTool(name: string, config: { description?: string }) {
    tools.push({ name, description: config.description ?? '' });
    return {};
  },
};
registerAllTools(fakeServer as never);

// Akhir sebuah blok berheading: posisi baris kosong pertama setelah heading,
// atau akhir teks bila blok itu yang terakhir.
function blockEnd(text: string, headingIndex: number): number {
  const next = text.indexOf('\n\n', headingIndex);
  return next === -1 ? text.length : next;
}

function findHeading(text: string, pattern: RegExp): number {
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

const report = process.argv.includes('--report');
const errors: string[] = [];

if (SERVER_INSTRUCTIONS.length > INSTRUCTIONS_LIMIT) {
  errors.push(`SERVER_INSTRUCTIONS ${SERVER_INSTRUCTIONS.length} karakter, batas ${INSTRUCTIONS_LIMIT}.`);
}

for (const { name, description } of tools) {
  const useIdx = findHeading(description, /^USE (ONLY )?WHEN\b/m);
  const dontIdx = findHeading(description, /^DO NOT USE\b/m);
  const useEnd = useIdx === -1 ? -1 : blockEnd(description, useIdx);
  const dontEnd = dontIdx === -1 ? -1 : blockEnd(description, dontIdx);

  if (useIdx === -1) errors.push(`${name}: blok USE WHEN tidak ada.`);
  else if (useEnd > ROUTING_LIMIT) errors.push(`${name}: blok USE WHEN selesai di karakter ${useEnd}, batas ${ROUTING_LIMIT}.`);
  if (dontIdx === -1) errors.push(`${name}: blok DO NOT USE tidak ada.`);
  else if (dontEnd > ROUTING_LIMIT) errors.push(`${name}: blok DO NOT USE selesai di karakter ${dontEnd}, batas ${ROUTING_LIMIT}.`);

  if (DESTRUCTIVE_TOOLS.has(name)) {
    const warnIdx = description.indexOf('DESTRUCTIVE');
    if (warnIdx === -1 || warnIdx > ROUTING_LIMIT) errors.push(`${name}: penanda DESTRUCTIVE tidak ada sebelum karakter ${ROUTING_LIMIT}.`);
  }
  if (/PRESENTATION GUIDANCE/.test(description)) errors.push(`${name}: masih memuat PRESENTATION GUIDANCE.`);

  if (report) {
    console.log(`${name.padEnd(42)} len=${String(description.length).padStart(5)} use=${String(useEnd).padStart(5)} dont=${String(dontEnd).padStart(5)}`);
  }
}

const total = tools.reduce((sum, t) => sum + t.description.length, 0);
console.log(`[check-guidance] ${tools.length} tool, total deskripsi ${total} karakter, instruksi server ${SERVER_INSTRUCTIONS.length} karakter.`);

if (errors.length > 0) {
  for (const e of errors) console.error(`[check-guidance] ${e}`);
  console.error(`[check-guidance] ${errors.length} pelanggaran.`);
  if (!report) process.exit(1);
} else {
  console.log('[check-guidance] lolos.');
}
