// test_groq_models.js
// Run with: node test_groq_models.js YOUR_GROQ_API_KEY
// Tests all candidate Groq models to find which are alive

const apiKey = process.argv[2] || process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error('Usage: node test_groq_models.js YOUR_GROQ_API_KEY');
  process.exit(1);
}

// ---- ALL candidate models to test ----
const TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama3-70b-8192',    // likely decommissioned
  'llama3-8b-8192',     // confirmed decommissioned
  'llama-3.1-70b-versatile', // likely decommissioned
];

const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-vl-32b-instruct',
  'llama-3.2-11b-vision-preview', // likely decommissioned
  'llama-3.2-90b-vision-preview', // decommissioned
];

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function testModel(modelId, hasImage = false) {
  const messages = hasImage ? [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is 1+1? Answer in one word.' },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          }
        }
      ]
    }
  ] : [
    { role: 'user', content: 'Reply with exactly the word "OK".' }
  ];

  const body = {
    model: modelId,
    messages,
    max_tokens: 10,
    stream: false
  };

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || '(empty)';
      return { status: '✅ WORKING', reply };
    } else {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      return { status: '❌ FAILED', reply: msg.slice(0, 80) };
    }
  } catch (e) {
    return { status: '⏱️  TIMEOUT/ERR', reply: e.message?.slice(0, 60) };
  }
}

async function main() {
  console.log('\n=== GROQ MODEL TESTER ===');
  console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}\n`);

  // First: list models from API
  console.log('--- Fetching live model list from Groq API ---');
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const modelIds = (data.data || []).map(m => m.id).sort();
      console.log(`Found ${modelIds.length} models:\n  ${modelIds.join('\n  ')}`);
    } else {
      console.log('Could not fetch model list:', res.status);
    }
  } catch (e) {
    console.log('Model list fetch failed:', e.message);
  }

  console.log('\n--- Testing TEXT models ---');
  for (const model of TEXT_MODELS) {
    process.stdout.write(`  ${model.padEnd(50)} `);
    const { status, reply } = await testModel(model, false);
    console.log(`${status}  [${reply}]`);
  }

  console.log('\n--- Testing VISION models (with 1x1 test image) ---');
  for (const model of VISION_MODELS) {
    process.stdout.write(`  ${model.padEnd(50)} `);
    const { status, reply } = await testModel(model, true);
    console.log(`${status}  [${reply}]`);
  }

  console.log('\nDone!');
}

main();
