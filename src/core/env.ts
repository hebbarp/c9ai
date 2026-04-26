import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

function loadEnvFile(p: string): void {
  if (!existsSync(p)) return;
  dotenvConfig({ path: p, override: false, quiet: true });
}

function findEnvWalkingUp(start: string): string[] {
  const found: string[] = [];
  let dir = start;
  let prev = '';
  while (dir && dir !== prev) {
    const p = path.join(dir, '.env');
    if (existsSync(p)) found.push(p);
    prev = dir;
    dir = path.dirname(dir);
  }
  return found;
}

// Precedence: shell exports > nearest .env (cwd, then each parent) > ~/.c9ai/.env.
// override:false means the first writer wins, so loading most-specific first
// gives that file priority, and shell env (already in process.env) beats all files.
export function loadEnv(): void {
  for (const p of findEnvWalkingUp(process.cwd())) loadEnvFile(p);
  loadEnvFile(path.join(homedir(), '.c9ai', '.env'));
}

loadEnv();
