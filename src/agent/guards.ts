export type GuardTripReason = 'max-iter' | 'wall-clock' | 'stalled';

export interface GuardOptions {
  maxIterations?: number;
  maxWallClockMs?: number;
  stallRepeats?: number;
}

export interface GuardSnapshot {
  iteration: number;
  elapsedMs: number;
  tripped: GuardTripReason | null;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULTS = {
  maxIterations: envInt('C9AI_MAX_ITER', 25),
  maxWallClockMs: envInt('C9AI_MAX_WALL_SEC', 600) * 1000,
  stallRepeats: envInt('C9AI_STALL_REPEATS', 3),
};

/**
 * Tracks iteration count, wall-clock time, and same-action repeats.
 * Call `tick(actionKey)` once per agent step; it returns the trip reason
 * once any limit is exceeded, or null while we're still good.
 *
 * `actionKey` is a stable string for the action being attempted —
 * typically `${toolName}:${JSON.stringify(args)}`. Pass empty string
 * for steps that aren't tool calls; stall detection only fires on
 * repeated *non-empty* keys.
 */
export class Guards {
  private iter = 0;
  private start = Date.now();
  private lastKey = '';
  private lastKeyCount = 0;
  private opts: Required<GuardOptions>;

  constructor(opts: GuardOptions = {}) {
    this.opts = {
      maxIterations: opts.maxIterations ?? DEFAULTS.maxIterations,
      maxWallClockMs: opts.maxWallClockMs ?? DEFAULTS.maxWallClockMs,
      stallRepeats: opts.stallRepeats ?? DEFAULTS.stallRepeats,
    };
  }

  tick(actionKey: string): GuardSnapshot {
    this.iter += 1;
    const elapsed = Date.now() - this.start;

    if (this.iter > this.opts.maxIterations) {
      return { iteration: this.iter, elapsedMs: elapsed, tripped: 'max-iter' };
    }
    if (elapsed > this.opts.maxWallClockMs) {
      return { iteration: this.iter, elapsedMs: elapsed, tripped: 'wall-clock' };
    }

    if (actionKey) {
      if (actionKey === this.lastKey) {
        this.lastKeyCount += 1;
      } else {
        this.lastKey = actionKey;
        this.lastKeyCount = 1;
      }
      if (this.lastKeyCount >= this.opts.stallRepeats) {
        return { iteration: this.iter, elapsedMs: elapsed, tripped: 'stalled' };
      }
    }

    return { iteration: this.iter, elapsedMs: elapsed, tripped: null };
  }

  snapshot(): GuardSnapshot {
    return {
      iteration: this.iter,
      elapsedMs: Date.now() - this.start,
      tripped: null,
    };
  }
}
