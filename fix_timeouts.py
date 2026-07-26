import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. groq
content = content.replace("""const validateGroqKey = async (key: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    return res.ok;
  } catch {
    return false;
  }
};""", """const validateGroqKey = async (key: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
};""")

# 2. gemini
content = content.replace("""  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    return res.ok;
  } catch {""", """  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {""")

# 3. claude
content = content.replace("""const validateClaudeKey = async (key: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1, messages: [{role: 'user', content: 'test'}]})
    });
    return res.status !== 401;
  } catch { return false; }
};""", """const validateClaudeKey = async (key: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1, messages: [{role: 'user', content: 'test'}]}),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.status !== 401;
  } catch { return false; }
};""")

# 4. chatgpt
content = content.replace("""const validateChatgptKey = async (key: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    return res.ok;
  } catch { return false; }
};""", """const validateChatgptKey = async (key: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch { return false; }
};""")

# 5. deepseek
content = content.replace("""const validateDeepseekKey = async (key: string): Promise<{valid: boolean, balance: string}> => {
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!res.ok) return {valid: false, balance: ''};
    const data = await res.json();
    return {
      valid: true, 
      balance: data.balance_infos?.[0]?.total_balance || '?'
    };
  } catch { return {valid: false, balance: ''}; }
};""", """const validateDeepseekKey = async (key: string): Promise<{valid: boolean, balance: string}> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return {valid: false, balance: ''};
    const data = await res.json();
    return {
      valid: true, 
      balance: data.balance_infos?.[0]?.total_balance || '?'
    };
  } catch { return {valid: false, balance: ''}; }
};""")

# 6. glm
content = content.replace("""    const res = await fetch(url, reqInit);
    return res.ok;
  } catch {
    return false;
  }""", """    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { ...reqInit, signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }""")


with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
