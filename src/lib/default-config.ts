import { execProcess } from './exec.js';

/**
 * Label config untuk teks respons tool saat parameter config tidak diisi.
 * Tanpa --config, CLI memakai default dari .restforge/defaults.json.
 */
export const DEFAULT_CONFIG_LABEL = 'project default (config set-default)';

export function configLabel(config: string | undefined): string {
  return config ?? DEFAULT_CONFIG_LABEL;
}

/**
 * Argumen --config untuk CLI. Dikirim hanya bila config diisi, sehingga CLI
 * memakai default project bila config kosong.
 */
export function configArgs(config: string | undefined): string[] {
  return config ? [`--config=${config}`] : [];
}

export type DefaultConfigResolution =
  | { ok: true; config: string; path: string }
  | { ok: false; reason: string };

/**
 * Baca default config project lewat `restforge config get-default`, untuk tool
 * yang membaca atau menulis file config langsung tanpa memanggil CLI lain.
 */
export async function resolveDefaultConfig(projectCwd: string): Promise<DefaultConfigResolution> {
  const result = await execProcess('npx', ['restforge', 'config', 'get-default', '--pretty=false'], {
    cwd: projectCwd,
    timeout: 30_000,
  });

  const jsonLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('{'));

  if (!jsonLine) {
    return { ok: false, reason: `The default config could not be read (${result.command}, exit code ${result.exitCode}).` };
  }

  try {
    const data = JSON.parse(jsonLine) as { isSet?: boolean; config?: string; resolvedPath?: string };
    if (!data.isSet || !data.config || !data.resolvedPath) {
      return { ok: false, reason: 'No default config is recorded for this project.' };
    }
    return { ok: true, config: data.config, path: data.resolvedPath };
  } catch {
    return { ok: false, reason: `The default config output is not valid JSON (${result.command}).` };
  }
}
