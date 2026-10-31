// fetch_available_models.js - Fetch what models this key tier can actually access
// Usage: node fetch_available_models.js YOUR_GROQ_API_KEY
const key = process.argv[2] || process.env.GROQ_API_KEY;
if (!key) { console.error('Usage: node fetch_available_models.js YOUR_GROQ_KEY'); process.exit(1); }

const CANDIDATE_MODELS = [
  // Current known models
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  // Older ones that might still exist on free tier
  'llama3-70b-8192',
  'llama3-8b-8192',
  'gemma2-9b-it',
  'gemma-7b-it',
  'mixtral-8x7b-32768',
  // Vision
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llava-v1.5-7b-4096-preview',
  'qwen/qwen3-vl-32b-instruct',
  'qwen/qwen3.8-27b',
  // Whisper (for STT)
  'whisper-large-v3-turbo',
  'whisper-large-v3',
];

async function testModel(modelId) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
        stream: false
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) return '✅ WORKING';
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${res.status}`;
    if (res.status === 404) return '❌ 404 Not Found';
    if (res.status === 429) return '⚠️  Rate Limited (key works!)';
    if (res.status === 401) return '🔑 Invalid key';
    return `❌ ${res.status}: ${msg.slice(0, 60)}`;
  } catch (e) {
    return `⏱️  ${e.message?.slice(0, 40)}`;
  }
}

async function main() {
  // First get the official model list
  console.log('Fetching official model list from Groq API...\n');
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const models = (data.data || []).sort((a, b) => a.id.localeCompare(b.id));
      console.log(`=== ${models.length} MODELS FROM /v1/models ENDPOINT ===`);
      models.forEach(m => console.log(`  ${m.id}`));
    } else {
      console.log('Could not fetch model list:', res.status);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n=== TESTING CHAT COMPLETIONS ACCESS ===');
  for (const model of CANDIDATE_MODELS) {
    process.stdout.write(`  ${model.padEnd(55)} `);
    const result = await testModel(model);
    console.log(result);
  }
}

main();
