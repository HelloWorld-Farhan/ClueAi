import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add TimedApiKey to AIClient imports
code = code.replace(
    "import { initAIClient, getInterviewAnswer, switchProvider } from './AIClient';",
    "import { initAIClient, getInterviewAnswer, switchProvider, TimedApiKey } from './AIClient';"
)

# 2. Add validation functions and getDaysLeft
validation_funcs = """
const getDaysLeft = (addedAt: number, limit: number) => {
  if (!addedAt) return null;
  const daysPassed = (Date.now() - addedAt) / (1000 * 60 * 60 * 24);
  return Math.max(0, limit - Math.floor(daysPassed));
};

const validateClaudeKey = async (key: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1, messages: [{role: 'user', content: 'test'}]})
    });
    return res.status !== 401;
  } catch { return false; }
};

const validateChatgptKey = async (key: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    return res.ok;
  } catch { return false; }
};

const validateDeepseekKey = async (key: string): Promise<{valid: boolean, balance: string}> => {
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
};

"""
code = code.replace("const CustomSelect = ", validation_funcs + "const CustomSelect = ")

# 3. Add Provider Type
code = code.replace(
    "const [provider, setProvider] = useState<'groq' | 'gemini-flash'>('groq');",
    "const [provider, setProvider] = useState<'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek'>('groq');"
)

# 4. Add state vars
state_vars = """
  const [claudeKeys, setClaudeKeys] = useState<TimedApiKey[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('claude_api_keys') || '[]'); 
      return keys.length === 1 ? keys : [{key: '', addedAt: 0}];
    } catch { return [{key: '', addedAt: 0}]; }
  });
  const [chatgptKeys, setChatgptKeys] = useState<TimedApiKey[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('chatgpt_api_keys') || '[]'); 
      return keys.length === 3 ? keys : [...keys, ...Array(3).fill({key: '', addedAt: 0})].slice(0, 3);
    } catch { return Array(3).fill({key: '', addedAt: 0}); }
  });
  const [deepseekKeys, setDeepseekKeys] = useState<TimedApiKey[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('deepseek_api_keys') || '[]'); 
      return keys.length === 3 ? keys : [...keys, ...Array(3).fill({key: '', addedAt: 0})].slice(0, 3);
    } catch { return Array(3).fill({key: '', addedAt: 0}); }
  });

  const [claudeKeyStatus, setClaudeKeyStatus] = useState<KeyValidationState[]>(Array(1).fill('idle'));
  const [chatgptKeyStatus, setChatgptKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));
  const [deepseekKeyStatus, setDeepseekKeyStatus] = useState<KeyValidationState[]>(Array(3).fill('idle'));
  
  const [showClaudeKeys, setShowClaudeKeys] = useState<boolean[]>(Array(1).fill(false));
  const [showChatgptKeys, setShowChatgptKeys] = useState<boolean[]>(Array(3).fill(false));
  const [showDeepseekKeys, setShowDeepseekKeys] = useState<boolean[]>(Array(3).fill(false));
  const [deepseekBalances, setDeepseekBalances] = useState<string[]>(Array(3).fill(''));
"""
code = code.replace(
    "const [showGeminiKeys, setShowGeminiKeys] = useState<boolean[]>(Array(15).fill(false));",
    "const [showGeminiKeys, setShowGeminiKeys] = useState<boolean[]>(Array(15).fill(false));\n" + state_vars
)

# 5. Add expiration logic
expiration_logic = """
  const cleanKeys = (keys: TimedApiKey[], limitDays: number) => {
    return keys.map(k => {
      if (!k.addedAt) return k;
      const daysPassed = (Date.now() - k.addedAt) / (1000 * 60 * 60 * 24);
      return daysPassed >= limitDays ? { key: '', addedAt: 0 } : k;
    });
  };

  useEffect(() => {
    setClaudeKeys(prev => cleanKeys(prev, 14));
    setChatgptKeys(prev => cleanKeys(prev, 90));
    setDeepseekKeys(prev => cleanKeys(prev, 90));
  }, []);
"""
code = code.replace(
    "const handleMicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {",
    expiration_logic + "\n  const handleMicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {"
)

# 6. Api accordion
code = code.replace(
    "const [apiAccordion, setApiAccordion] = useState<'none' | 'groq' | 'gemini'>('none');",
    "const [apiAccordion, setApiAccordion] = useState<'none' | 'groq' | 'gemini' | 'claude' | 'chatgpt' | 'deepseek'>('none');"
)

# 7. Validation cache and save
validation_cache = """
  const claudeValidationCache = useRef<Record<string, boolean>>({});
  const chatgptValidationCache = useRef<Record<string, boolean>>({});
  const deepseekValidationCache = useRef<Record<string, {valid: boolean, balance: string}>>({});
"""
code = code.replace(
    "const geminiValidationCache = useRef<Record<string, boolean>>({});",
    "const geminiValidationCache = useRef<Record<string, boolean>>({});\n" + validation_cache
)

save_func = """
  const saveApiKeys = () => {
    const dupGroq = groqKeyStatus.map((s, i) => s === 'duplicate' ? i + 1 : -1).filter(i => i !== -1);
    const dupGem = geminiKeyStatus.map((s, i) => s === 'duplicate' ? i + 1 : -1).filter(i => i !== -1);
    const invGroq = groqKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invGem = geminiKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invClaude = claudeKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invChatgpt = chatgptKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    const invDeepseek = deepseekKeyStatus.map((s, i) => s === 'invalid' ? i + 1 : -1).filter(i => i !== -1);
    
    let msgs: {type: 'success' | 'invalid' | 'duplicate', text: string}[] = [];
    if (dupGroq.length > 0) msgs.push({ type: 'duplicate', text: `Warning: Groq Key ${dupGroq.join(' and ')} are duplicates.` });
    if (dupGem.length > 0) msgs.push({ type: 'duplicate', text: `Warning: Gemini Key ${dupGem.join(' and ')} are duplicates.` });
    if (invGroq.length > 0) msgs.push({ type: 'invalid', text: `Error: Groq Key ${invGroq.join(' and ')} are invalid.` });
    if (invGem.length > 0) msgs.push({ type: 'invalid', text: `Error: Gemini Key ${invGem.join(' and ')} are invalid.` });
    if (invClaude.length > 0) msgs.push({ type: 'invalid', text: `Error: Claude Key ${invClaude.join(' and ')} are invalid.` });
    if (invChatgpt.length > 0) msgs.push({ type: 'invalid', text: `Error: ChatGPT Key ${invChatgpt.join(' and ')} are invalid.` });
    if (invDeepseek.length > 0) msgs.push({ type: 'invalid', text: `Error: DeepSeek Key ${invDeepseek.join(' and ')} are invalid.` });

    if (invGroq.length > 0 || invGem.length > 0 || invClaude.length > 0 || invChatgpt.length > 0 || invDeepseek.length > 0) {
      setSaveMessages(msgs);
      setTimeout(() => setSaveMessages([]), 8000);
      return;
    }

    localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys));
    localStorage.setItem('gemini_api_keys', JSON.stringify(geminiKeys));
    localStorage.setItem('claude_api_keys', JSON.stringify(claudeKeys));
    localStorage.setItem('chatgpt_api_keys', JSON.stringify(chatgptKeys));
    localStorage.setItem('deepseek_api_keys', JSON.stringify(deepseekKeys));
    initAIClient(provider, groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys);
    setSTTApiKey(groqKeys.filter(k => k.trim()));
    
    if (msgs.length === 0) {
      msgs.push({ type: 'success', text: 'Saved successfully!' });
    }
    
    setSaveMessages(msgs);
    setTimeout(() => setSaveMessages([]), 8000);
  };
"""

code = re.sub(
    r"const saveApiKeys = \(\) => \{.*?\n  \};\n", 
    save_func.strip() + "\n", 
    code, 
    flags=re.DOTALL
)

# 8. UseEffects for Validation
useEffects = """
    useEffect(() => {
      const timeoutId = setTimeout(async () => {
        const keysToValidate = new Set<string>();
        
        setClaudeKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 1; i++) {
            const key = claudeKeys[i].key.trim();
            if (!key) {
              next[i] = 'idle';
            } else {
              if (claudeValidationCache.current[key] === undefined) {
                next[i] = 'validating';
                keysToValidate.add(key);
              } else {
                next[i] = claudeValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });

        if (keysToValidate.size > 0) {
          await Promise.all(Array.from(keysToValidate).map(async (key) => {
            claudeValidationCache.current[key] = await validateClaudeKey(key);
          }));
          setClaudeKeyStatus(prev => {
            const next = [...prev];
            for (let i = 0; i < 1; i++) {
              const key = claudeKeys[i].key.trim();
              if (key) {
                next[i] = claudeValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
            return next;
          });
        }
      }, 800);
      return () => clearTimeout(timeoutId);
    }, [claudeKeys]);

    useEffect(() => {
      const timeoutId = setTimeout(async () => {
        const keysToValidate = new Set<string>();
        
        setChatgptKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = chatgptKeys[i].key.trim();
            if (!key) {
              next[i] = 'idle';
            } else {
              if (chatgptValidationCache.current[key] === undefined) {
                next[i] = 'validating';
                keysToValidate.add(key);
              } else {
                next[i] = chatgptValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });

        if (keysToValidate.size > 0) {
          await Promise.all(Array.from(keysToValidate).map(async (key) => {
            chatgptValidationCache.current[key] = await validateChatgptKey(key);
          }));
          setChatgptKeyStatus(prev => {
            const next = [...prev];
            for (let i = 0; i < 3; i++) {
              const key = chatgptKeys[i].key.trim();
              if (key) {
                next[i] = chatgptValidationCache.current[key] ? 'valid' : 'invalid';
              }
            }
            return next;
          });
        }
      }, 800);
      return () => clearTimeout(timeoutId);
    }, [chatgptKeys]);

    useEffect(() => {
      const timeoutId = setTimeout(async () => {
        const keysToValidate = new Set<string>();
        
        setDeepseekKeyStatus(prev => {
          const next = [...prev];
          for (let i = 0; i < 3; i++) {
            const key = deepseekKeys[i].key.trim();
            if (!key) {
              next[i] = 'idle';
            } else {
              if (deepseekValidationCache.current[key] === undefined) {
                next[i] = 'validating';
                keysToValidate.add(key);
              } else {
                next[i] = deepseekValidationCache.current[key].valid ? 'valid' : 'invalid';
              }
            }
          }
          return next;
        });

        if (keysToValidate.size > 0) {
          await Promise.all(Array.from(keysToValidate).map(async (key) => {
            deepseekValidationCache.current[key] = await validateDeepseekKey(key);
          }));
          
          setDeepseekKeyStatus(prev => {
            const next = [...prev];
            for (let i = 0; i < 3; i++) {
              const key = deepseekKeys[i].key.trim();
              if (key) {
                next[i] = deepseekValidationCache.current[key].valid ? 'valid' : 'invalid';
              }
            }
            return next;
          });
          
          setDeepseekBalances(prev => {
            const next = [...prev];
            for (let i = 0; i < 3; i++) {
              const key = deepseekKeys[i].key.trim();
              if (key && deepseekValidationCache.current[key]) {
                next[i] = deepseekValidationCache.current[key].balance;
              }
            }
            return next;
          });
        }
      }, 800);
      return () => clearTimeout(timeoutId);
    }, [deepseekKeys]);
"""

code = code.replace(
    "    }, [geminiKeys]);",
    "    }, [geminiKeys]);\n" + useEffects
)

# 9. Initial initAIClient call
code = code.replace(
    "initAIClient(provider, groqKeys, geminiKeys);",
    "initAIClient(provider, groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys);"
)

# 10. Rotation logic
rotation_logic = """
        if (e.key === '5') {
          setProvider(prev => {
            const models = [
              { name: 'groq', hasKey: groqKeys.some(k => k.trim()) },
              { name: 'gemini-flash', hasKey: geminiKeys.some(k => k.trim()) },
              { name: 'claude', hasKey: claudeKeys.some(k => k.key.trim()) },
              { name: 'chatgpt', hasKey: chatgptKeys.some(k => k.key.trim()) },
              { name: 'deepseek', hasKey: deepseekKeys.some(k => k.key.trim()) }
            ];
            
            const activeModels = models.filter(m => m.hasKey);
            if (activeModels.length === 0) return prev;
            
            const currentIndex = activeModels.findIndex(m => m.name === prev);
            const nextModel = activeModels[(currentIndex + 1) % activeModels.length].name as any;
            
            switchProvider(nextModel);
            const nameMap: any = { 'groq': 'Groq', 'gemini-flash': 'Gemini Flash', 'claude': 'Claude', 'chatgpt': 'ChatGPT', 'deepseek': 'DeepSeek' };
            setModelChangeMsg(`Switched to ${nameMap[nextModel]}`);
            setTimeout(() => setModelChangeMsg(''), 3000);
            return nextModel;
          });
        }
"""
code = re.sub(
    r"if \(e\.key === '5'\) \{.*?\n\s+\}\n",
    rotation_logic.strip() + "\n",
    code,
    flags=re.DOTALL
)

# 11. CustomSelect Options
options_logic = """
                      <CustomSelect 
                        value={provider} 
                        onChange={(val: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek') => {
                          if (val === 'groq' && !groqKeys.some(k => k.trim())) {
                            setModelChangeMsg('No API key found in Groq');
                            setTimeout(() => setModelChangeMsg(''), 3000);
                            return;
                          }
                          if (val === 'gemini-flash' && !geminiKeys.some(k => k.trim())) {
                            setModelChangeMsg('No API key found in Gemini Flash');
                            setTimeout(() => setModelChangeMsg(''), 3000);
                            return;
                          }
                          if (val === 'claude' && !claudeKeys.some(k => k.key.trim())) {
                            setModelChangeMsg('No API key found in Claude');
                            setTimeout(() => setModelChangeMsg(''), 3000);
                            return;
                          }
                          if (val === 'chatgpt' && !chatgptKeys.some(k => k.key.trim())) {
                            setModelChangeMsg('No API key found in ChatGPT');
                            setTimeout(() => setModelChangeMsg(''), 3000);
                            return;
                          }
                          if (val === 'deepseek' && !deepseekKeys.some(k => k.key.trim())) {
                            setModelChangeMsg('No API key found in DeepSeek');
                            setTimeout(() => setModelChangeMsg(''), 3000);
                            return;
                          }
                          
                          setProvider(val);
                          switchProvider(val);
                          const nameMap: any = { 'groq': 'Groq', 'gemini-flash': 'Gemini Flash', 'claude': 'Claude', 'chatgpt': 'ChatGPT', 'deepseek': 'DeepSeek' };
                          setModelChangeMsg(`Switched to ${nameMap[val]}`);
                          setTimeout(() => setModelChangeMsg(''), 3000);
                        }}
                        options={[
                          { value: 'groq', label: 'Groq (Llama 3 70B)' },
                          { value: 'gemini-flash', label: 'Gemini 2.5 Flash' },
                          { value: 'claude', label: 'Claude 3.5 Sonnet' },
                          { value: 'chatgpt', label: 'ChatGPT (GPT-4o)' },
                          { value: 'deepseek', label: 'DeepSeek Coder' }
                        ]}
"""
code = re.sub(
    r"<CustomSelect\s+value=\{provider\}.*?options=\{\[.*?\]\}",
    options_logic.strip(),
    code,
    flags=re.DOTALL
)

# 12. Add the Accordions
accordions = """
                  {/* Claude Accordion */}
                  <div className="border-b border-brand-border last:border-b-0">
                    <button onClick={() => setApiAccordion(apiAccordion === 'claude' ? 'none' : 'claude')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">Claude Keys (Anthropic)</h4>
                        <p className="text-xs text-brand-subtext mt-1">{claudeKeys.filter(k=>k.key.trim()).length} key loaded (14 Day Limit)</p>
                      </div>
                      {apiAccordion === 'claude' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                    </button>
                    {apiAccordion === 'claude' && (
                      <div className="p-5 bg-brand-card space-y-3">
                        {Array.from({ length: 1 }).map((_, i) => {
                          const daysLeft = getDaysLeft(claudeKeys[i].addedAt, 14);
                          return (
                          <div key={`claude-${i}`}>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-brand-subtext uppercase">Key {i + 1} (Mandatory)</label>
                              {daysLeft !== null && <span className="text-[10px] font-bold text-rose-400">{daysLeft} Days Left</span>}
                            </div>
                            <div className="relative">
                              <input 
                                type={showClaudeKeys[i] ? "text" : "password"} 
                                value={claudeKeys[i].key} 
                                onChange={e => {
                                  const newKeys = [...claudeKeys];
                                  newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                  setClaudeKeys(newKeys);
                                }}
                                className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                                placeholder={`sk-ant-...`}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {claudeKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                {claudeKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                {claudeKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                <button onClick={() => {
                                  const newShow = [...showClaudeKeys];
                                  newShow[i] = !newShow[i];
                                  setShowClaudeKeys(newShow);
                                }} className="text-brand-subtext hover:text-white transition-colors">
                                  {showClaudeKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button onClick={() => {
                                  const newKeys = [...claudeKeys];
                                  newKeys[i] = { key: '', addedAt: 0 };
                                  setClaudeKeys(newKeys);
                                  setDeleteMessage({ provider: 'claude', index: i });
                                  setTimeout(() => setDeleteMessage(null), 3000);
                                }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {deleteMessage?.provider === 'claude' && deleteMessage?.index === i && (
                              <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                            )}
                          </div>
                        )})}
                      </div>
                    )}
                  </div>

                  {/* ChatGPT Accordion */}
                  <div className="border-b border-brand-border last:border-b-0">
                    <button onClick={() => setApiAccordion(apiAccordion === 'chatgpt' ? 'none' : 'chatgpt')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">ChatGPT Keys (OpenAI)</h4>
                        <p className="text-xs text-brand-subtext mt-1">{chatgptKeys.filter(k=>k.key.trim()).length} keys loaded (90 Day Limit)</p>
                      </div>
                      {apiAccordion === 'chatgpt' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                    </button>
                    {apiAccordion === 'chatgpt' && (
                      <div className="p-5 bg-brand-card space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => {
                          const daysLeft = getDaysLeft(chatgptKeys[i].addedAt, 90);
                          return (
                          <div key={`chatgpt-${i}`}>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-brand-subtext uppercase">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                              {daysLeft !== null && <span className="text-[10px] font-bold text-rose-400">{daysLeft} Days Left</span>}
                            </div>
                            <div className="relative">
                              <input 
                                type={showChatgptKeys[i] ? "text" : "password"} 
                                value={chatgptKeys[i].key} 
                                onChange={e => {
                                  const newKeys = [...chatgptKeys];
                                  newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                  setChatgptKeys(newKeys);
                                }}
                                className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                                placeholder={`sk-...`}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {chatgptKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                {chatgptKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                {chatgptKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                <button onClick={() => {
                                  const newShow = [...showChatgptKeys];
                                  newShow[i] = !newShow[i];
                                  setShowChatgptKeys(newShow);
                                }} className="text-brand-subtext hover:text-white transition-colors">
                                  {showChatgptKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button onClick={() => {
                                  const newKeys = [...chatgptKeys];
                                  newKeys[i] = { key: '', addedAt: 0 };
                                  setChatgptKeys(newKeys);
                                  setDeleteMessage({ provider: 'chatgpt', index: i });
                                  setTimeout(() => setDeleteMessage(null), 3000);
                                }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>

                  {/* DeepSeek Accordion */}
                  <div className="border-b border-brand-border last:border-b-0">
                    <button onClick={() => setApiAccordion(apiAccordion === 'deepseek' ? 'none' : 'deepseek')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">DeepSeek Keys</h4>
                        <p className="text-xs text-brand-subtext mt-1">{deepseekKeys.filter(k=>k.key.trim()).length} keys loaded</p>
                      </div>
                      {apiAccordion === 'deepseek' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                    </button>
                    {apiAccordion === 'deepseek' && (
                      <div className="p-5 bg-brand-card space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => {
                          const daysLeft = getDaysLeft(deepseekKeys[i].addedAt, 90);
                          return (
                          <div key={`deepseek-${i}`}>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-brand-subtext uppercase">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                              <div className="flex gap-2">
                                {deepseekBalances[i] && <span className="text-[10px] font-bold text-green-400">Bal: ${deepseekBalances[i]}</span>}
                                {daysLeft !== null && <span className="text-[10px] font-bold text-rose-400">{daysLeft} Days Left</span>}
                              </div>
                            </div>
                            <div className="relative">
                              <input 
                                type={showDeepseekKeys[i] ? "text" : "password"} 
                                value={deepseekKeys[i].key} 
                                onChange={e => {
                                  const newKeys = [...deepseekKeys];
                                  newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                  setDeepseekKeys(newKeys);
                                }}
                                className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                                placeholder={`sk-...`}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {deepseekKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                {deepseekKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                {deepseekKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                <button onClick={() => {
                                  const newShow = [...showDeepseekKeys];
                                  newShow[i] = !newShow[i];
                                  setShowDeepseekKeys(newShow);
                                }} className="text-brand-subtext hover:text-white transition-colors">
                                  {showDeepseekKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button onClick={() => {
                                  const newKeys = [...deepseekKeys];
                                  newKeys[i] = { key: '', addedAt: 0 };
                                  setDeepseekKeys(newKeys);
                                  
                                  const newBals = [...deepseekBalances];
                                  newBals[i] = '';
                                  setDeepseekBalances(newBals);
                                  
                                  setDeleteMessage({ provider: 'deepseek', index: i });
                                  setTimeout(() => setDeleteMessage(null), 3000);
                                }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
"""

code = code.replace(
    "                        ))}\n                      </div>\n                    )}\n                  </div>\n                </div>\n              </section>",
    "                        ))}\n                      </div>\n                    )}\n                  </div>\n" + accordions + "\n                </div>\n              </section>"
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
