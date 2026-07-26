import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update validateGlmKey to bypass fetch for NVIDIA keys (which block CORS on /models)
new_validate = """const validateGlmKey = async (key: string): Promise<boolean> => {
  try {
    const isNvidia = key.startsWith('nvapi-');
    if (isNvidia) {
      // NVIDIA keys are typically 69 chars long and start with nvapi-
      return key.length === 69;
    }
    
    // For Zhipu GLM, try standard completion
    const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const reqInit: RequestInit = {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'glm-4', messages: [{role: 'user', content: 'hi'}], max_tokens: 1 })
    };
    
    const res = await fetch(url, reqInit);
    return res.ok;
  } catch {
    return false;
  }
};"""

old_validate_pattern = r'const validateGlmKey = async \(key: string\): Promise<boolean> => \{[\s\S]*?\}\s*\};\s*'
content = re.sub(old_validate_pattern, new_validate + "\n\n", content)


# 2. Auto-save keys to localStorage
autosave_hooks = """  useEffect(() => { localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys)); }, [groqKeys]);
  useEffect(() => { localStorage.setItem('gemini_api_keys', JSON.stringify(geminiKeys)); }, [geminiKeys]);
  useEffect(() => { localStorage.setItem('claude_api_keys', JSON.stringify(claudeKeys)); }, [claudeKeys]);
  useEffect(() => { localStorage.setItem('chatgpt_api_keys', JSON.stringify(chatgptKeys)); }, [chatgptKeys]);
  useEffect(() => { localStorage.setItem('deepseek_api_keys', JSON.stringify(deepseekKeys)); }, [deepseekKeys]);
  useEffect(() => { localStorage.setItem('glm_api_keys', JSON.stringify(glmKeys)); }, [glmKeys]);
"""

if "localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys)); }, [groqKeys]);" not in content:
    # insert right before the first useEffect for groqKeys validation
    content = content.replace("useEffect(() => {\n    const timeoutId = setTimeout(async () => {\n      const keysToValidate = new Set<string>();\n      \n      setGroqKeyStatus", 
                              autosave_hooks + "\n  useEffect(() => {\n    const timeoutId = setTimeout(async () => {\n      const keysToValidate = new Set<string>();\n      \n      setGroqKeyStatus")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
