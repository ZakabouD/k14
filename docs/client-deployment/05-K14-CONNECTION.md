# 05 — K14 CONNECTION
# Physical Biometric Terminal Cabling & Isolated Network Setup

This guide details the physical cabling, on-device menu configuration, and diagnostic verification for connecting the ZKTeco K14 standalone fingerprint terminal to the dedicated Raspberry Pi bridge over an isolated Layer 2 Ethernet link.

---

## 1. Physical Cabling & Topology

```
┌─────────────────────────────────┐                 ┌─────────────────────────────┐
│ Dedicated Raspberry Pi Bridge   │                 │ ZKTeco K14 Standalone       │
│                                 │                 │ Fingerprint Terminal        │
│ [<PI_K14_INTERFACE>: <PI_K14_IP>]◄─── Direct ────►│ [RJ45 Port: <K14_IP>]       │
│ (No default gateway configured) │     CAT6 Cable  │ (Port 4370, DHCP: OFF)      │
└─────────────────────────────────┘                 └─────────────────────────────┘
```

### Physical Requirements:
1. **Direct Patch Cable:** Standard RJ45 CAT5e or CAT6 straight-through patch cable connecting the Pi onboard Ethernet jack (`<PI_K14_INTERFACE>`) directly to the K14 Ethernet port.
2. **Power Isolation:** ZKTeco K14 powered by its dedicated 12V DC power adapter; Raspberry Pi powered by its official 5V/3A USB-C power supply.
3. **No Intermediate Switch Required:** The direct cable provides a point-to-point Layer 2 link without requiring an external switch or router.

---

## 2. ZKTeco K14 On-Device Menu Configuration

Navigate using the physical keypad on the front of the K14 terminal:

1. Press **`[ M/OK ]`** to enter the Main Menu (or scan admin fingerprint if registered).
2. Select **`Comm.`** (Communication) and press **`[ M/OK ]`**.
3. Select **`Ethernet`** and configure the collected static IP parameters:

| Parameter | Value | Notes |
| :--- | :--- | :--- |
| **IP Address** | `<K14_IP>` | *Assigned static IP on isolated subnet* |
| **Subnet Mask** | `<K14_NETMASK>` | *Standard subnet mask (e.g. `255.255.255.0`)* |
| **Gateway** | `0.0.0.0` | *No internet gateway required for isolated link* |
| **Port** | `4370` | *Default ZKTeco protocol port* |
| **DHCP** | `OFF` | *Static configuration mandatory* |

4. Press **`[ ESC ]`** to save and exit to the main clock display.

---

## 3. Multi-Layer Diagnostic Verification

Execute the following checks from the Raspberry Pi terminal via SSH:

### Layer 1: Physical Link & Carrier Status
```bash
cat /sys/class/net/<PI_K14_INTERFACE>/carrier
cat /sys/class/net/<PI_K14_INTERFACE>/operstate
```
* **Expected Output:** `1` and `up`.
* **Pass Criteria:** Ethernet link lights on both the Pi and K14 are blinking/illuminated.

### Layer 3: Network Reachability (ICMP)
```bash
ping -c 3 <K14_IP>
```
* **Expected Output:** `3 packets transmitted, 3 received, 0% packet loss`.
* **Pass Criteria:** `0% packet loss`.

### Layer 4: Protocol Port Availability (TCP 4370)
```bash
nc -zv <K14_IP> 4370
```
* **Expected Output:** `Connection to <K14_IP> 4370 port [tcp/*] succeeded!`
* **Pass Criteria:** TCP port 4370 accepts incoming socket connections.

### Layer 7: PM2 Bridge Worker Protocol Handshake
Trigger a synchronization test or inspect PM2 output logs:
```bash
pm2 logs zkteco-sync-worker --lines 20 --nostream
```
* **Expected Output:**
  ```text
  [ZKTeco] Connecting to terminal at <K14_IP>:4370 (Attempt 1/3)...
  TCP connection successful
  [ZKTeco] Fetching device users...
  [ZKTeco] Logs stored on hardware: X
  [SyncWorker] Read X punch records and Y users from hardware.
  ```
* **Pass Criteria:** `TCP connection successful` logged, hardware log count returned.

---

## 4. Strict Operational Rules

1. **NEVER Clear Logs from Terminal Menu:** The K14 memory should not be cleared during deployment. The commercial synchronization engine handles deduplication automatically.
2. **NEVER Run Multiple Pollers:** Only the single managed PM2 worker `zkteco-sync-worker` should poll the terminal. Running concurrent connection scripts can lock the ZKTeco hardware socket.
3. **Preserve Device Clock:** The terminal clock must match local time (`Africa/Casablanca`). The bridge worker maps terminal local time directly to UTC for cloud storage.
