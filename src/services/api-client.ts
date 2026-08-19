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

  constructor() {
    this.baseUrl = (process.env.API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    this.deviceId = process.env.DEVICE_ID || "FACTORY-01";
    this.deviceToken = process.env.DEVICE_TOKEN || "";
    this.chunkSize = parseInt(process.env.SYNC_CHUNK_SIZE || "500", 10) || 500;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-device-id": this.deviceId,
      "x-device-token": this.deviceToken
    };
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

  /**
   * Synchronizes records to the central server with client-side chunking.
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

    // If there are no records, still sync users if any
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

        const res = await this.fetchWithTimeout(`${this.baseUrl}/api/device/sync`, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[DeviceApiClient] User sync failed (HTTP ${res.status}): ${errText}`);
        }
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

      // Only send user metadata in the first chunk to minimize payload overhead
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

      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/device/sync`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[DeviceApiClient] Batch ${chunkIndex} failed (HTTP ${res.status}):`, errorText);
        throw new Error(`Batch ${chunkIndex}/${numChunks} failed with status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
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
