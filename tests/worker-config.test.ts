import { validateWorkerConfig, assertWorkerConfig } from '../src/config/worker-config';

function runTests() {
  console.log('============================================================');
  console.log(' Running Worker Configuration Validation Tests');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Complete valid configuration returns valid = true
  const validMockEnv = {
    API_BASE_URL: 'https://pointage.test-client.ma',
    DEVICE_ID: 'DEV-CASABLANCA-01',
    DEVICE_TOKEN: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    ZKTECO_IP: '192.168.1.201',
    ZKTECO_PORT: '4370',
    ZKTECO_TIMEOUT: '10000',
    SYNC_INTERVAL_CRON: '*/15 * * * *',
    SYNC_CHUNK_SIZE: '500',
    SYNC_MAX_RETRIES: '3',
    SYNC_RETRY_DELAY_MS: '1000'
  };

  const validResult = validateWorkerConfig(validMockEnv);
  assert(validResult.valid === true, 'Complete valid configuration validates successfully');
  assert(validResult.missing.length === 0, 'No missing variables reported on complete config');
  assert(validResult.errors.length === 0, 'No errors reported on complete config');
  assert(validResult.config?.apiBaseUrl === 'https://pointage.test-client.ma', 'API URL is parsed cleanly');
  assert(validResult.config?.deviceId === 'DEV-CASABLANCA-01', 'Device ID is parsed cleanly');
  assert(validResult.config?.zktecoPort === 4370, 'Port parsed as number');

  // Test 2: Missing DEVICE_TOKEN is detected
  const missingTokenEnv = { ...validMockEnv, DEVICE_TOKEN: '' };
  const missingTokenResult = validateWorkerConfig(missingTokenEnv);
  assert(missingTokenResult.valid === false, 'Missing DEVICE_TOKEN causes validation failure');
  assert(missingTokenResult.missing.includes('DEVICE_TOKEN'), "Reports 'DEVICE_TOKEN' as missing");

  // Test 3: Missing API_BASE_URL is detected
  const missingUrlEnv = { ...validMockEnv, API_BASE_URL: '' };
  const missingUrlResult = validateWorkerConfig(missingUrlEnv);
  assert(missingUrlResult.valid === false, 'Missing API_BASE_URL causes validation failure');
  assert(missingUrlResult.missing.includes('API_BASE_URL'), "Reports 'API_BASE_URL' as missing");

  // Test 4: Invalid API_BASE_URL format is detected
  const invalidUrlEnv = { ...validMockEnv, API_BASE_URL: 'invalid-url-without-protocol' };
  const invalidUrlResult = validateWorkerConfig(invalidUrlEnv);
  assert(invalidUrlResult.valid === false, 'Malformed API_BASE_URL causes validation failure');
  assert(invalidUrlResult.errors.some(e => e.includes('API_BASE_URL')), 'Error message explains URL protocol requirement');

  // Test 5: Missing DEVICE_ID is detected
  const missingDeviceIdEnv = { ...validMockEnv, DEVICE_ID: '   ' };
  const missingDeviceIdResult = validateWorkerConfig(missingDeviceIdEnv);
  assert(missingDeviceIdResult.valid === false, 'Whitespace/empty DEVICE_ID causes validation failure');
  assert(missingDeviceIdResult.missing.includes('DEVICE_ID'), "Reports 'DEVICE_ID' as missing");

  // Test 6: Missing ZKTECO_IP is detected
  const missingIpEnv = { ...validMockEnv, ZKTECO_IP: '' };
  const missingIpResult = validateWorkerConfig(missingIpEnv);
  assert(missingIpResult.valid === false, 'Missing ZKTECO_IP causes validation failure');
  assert(missingIpResult.missing.includes('ZKTECO_IP'), "Reports 'ZKTECO_IP' as missing");

  // Test 7: assertWorkerConfig throws Error on incomplete environment
  let threwOnIncomplete = false;
  try {
    assertWorkerConfig({});
  } catch (err: any) {
    threwOnIncomplete = true;
    assert(
      err.message.includes('Missing API_BASE_URL') && err.message.includes('Missing DEVICE_TOKEN'),
      'assertWorkerConfig error message lists all missing variables'
    );
  }
  assert(threwOnIncomplete, 'assertWorkerConfig fails closed on incomplete environment');

  // Test 8: assertWorkerConfig succeeds on valid config and applies defaults
  const minimalValidEnv = {
    API_BASE_URL: 'https://pointage.example.com',
    DEVICE_ID: 'DEV-MINIMAL-01',
    DEVICE_TOKEN: 'secret_token_123',
    ZKTECO_IP: '192.168.1.201'
  };

  const parsedConfig = assertWorkerConfig(minimalValidEnv);
  assert(parsedConfig.zktecoPort === 4370, 'Default ZKTECO_PORT (4370) applied');
  assert(parsedConfig.zktecoTimeout === 10000, 'Default ZKTECO_TIMEOUT (10000ms) applied');
  assert(parsedConfig.syncIntervalCron === '*/15 * * * *', 'Default SYNC_INTERVAL_CRON applied');
  assert(parsedConfig.syncChunkSize === 500, 'Default SYNC_CHUNK_SIZE (500) applied');

  console.log('\n============================================================');
  console.log(` Worker Config Test Summary: ${passed} passed, ${failed} failed`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
