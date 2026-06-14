const Zkteco = require('zkteco-js');

async function run() {
    const device = new Zkteco('192.168.11.201', 4370, 15000, 4000);

    try {
        console.log('Connecting to K14 firmware...');
        await device.createSocket();
        console.log('Connected successfully!');

        // Check metadata
        const version = await device.getDeviceVersion();
        const name = await device.getDeviceName();
        const logCount = await device.getAttendanceSize();

        console.log(`\n[Device Profile] Model: ${name} | Firmware: ${version}`);
        console.log(`[Storage] Logs stored on hardware: ${logCount}`);

        if (logCount > 0) {
            console.log('\nStreaming records...');
            const response = await device.getAttendances();

            // Extract the actual array from the response object wrapper
            const logArray = response.data ? response.data : response;

            if (logArray && Array.isArray(logArray)) {
                console.log(`Successfully parsed ${logArray.length} entries.`);
                console.log('\n--- ATTENDANCE DATA MATRIX ---');
                console.table(logArray.slice(-10)); // Display up to last 10 punches
            } else {
                console.log('Could not parse the log array structure.', response);
            }
        } else {
            console.log('\nDevice storage is empty. Tap your finger on the machine first!');
        }

    } catch (error) {
        console.error('\n[Device Data Error]:', error.message || error);
    } finally {
        try {
            await device.disconnect();
            console.log('\nSocket disconnected safely.');
        } catch (e) { }
    }
}

run();