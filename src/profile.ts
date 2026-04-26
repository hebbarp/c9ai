import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './core/config.js';

export const PROFILE_PATH = path.join(CONFIG_DIR, 'profile.md');

/**
 * Load the user's `~/.c9ai/profile.md`. Returns the file body (or null if
 * absent / empty / unreadable). Caller decides where to inject it. We keep
 * the loader I/O on each call rather than caching, since profile is small
 * (a few KB) and the user may edit it mid-session and reasonably expect
 * the next turn to reflect the change.
 */
export async function loadProfile(): Promise<string | null> {
  try {
    const raw = await fs.readFile(PROFILE_PATH, 'utf8');
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Wrap a profile body in a clear delimiter so the model knows where the
 * user-supplied background ends and any task-specific instructions begin.
 */
export function formatProfileForSystem(profile: string): string {
  return (
    `# About the user\n\n` +
    `The following is information the user has placed in their c9ai profile (~/.c9ai/profile.md). ` +
    `Treat it as authoritative background about who you are talking to and what they care about. ` +
    `Use it to personalize your replies; don't repeat it back at them unless asked.\n\n` +
    `---\n\n` +
    profile
  );
}
