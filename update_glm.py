import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update useState
content = content.replace("const [glmKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));", "const [glmKeyStatus, setGlmKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));")

# 2. Add glmValidationCache
if "const glmValidationCache = useRef<Record<string, boolean>>({});" not in content:
    content = content.replace("const deepseekValidationCache = useRef<Record<string, {valid: boolean, balance: string}>>({});", 
                              "const deepseekValidationCache = useRef<Record<string, {valid: boolean, balance: string}>>({});\n  const glmValidationCache = useRef<Record<string, boolean>>({});")

# 3. Add validateGlmKey
if "const validateGlmKey = async (key: string): Promise<boolean>" not in content:
    deepseek_func = """const validateDeepseekKey = async (key: string): Promise<{valid: boolean, balance: string}> => {
    try {
      const res = await fetch('https://api.deepseek.com/user/balance', {
        headers: { Authorization: `Bearer ${key}` }
      });
      if (!res.ok) return {valid: false, balance: ''};
      const data = await res.json();
      const balance = data.balance_infos?.[0]?.total_balance || '';
      return {valid: true, balance};
    } catch {
      return {valid: false, balance: ''};
    }
  };"""
  
    glm_func = """const validateGlmKey = async (key: string): Promise<boolean> => {
    try {
      const isNvidia = key.startsWith('nvapi-');
      const url = isNvidia ? 'https://integrate.api.nvidia.com/v1/models' : 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      
      const reqInit: RequestInit = {
        headers: { Authorization: `Bearer ${key}` }
      };
      
      if (!isNvidia) {
         reqInit.method = 'POST';
         reqInit.headers = { ...reqInit.headers, 'Content-Type': 'application/json' };
         reqInit.body = JSON.stringify({ model: 'glm-4', messages: [{role: 'user', content: 'hi'}], max_tokens: 1 });
      }
      
      const res = await fetch(url, reqInit);
      return res.ok;
    } catch {
      return false;
    }
  };"""
  
    content = content.replace(deepseek_func, deepseek_func + "\n\n  " + glm_func)

# 4. Add useEffect for glmKeys
if "setGlmKeyStatus(prev =>" not in content:
    use_effect_block = """useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const keysToValidate = new Set<string>();
      
      setGlmKeyStatus(prev => {
        const next = [...prev];
        for (let i = 0; i < 3; i++) {
          const key = glmKeys[i].key.trim();
          if (!key) {
            next[i] = 'idle';
          } else if (glmKeys.findIndex((k, idx) => idx !== i && k.key.trim() === key) !== -1) {
            next[i] = 'duplicate';
          } else {
            if (glmValidationCache.current[key] === undefined) {
              next[i] = 'validating';
              keysToValidate.add(key);
            } else {
              next[i] = glmValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
        }
        return next;
      });

      if (keysToValidate.size > 0) {
        await Promise.all(Array.from(keysToValidate).map(async (key) => {
          glmValidationCache.current[key] = await validateGlmKey(key);
        }));
        
        setGlmKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = glmKeys[i].key.trim();
            if (key && glmKeys.findIndex((k, idx) => idx !== i && k.key.trim() === key) === -1) {
               next[i] = glmValidationCache.current[key] ? 'valid' : 'invalid';
            }
          }
          return next;
        });
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [glmKeys]);"""
  
    content = content.replace("useEffect(() => {\n    const timeoutId = setTimeout(async () => {\n      const keysToValidate = new Set<string>();\n      \n      setDeepseekKeyStatus", 
                              use_effect_block + "\n\n  useEffect(() => {\n    const timeoutId = setTimeout(async () => {\n      const keysToValidate = new Set<string>();\n      \n      setDeepseekKeyStatus")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
