import { validateRuntimeTimezone, assertRuntimeTimezone } from '../src/config/timezone';

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
  console.log(`Detected local Node.js runtime timezone: ${currentRuntimeTz}\n`);

  // Test 1: Matching expected timezone returns valid = true
  const matchResult = validateRuntimeTimezone(currentRuntimeTz);
  assert(matchResult.valid === true, `Matching timezone (${currentRuntimeTz}) returns valid: true`);
  assert(matchResult.actual === currentRuntimeTz, `Result reports correct actual timezone (${currentRuntimeTz})`);
  assert(matchResult.expected === currentRuntimeTz, `Result reports correct expected timezone`);

  // Test 2: Mismatched timezone returns valid = false with clear error
  const mismatchTarget = (currentRuntimeTz === 'UTC') ? 'Europe/Paris' : 'UTC';
  const mismatchResult = validateRuntimeTimezone(mismatchTarget);
  assert(mismatchResult.valid === false, `Mismatched timezone target (${mismatchTarget}) returns valid: false`);
  assert(typeof mismatchResult.error === 'string' && mismatchResult.error.length > 0, `Error description is populated`);

  // Test 3: Specific international timezone mismatches
  const testCases = [
    { target: 'UTC', expectMatch: currentRuntimeTz === 'UTC' },
    { target: 'Europe/Paris', expectMatch: currentRuntimeTz === 'Europe/Paris' },
    { target: 'America/New_York', expectMatch: currentRuntimeTz === 'America/New_York' },
    { target: 'Asia/Tokyo', expectMatch: currentRuntimeTz === 'Asia/Tokyo' },
    { target: 'Africa/Casablanca', expectMatch: currentRuntimeTz === 'Africa/Casablanca' }
  ];

  for (const tc of testCases) {
    const res = validateRuntimeTimezone(tc.target);
    assert(
      res.valid === tc.expectMatch,
      `Target '${tc.target}' validation correctly yields valid=${tc.expectMatch}`
    );
  }

  // Test 4: assertRuntimeTimezone throws Error on mismatch
  let threwOnMismatch = false;
  try {
    assertRuntimeTimezone('NonExistent/Invalid_Timezone_For_Testing');
  } catch (err: any) {
    threwOnMismatch = true;
    assert(
      err.message.includes('Runtime timezone mismatch'),
      'assertRuntimeTimezone throws error containing mismatch explanation'
    );
  }
  assert(threwOnMismatch, 'assertRuntimeTimezone fails closed on timezone mismatch');

  // Test 5: assertRuntimeTimezone succeeds without throwing on exact match
  let threwOnMatch = false;
  try {
    assertRuntimeTimezone(currentRuntimeTz);
  } catch (err) {
    threwOnMatch = true;
  }
  assert(!threwOnMatch, 'assertRuntimeTimezone succeeds cleanly on exact match');

  console.log('\n============================================================');
  console.log(` Test Summary: ${passed} passed, ${failed} failed`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
