/**
 * Commercial Attendance Bridge - Worker Configuration & Validation
 * 
 * Manages loading, parsing, and validating environment variables required
 * by the on-premise Raspberry Pi sync worker. Fails closed with descriptive
 * fatal error formatting if any required configuration is missing or malformed.
 */

export interface WorkerConfig {
  apiBaseUrl: string;
  deviceId: string;
  deviceToken: string;
  zktecoIp: string;
  zktecoPort: number;
  zktecoTimeout: number;
  syncIntervalCron: string;
  syncChunkSize: number;
  syncMaxRetries: number;
  syncRetryDelayMs: number;
}

export interface WorkerConfigValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
  config?: WorkerConfig;
}

/**
 * Validates a dictionary of environment variables against the worker configuration schema.
 */
export function validateWorkerConfig(
  env: Record<string, string | undefined> = process.env
): WorkerConfigValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  const apiBaseUrl = (env.API_BASE_URL || "").trim();
  const deviceId = (env.DEVICE_ID || "").trim();
  const deviceToken = (env.DEVICE_TOKEN || "").trim();
  const zktecoIp = (env.ZKTECO_IP || "").trim();

  if (!apiBaseUrl) {
    missing.push("API_BASE_URL");
  } else if (!/^https?:\/\/.+/i.test(apiBaseUrl)) {
    errors.push("API_BASE_URL must be a valid HTTP/HTTPS URL (e.g. 'https://pointage.client.ma').");
  }

  if (!deviceId) {
    missing.push("DEVICE_ID");
  }

  if (!deviceToken) {
    missing.push("DEVICE_TOKEN");
  }

  if (!zktecoIp) {
    missing.push("ZKTECO_IP");
  }

  const zktecoPort = parseInt(env.ZKTECO_PORT || "4370", 10);
  if (isNaN(zktecoPort) || zktecoPort <= 0 || zktecoPort > 65535) {
    errors.push(`ZKTECO_PORT must be a valid port number between 1 and 65535 (received '${env.ZKTECO_PORT}').`);
  }

  const zktecoTimeout = parseInt(env.ZKTECO_TIMEOUT || "10000", 10);
  if (isNaN(zktecoTimeout) || zktecoTimeout < 1000) {
    errors.push(`ZKTECO_TIMEOUT must be at least 1000ms (received '${env.ZKTECO_TIMEOUT}').`);
  }

  const syncIntervalCron = (env.SYNC_INTERVAL_CRON || "*/15 * * * *").trim();
  const syncChunkSize = parseInt(env.SYNC_CHUNK_SIZE || "500", 10);
  const syncMaxRetries = parseInt(env.SYNC_MAX_RETRIES || "3", 10);
  const syncRetryDelayMs = parseInt(env.SYNC_RETRY_DELAY_MS || "1000", 10);

  if (missing.length > 0 || errors.length > 0) {
    return {
      valid: false,
      missing,
      errors
    };
  }

  return {
    valid: true,
    missing: [],
    errors: [],
    config: {
      apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
      deviceId,
      deviceToken,
      zktecoIp,
      zktecoPort,
      zktecoTimeout,
      syncIntervalCron,
      syncChunkSize: isNaN(syncChunkSize) || syncChunkSize <= 0 ? 500 : syncChunkSize,
      syncMaxRetries: isNaN(syncMaxRetries) || syncMaxRetries < 1 ? 3 : syncMaxRetries,
      syncRetryDelayMs: isNaN(syncRetryDelayMs) || syncRetryDelayMs < 100 ? 1000 : syncRetryDelayMs
    }
  };
}

/**
 * Asserts that the worker configuration is complete and valid.
 * Fails closed and terminates process if validation fails.
 */
export function assertWorkerConfig(
  env: Record<string, string | undefined> = process.env
): WorkerConfig {
  const result = validateWorkerConfig(env);

  if (!result.valid || !result.config) {
    const errorLines: string[] = [];

    if (result.missing.length > 0) {
      errorLines.push(" Missing Required Variables:");
      for (const m of result.missing) {
        errorLines.push(`   - ${m}`);
      }
    }

    if (result.errors.length > 0) {
      errorLines.push(" Configuration Errors:");
      for (const e of result.errors) {
        errorLines.push(`   - ${e}`);
      }
    }

    const message = [
      "============================================================",
      " FATAL CONFIGURATION ERROR — INCOMPLETE ENVIRONMENT",
      "============================================================",
      " The commercial sync worker cannot start because required",
      " configuration is missing from the environment / .env file.",
      "",
      ...errorLines,
      "",
      " REMEDIATION:",
      " 1. Ensure .env exists in the worker directory:",
      "    cp .env.worker.example .env",
      " 2. Configure the required parameters (API_BASE_URL, DEVICE_ID, DEVICE_TOKEN, ZKTECO_IP).",
      " 3. Ensure file permissions are secured: chmod 600 .env",
      " 4. Restart the sync worker via PM2: pm2 restart zkteco-sync-worker",
      "============================================================"
    ].join("\n");

    console.error(message);
    throw new Error(`Worker configuration validation failed: ${[...result.missing.map(m => `Missing ${m}`), ...result.errors].join(", ")}`);
  }

  return result.config;
}

/**
 * Returns the current validated worker configuration.
 */
export function getWorkerConfig(): WorkerConfig {
  return assertWorkerConfig(process.env);
}
