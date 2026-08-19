import { ZKTecoRecord, ZKTecoUser } from "../types/zkteco.types";

export interface SyncResponse {
  success: boolean;
  received: number;
  inserted: number;
  duplicates: number;
  failed: number;
  error?: string;
}

export interface CommandsResponse {
  syncRequested: boolean;
  syncStatus?: string;
}

export class DeviceApiClient {
  private baseUrl: string;
  private deviceId: string;
  private deviceToken: string;
  private chunkSize: number;
  private maxRetries: number;
  private baseRetryDelayMs: number;

  constructor() {
    this.baseUrl = (process.env.API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    this.deviceId = process.env.DEVICE_ID || "FACTORY-01";
    this.deviceToken = process.env.DEVICE_TOKEN || "";
    this.chunkSize = parseInt(process.env.SYNC_CHUNK_SIZE || "500", 10) || 500;
    this.maxRetries = parseInt(process.env.SYNC_MAX_RETRIES || "3", 10) || 3;
    this.baseRetryDelayMs = parseInt(process.env.SYNC_RETRY_DELAY_MS || "1000", 10) || 1000;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-device-id": this.deviceId,
      "x-device-token": this.deviceToken
    };
  }

  private isTransientStatus(status: number): boolean {
    return status >= 500 || status === 429;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async postWithRetry(
    url: string,
    payload: any,
    batchLabel: string,
    maxRetries = this.maxRetries
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.fetchWithTimeout(url, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          return await res.json();
        }

        const errorText = await res.text();

        // Non-transient client errors (400, 401, 403, 404, 413) should not be retried
        if (!this.isTransientStatus(res.status)) {
          throw new Error(`${batchLabel} rejected with non-retryable status ${res.status}: ${errorText}`);
        }

        // Transient status (500, 502, 503, 504, 429)
        if (attempt === maxRetries) {
          throw new Error(`${batchLabel} failed after ${maxRetries} attempts (HTTP ${res.status}): ${errorText}`);
        }

        const delayMs = attempt * this.baseRetryDelayMs;
        console.warn(`[DeviceApiClient] ${batchLabel} received transient HTTP ${res.status}. Retrying attempt ${attempt + 1}/${maxRetries} in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (err: any) {
        if (err.message?.includes("rejected with non-retryable status")) {
          throw err;
        }

        if (attempt === maxRetries) {
          throw new Error(`${batchLabel} failed after ${maxRetries} network attempts: ${err.message || String(err)}`);
        }

        const delayMs = attempt * this.baseRetryDelayMs;
        console.warn(`[DeviceApiClient] ${batchLabel} encountered transient error (${err.message || err}). Retrying attempt ${attempt + 1}/${maxRetries} in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Synchronizes records to the central server with client-side chunking and transient error retry.
   */
  async syncRecords(
    records: ZKTecoRecord[],
    users: ZKTecoUser[] = [],
    deviceIp?: string
  ): Promise<SyncResponse> {
    if (!this.deviceToken) {
      throw new Error("[DeviceApiClient] Missing DEVICE_TOKEN in environment configuration.");
    }

    const totalRecords = records.length;
    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;

    // If there are no punch records, sync users if any
    if (totalRecords === 0) {
      if (users.length > 0) {
        const payload = {
          records: [],
          users: users.map(u => ({
            userId: u.userId,
            name: u.name,
            role: u.role,
            cardno: u.cardno
          })),
          deviceIp
        };

        await this.postWithRetry(
          `${this.baseUrl}/api/device/sync`,
          payload,
          "User metadata batch"
        );
      }

      return {
        success: true,
        received: 0,
        inserted: 0,
        duplicates: 0,
        failed: 0
      };
    }

    // Chunk records into safe sizes (500-1000 per request)
    const numChunks = Math.ceil(totalRecords / this.chunkSize);
    console.log(`[DeviceApiClient] Synchronizing ${totalRecords} records across ${numChunks} batch(es) (Chunk size: ${this.chunkSize})...`);

    for (let i = 0; i < totalRecords; i += this.chunkSize) {
      const chunkIndex = Math.floor(i / this.chunkSize) + 1;
      const chunkRecords = records.slice(i, i + this.chunkSize);

      // Only send user metadata in the first chunk
      const chunkUsers = (i === 0) 
        ? users.map(u => ({
            userId: u.userId,
            name: u.name,
            role: u.role,
            cardno: u.cardno
          }))
        : [];

      const mappedRecords = chunkRecords.map(r => ({
        sn: r.sn,
        zktecoUserId: r.user_id,
        recordTime: r.record_time,
        type: r.type,
        state: r.state,
        ip: r.ip || deviceIp
      }));

      const payload = {
        records: mappedRecords,
        users: chunkUsers,
        deviceIp
      };

      console.log(`[DeviceApiClient] Sending Batch ${chunkIndex}/${numChunks} (${chunkRecords.length} records)...`);

      const data = await this.postWithRetry(
        `${this.baseUrl}/api/device/sync`,
        payload,
        `Batch ${chunkIndex}/${numChunks}`
      );

      totalInserted += data.inserted || 0;
      totalDuplicates += data.duplicates || 0;
      totalFailed += data.failed || 0;
    }

    return {
      success: true,
      received: totalRecords,
      inserted: totalInserted,
      duplicates: totalDuplicates,
      failed: totalFailed
    };
  }

  /**
   * Sends periodic hardware heartbeat to central server.
   */
  async sendHeartbeat(deviceReachable: boolean, deviceIp: string): Promise<boolean> {
    if (!this.deviceToken) return false;

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/device/heartbeat`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          deviceReachable,
          deviceIp
        })
      }, 10000);

      return res.ok;
    } catch (err) {
      console.warn("[DeviceApiClient] Heartbeat failed:", err);
      return false;
    }
  }

  /**
   * Polls central server for pending manual sync requests.
   */
  async getCommands(): Promise<CommandsResponse> {
    if (!this.deviceToken) return { syncRequested: false };

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/device/commands`, {
        method: "GET",
        headers: this.getHeaders()
      }, 10000);

      if (!res.ok) {
        return { syncRequested: false };
      }

      const data = await res.json();
      return {
        syncRequested: !!data.syncRequested,
        syncStatus: data.syncStatus
      };
    } catch (err) {
      return { syncRequested: false };
    }
  }

  /**
   * Acknowledges completion of a manual sync command.
   */
  async acknowledgeCommand(command: string, status: "SUCCESS" | "ERROR", error?: string): Promise<boolean> {
    if (!this.deviceToken) return false;

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/device/commands/ack`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          command,
          status,
          error
        })
      }, 10000);

      return res.ok;
    } catch (err) {
      console.warn("[DeviceApiClient] Command acknowledgement failed:", err);
      return false;
    }
  }
}

export const deviceApiClient = new DeviceApiClient();
