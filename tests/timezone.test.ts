import { validateRuntimeTimezone, assertRuntimeTimezone, REQUIRED_WORKER_TIMEZONE } from '../src/config/timezone';

function runTests() {
  console.log('============================================================');
  console.log(' Running Timezone Pre-Flight Guard Tests');
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

  const currentRuntimeTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log(`Detected local Node.js runtime timezone: ${currentRuntimeTz}`);
  console.log(`Mandatory required worker timezone:       ${REQUIRED_WORKER_TIMEZONE}\n`);

  // Test 1: REQUIRED_WORKER_TIMEZONE constant is strictly Africa/Casablanca
  assert(
    REQUIRED_WORKER_TIMEZONE === 'Africa/Casablanca',
    "REQUIRED_WORKER_TIMEZONE is strictly 'Africa/Casablanca'"
  );

  // Test 2: Matching Africa/Casablanca returns valid = true
  const matchResult = validateRuntimeTimezone(currentRuntimeTz);
  assert(
    matchResult.valid === (currentRuntimeTz === REQUIRED_WORKER_TIMEZONE),
    `Local timezone validation matches expected status for ${currentRuntimeTz}`
  );

  // Test 3: Mismatched timezones return valid = false with clear error
  const testCases = [
    { target: 'UTC', expectValid: currentRuntimeTz === 'UTC' },
    { target: 'Europe/Paris', expectValid: currentRuntimeTz === 'Europe/Paris' },
    { target: 'America/New_York', expectValid: currentRuntimeTz === 'America/New_York' },
    { target: 'Asia/Tokyo', expectValid: currentRuntimeTz === 'Asia/Tokyo' }
  ];

  for (const tc of testCases) {
    const res = validateRuntimeTimezone(tc.target);
    assert(
      res.valid === tc.expectValid,
      `Target '${tc.target}' validation correctly yields valid=${tc.expectValid}`
    );
    if (!res.valid) {
      assert(
        typeof res.error === 'string' && res.error.includes(tc.target),
        `Error message explains mismatch for '${tc.target}'`
      );
    }
  }

  // Test 4: assertRuntimeTimezone throws Error on mismatch
  let threwOnMismatch = false;
  try {
    assertRuntimeTimezone('Invalid/NonExistent_Timezone_Mock');
  } catch (err: any) {
    threwOnMismatch = true;
    assert(
      err.message.includes('Runtime timezone mismatch'),
      'assertRuntimeTimezone throws error containing mismatch explanation'
    );
  }
  assert(threwOnMismatch, 'assertRuntimeTimezone fails closed on timezone mismatch');

  // Test 5: assertRuntimeTimezone succeeds cleanly on match
  let threwOnMatch = false;
  try {
    assertRuntimeTimezone(currentRuntimeTz);
  } catch (err) {
    threwOnMatch = true;
  }
  assert(!threwOnMatch, 'assertRuntimeTimezone succeeds cleanly when timezone matches');

  console.log('\n============================================================');
  console.log(` Timezone Test Summary: ${passed} passed, ${failed} failed`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
