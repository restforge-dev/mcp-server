import { z } from 'zod';

// Nama dasar launcher bawaan. Tanpa parameter name, nama file tetap
// server-start/server-stop + ecosystem.config.js seperti versi sebelumnya.
export const DEFAULT_LAUNCHER_NAME = 'server';

export const launcherNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits, and hyphens (e.g. auth-service)')
  .max(64)
  .default(DEFAULT_LAUNCHER_NAME)
  .describe(
    'Base name of the launcher files: <name>-start and <name>-stop. Default "server". Use a different name for a second process in the same folder, e.g. "auth-service" for the auth-service on port 3100.'
  );

export interface LauncherFileNames {
  start: string;
  stop: string;
  ecosystem: string;
}

export function getLauncherFileNames(os: 'windows' | 'linux', name: string): LauncherFileNames {
  const ext = os === 'windows' ? 'bat' : 'sh';
  return {
    start: `${name}-start.${ext}`,
    stop: `${name}-stop.${ext}`,
    // ecosystem.config.js bawaan dipertahankan; launcher lain mendapat file sendiri
    // agar dua proses PM2 di folder yang sama tidak saling menimpa.
    ecosystem: name === DEFAULT_LAUNCHER_NAME ? 'ecosystem.config.js' : `${name}.ecosystem.config.js`,
  };
}
