/**
 * In-memory Login Rate Limiter
 * Provides bounded brute-force protection for single-tenant VPS deployment.
 * Tracks failed authentication attempts per IP and account.
 * Note: State resets if the Next.js process restarts.
 */

interface AttemptRecord {
  count: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
}

class LoginRateLimiter {
  private attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMinutes = 15) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMinutes * 60 * 1000;

    // Periodic cleanup every 10 minutes
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 10 * 60 * 1000).unref?.();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now - record.lastAttemptTime > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Checks if an IP or account is currently rate-limited.
   */
  isRateLimited(key: string): { isBlocked: boolean; retryAfterSeconds: number } {
    const record = this.attempts.get(key);
    if (!record) {
      return { isBlocked: false, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    if (now - record.firstAttemptTime > this.windowMs) {
      this.attempts.delete(key);
      return { isBlocked: false, retryAfterSeconds: 0 };
    }

    if (record.count >= this.maxAttempts) {
      const remainingMs = this.windowMs - (now - record.firstAttemptTime);
      return {
        isBlocked: true,
        retryAfterSeconds: Math.ceil(Math.max(0, remainingMs) / 1000)
      };
    }

    return { isBlocked: false, retryAfterSeconds: 0 };
  }

  /**
   * Records a failed authentication attempt.
   */
  recordFailedAttempt(key: string): { isBlocked: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now - record.firstAttemptTime > this.windowMs) {
      this.attempts.set(key, {
        count: 1,
        firstAttemptTime: now,
        lastAttemptTime: now
      });
      return { isBlocked: false, retryAfterSeconds: 0 };
    }

    record.count += 1;
    record.lastAttemptTime = now;

    if (record.count >= this.maxAttempts) {
      const remainingMs = this.windowMs - (now - record.firstAttemptTime);
      return {
        isBlocked: true,
        retryAfterSeconds: Math.ceil(Math.max(0, remainingMs) / 1000)
      };
    }

    return { isBlocked: false, retryAfterSeconds: 0 };
  }

  /**
   * Clears failure state after a successful authentication.
   */
  clear(key: string) {
    this.attempts.delete(key);
  }
}

export const loginRateLimiter = new LoginRateLimiter(5, 15);
