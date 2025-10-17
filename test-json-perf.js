// Test JSON.stringify performance

const obj = { message: 'Hello, World!', timestamp: Date.now() };

function fastStringify(obj) {
  const keys = Object.keys(obj);
  const pairs = [];
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string') {
      pairs.push(`"${key}":"${value}"`);
    } else if (typeof value === 'number') {
      pairs.push(`"${key}":${value}`);
    }
  }
  return '{' + pairs.join(',') + '}';
}

console.log('Testing JSON serialization performance...\n');

const iterations = 1000000;

// Test native JSON.stringify
console.time('JSON.stringify');
for (let i = 0; i < iterations; i++) {
  JSON.stringify(obj);
}
console.timeEnd('JSON.stringify');

// Test fastStringify
console.time('fastStringify');
for (let i = 0; i < iterations; i++) {
  fastStringify(obj);
}
console.timeEnd('fastStringify');

console.log('\nResult comparison:');
console.log('JSON.stringify:', JSON.stringify(obj));
console.log('fastStringify:', fastStringify(obj));
