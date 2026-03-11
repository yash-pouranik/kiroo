import chalk from 'chalk';

/**
 * Validates a response against a set of rules
 * @param {Object} response - The Axios response object
 * @param {Object} rules - Rules like { status, has: [], match: { key: value } }
 * @returns {Object} { passed: boolean, results: [] }
 */
export function validateResponse(response, rules) {
  const results = [];
  let allPassed = true;

  // 1. Status Check
  if (rules.status) {
    const expected = parseInt(rules.status);
    const actual = response.status;
    const passed = expected === actual;
    results.push({
      label: 'Status Code',
      expected,
      actual,
      passed
    });
    if (!passed) allPassed = false;
  }

  // 2. Body Presence Check (has keys)
  if (rules.has && rules.has.length > 0) {
    const body = response.data || {};
    rules.has.forEach(key => {
      let actual = getDeep(body, key);
      let passed = actual !== undefined;
      
      // Smart Array Handling: 
      // If root is an Array and user checks for 'data' (or any key) that's missing,
      // we check if the array itself belongs to the "presence" check.
      if (!passed && Array.isArray(body)) {
        // If the user is checking for existence on a root array, 
        // we'll pass if the array is not empty.
        passed = body.length > 0;
        actual = passed ? `Array(${body.length})` : 'Empty Array';
      }

      results.push({
        label: `Field Presence [${key}]`,
        expected: 'Exists',
        actual: passed ? (actual === undefined ? 'Found' : actual) : 'Missing',
        passed
      });
      if (!passed) allPassed = false;
    });
  }

  // 3. Value Match Check
  if (rules.match && Object.keys(rules.match).length > 0) {
    const body = response.data || {};
    for (const [key, expected] of Object.entries(rules.match)) {
      const actual = getDeep(body, key);
      const passed = String(actual) === String(expected);
      results.push({
        label: `Value Match [${key}]`,
        expected,
        actual: actual !== undefined ? actual : 'undefined',
        passed
      });
      if (!passed) allPassed = false;
    }
  }

  return { passed: allPassed, results };
}

function getDeep(obj, path) {
  if (!obj) return undefined;
  const keys = path.split(/[.[\]]+/).filter(Boolean);
  return keys.reduce((acc, key) => acc && acc[key], obj);
}

export function showCheckResult(validation) {
  console.log(chalk.cyan('\n  🧪 Test Results:'));
  
  validation.results.forEach(res => {
    const icon = res.passed ? chalk.green('✓') : chalk.red('✗');
    const color = res.passed ? chalk.white : chalk.red;
    
    console.log(`  ${icon} ${res.label}`);
    if (!res.passed) {
      console.log(chalk.gray(`     Expected: ${res.expected}`));
      console.log(chalk.gray(`     Actual:   ${res.actual}`));
    }
  });

  if (validation.passed) {
    console.log(chalk.green.bold('\n  ✨ ALL TESTS PASSED! \n'));
  } else {
    console.log(chalk.red.bold('\n  ❌ SOME TESTS FAILED \n'));
    process.exit(1);
  }
}
