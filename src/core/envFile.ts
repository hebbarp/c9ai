/**
 * Read/write a single key in ~/.c9ai/.env. Used by the matsya setup
 * command to persist API credentials without making the user hand-edit a
 * dotfile. Preserves other lines and comments verbatim.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const USER_ENV_PATH = path.join(os.homedir(), '.c9ai', '.env');

function escape(value: string): string {
  // dotenv interprets unquoted values as-is (no escapes). Quote any value
  // containing whitespace or shell metacharacters so the file round-trips.
  if (/^[A-Za-z0-9_./:@\-]+$/.test(value)) return value;
  // Use double quotes; backslash-escape embedded " and \.
  const inner = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${inner}"`;
}

export async function setUserEnvVar(key: string, value: string): Promise<void> {
  await fs.mkdir(path.dirname(USER_ENV_PATH), { recursive: true });
  let body = '';
  try {
    body = await fs.readFile(USER_ENV_PATH, 'utf8');
  } catch {
    // First write — file doesn't exist yet.
  }
  const lines = body.split(/\r?\n/);
  const re = new RegExp(`^\\s*${key}\\s*=`);
  let replaced = false;
  const next = lines.map(line => {
    if (re.test(line)) {
      replaced = true;
      return `${key}=${escape(value)}`;
    }
    return line;
  });
  if (!replaced) {
    // Drop trailing empty line(s) before appending so we don't accumulate blanks.
    while (next.length && next[next.length - 1] === '') next.pop();
    next.push(`${key}=${escape(value)}`);
  }
  // Trailing newline.
  await fs.writeFile(USER_ENV_PATH, next.join('\n') + '\n', 'utf8');
  // Update process.env so the change takes effect immediately, no restart needed.
  process.env[key] = value;
}
