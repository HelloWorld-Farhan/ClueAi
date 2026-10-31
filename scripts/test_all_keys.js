// test_all_keys.js - Tests multiple Groq API keys
// Usage: node test_all_keys.js KEY1 KEY2 KEY3 ...
// Or edit the keys array below with your own keys (do NOT commit real keys to git!)

const keys = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : [
    // Add your keys here for local testing only — never commit real keys
    // 'gsk_YOUR_KEY_HERE',
  ];

if (keys.length === 0) {
  console.log('Usage: node test_all_keys.js KEY1 KEY2 KEY3 ...');
  console.log('Or add keys to the array in this file (do not commit!)');
  process.exit(0);
}

// Confirmed working models for free-tier keys (openai/gpt-oss-20b)
const MODEL = 'openai/gpt-oss-20b';

async function testKey(key) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Reply with OK' }],
        max_tokens: 5,
        stream: false
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) return { status: '✅ WORKING', detail: '' };
    const err = await res.json().catch(() => ({}));
    const msg = (err?.error?.message || `HTTP ${res.status}`).slice(0, 90);
    if (res.status === 429) return { status: '⚠️  RATE LIMITED (key valid!)', detail: '' };
    if (res.status === 401) return { status: '❌ INVALID/REVOKED KEY', detail: msg };
    return { status: `❌ ERROR ${res.status}`, detail: msg };
  } catch (e) {
    return { status: '⏱️  TIMEOUT', detail: e.message?.slice(0, 60) };
  }
}

async function main() {
  console.log(`\nTesting ${keys.length} Groq API keys with model: ${MODEL}\n`);
  console.log('='.repeat(70));

  const working = [], rateLimited = [], failed = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const shortKey = `...${key.slice(-12)}`;
    const label = `Key #${String(i + 1).padStart(2, '0')}: ${shortKey}`;
    process.stdout.write(`  ${label}  → `);
    const { status, detail } = await testKey(key);
    console.log(`${status}  ${detail}`);
    if (status.startsWith('✅')) working.push(i + 1);
    else if (status.startsWith('⚠️')) rateLimited.push(i + 1);
    else failed.push(i + 1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Working:      ${working.length} keys  → #${working.join(', #') || 'none'}`);
  console.log(`  ⚠️  Rate Limited: ${rateLimited.length} keys  → #${rateLimited.join(', #') || 'none'} (key is valid)`);
  console.log(`  ❌ Failed:       ${failed.length} keys  → #${failed.join(', #') || 'none'}`);
  console.log('');
}

main();
