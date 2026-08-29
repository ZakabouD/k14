/**
 * Runtime Timezone Pre-Flight Guard
 * 
 * zkteco-js constructs attendance Date objects from K14 hardware wall-clock integer fields
 * using Node.js process local timezone. A mismatched timezone causes silent timestamp shifts.
 * This module enforces strict IANA timezone validation at application startup before any
 * hardware communication or API ingestion takes place.
 *
 * The commercial K14 hardware attendance solution is deployed for the Moroccan market,
 * requiring strict adherence to the official IANA 'Africa/Casablanca' timezone identifier.
 */

export const REQUIRED_WORKER_TIMEZONE = "Africa/Casablanca";

export interface TimezoneValidationResult {
  valid: boolean;
  actual: string;
  expected: string;
  error?: string;
}

/**
 * Validates the current Node.js runtime timezone against the expected IANA timezone identifier.
 */
export function validateRuntimeTimezone(
  expectedTimezone: string = REQUIRED_WORKER_TIMEZONE
): TimezoneValidationResult {
  const actualTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const expected = expectedTimezone.trim();

  // Direct IANA name equality check (e.g. "Africa/Casablanca" === "Africa/Casablanca")
  if (actualTimezone === expected) {
    return {
      valid: true,
      actual: actualTimezone,
      expected
    };
  }

  return {
    valid: false,
    actual: actualTimezone,
    expected,
    error: `Runtime timezone mismatch: Expected '${expected}', but Node.js is running in '${actualTimezone}'.`
  };
}

/**
 * Asserts that the runtime timezone matches the required deployment timezone.
 * Throws a fatal error and terminates execution if validation fails.
 */
export function assertRuntimeTimezone(
  expectedTimezone: string = REQUIRED_WORKER_TIMEZONE
): void {
  const result = validateRuntimeTimezone(expectedTimezone);

  if (!result.valid) {
    const message = [
      "============================================================",
      " FATAL TIMEZONE CONFIGURATION ERROR",
      "============================================================",
      ` Expected Timezone:        ${result.expected}`,
      ` Actual Runtime Timezone:  ${result.actual}`,
      "",
      " CRITICAL EXPLANATION:",
      " zkteco-js parses ZKTeco K14 hardware wall-clock timestamps",
      " using the worker process's local timezone.",
      " Running in an unaligned timezone will corrupt attendance timestamps",
      " and introduce silent 1-hour calculation errors.",
      "",
      " REMEDIATION:",
      ` 1. On Raspberry Pi / Linux host, configure official timezone:`,
      `    sudo timedatectl set-timezone ${result.expected}`,
      " 2. Verify clock synchronization:",
      "    timedatectl",
      " 3. Restart the commercial sync worker via PM2.",
      "============================================================"
    ].join("\n");

    console.error(message);
    throw new Error(result.error);
  }
}
