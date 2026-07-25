import re

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State variables
state_vars = '''  const [deepseekKeys, setDeepseekKeys] = useState<TimedApiKey[]>(() => {
    const saved = localStorage.getItem('deepseekKeys');
    return saved ? JSON.parse(saved) : Array.from({ length: 3 }).map(() => ({ key: '', addedAt: 0 }));
  });
  const [showDeepseekKeys, setShowDeepseekKeys] = useState<boolean[]>(Array.from({ length: 3 }).fill(false) as boolean[]);
  const [deepseekKeyStatus] = useState<('valid'|'invalid'|'validating'|'duplicate'|null)[]>(Array.from({ length: 3 }).fill(null) as null[]);

  const [glmKeys, setGlmKeys] = useState<TimedApiKey[]>(() => {
    const saved = localStorage.getItem('glmKeys');
    return saved ? JSON.parse(saved) : Array.from({ length: 3 }).map(() => ({ key: '', addedAt: 0 }));
  });
  const [showGlmKeys, setShowGlmKeys] = useState<boolean[]>(Array.from({ length: 3 }).fill(false) as boolean[]);
  const [glmKeyStatus] = useState<('valid'|'invalid'|'validating'|'duplicate'|null)[]>(Array.from({ length: 3 }).fill(null) as null[]);'''

content = content.replace('''  const [deepseekKeys, setDeepseekKeys] = useState<TimedApiKey[]>(() => {
    const saved = localStorage.getItem('deepseekKeys');
    return saved ? JSON.parse(saved) : Array.from({ length: 3 }).map(() => ({ key: '', addedAt: 0 }));
  });
  const [showDeepseekKeys, setShowDeepseekKeys] = useState<boolean[]>(Array.from({ length: 3 }).fill(false) as boolean[]);
  const [deepseekKeyStatus] = useState<('valid'|'invalid'|'validating'|'duplicate'|null)[]>(Array.from({ length: 3 }).fill(null) as null[]);''', state_vars)

# 2. LocalStorage save
save_effect = '''    localStorage.setItem('deepseekKeys', JSON.stringify(deepseekKeys));
  }, [groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys]);'''
content = content.replace(save_effect, '''    localStorage.setItem('deepseekKeys', JSON.stringify(deepseekKeys));
    localStorage.setItem('glmKeys', JSON.stringify(glmKeys));
  }, [groqKeys, geminiKeys, claudeKeys, chatgptKeys, deepseekKeys, glmKeys]);''')

# 3. initAIClient call
init_call = '''      initAIClient(
        selectedLLM as any, 
        groqKeys, 
        geminiKeys,
        claudeKeys,
        chatgptKeys,
        deepseekKeys
      );'''
content = content.replace(init_call, '''      initAIClient(
        selectedLLM as any, 
        groqKeys, 
        geminiKeys,
        claudeKeys,
        chatgptKeys,
        deepseekKeys,
        glmKeys
      );''')

# 4. LLM Dropdown Options
llm_options = '''                        <option value="chatgpt">ChatGPT (GPT-4o) - Smart All-Rounder</option>
                        <option value="deepseek">DeepSeek Coder - Lightning Fast Code</option>'''
content = content.replace(llm_options, '''                        <option value="chatgpt">ChatGPT (GPT-4o) - Smart All-Rounder</option>
                        <option value="deepseek">DeepSeek Coder - Lightning Fast Code</option>
                        <option value="glm">GLM / NVIDIA NIM - Advanced Alternate</option>''')

# 5. Validation in Settings
val_checks = '''                            if (val === 'deepseek' && !deepseekKeys.some(k => k.key.trim())) {
                              setModelChangeMsg('No API key found in DeepSeek');
                              setTimeout(() => setModelChangeMsg(''), 3000);
                              return;
                            }'''
content = content.replace(val_checks, val_checks + '''
                            if (val === 'glm' && !glmKeys.some(k => k.key.trim())) {
                              setModelChangeMsg('No API key found in GLM / NVIDIA');
                              setTimeout(() => setModelChangeMsg(''), 3000);
                              return;
                            }''')

# 6. UI Accordion
deepseek_accordion_end = '''                      </div>
                    )}
                  </div>'''
glm_accordion = '''
                  {/* GLM Accordion */}
                  <div className="border-b border-brand-border last:border-b-0">
                    <button onClick={() => setApiAccordion(apiAccordion === 'glm' ? 'none' : 'glm')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">GLM / NVIDIA Keys</h4>
                        <p className="text-xs text-brand-subtext mt-1">{glmKeys.filter(k=>k.key.trim()).length} keys loaded (Used for LLM)</p>
                      </div>
                      {apiAccordion === 'glm' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                    </button>
                    
                    {apiAccordion === 'glm' && (
                      <div className="p-5 bg-brand-card space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={glm-}>
                            <label className="block text-[10px] font-bold text-brand-subtext uppercase mb-1">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={async () => {
                                  if (!glmKeys[i].key) {
                                    try {
                                      const text = await navigator.clipboard.readText();
                                      if (text && text.trim()) {
                                        const newKeys = [...glmKeys];
                                        newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                        setGlmKeys(newKeys);
                                      }
                                    } catch(e) {}
                                  }
                                }}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-xs flex items-center justify-center border border-white/10 shrink-0"
                                title="Paste from Clipboard"
                              >
                                Paste
                              </button>
                              <div className="relative flex-1">
                                <input 
                                  type={showGlmKeys[i] ? "text" : "password"} 
                                  value={glmKeys[i].key} 
                                  onChange={e => {
                                    const newKeys = [...glmKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setGlmKeys(newKeys);
                                  }}
                                  onClick={async () => {
                                    if (!glmKeys[i].key) {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        if (text && text.trim()) {
                                          const newKeys = [...glmKeys];
                                          newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                          setGlmKeys(newKeys);
                                        }
                                      } catch(e) {}
                                    }
                                  }}
                                  className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                                  placeholder={
vapi- or Zhipu key}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                  {glmKeyStatus[i] === 'validating' && <div><Loader2 size={16} className="animate-spin text-brand-subtext" /></div>}
                                  {glmKeyStatus[i] === 'valid' && <div><CheckCircle2 size={16} className="text-green-500" /></div>}
                                  {glmKeyStatus[i] === 'invalid' && <div><XCircle size={16} className="text-rose-500" /></div>}
                                  {glmKeyStatus[i] === 'duplicate' && <div><AlertTriangle size={16} className="text-yellow-500" /></div>}
                                  <button onClick={() => {
                                    const newShow = [...showGlmKeys];
                                    newShow[i] = !newShow[i];
                                    setShowGlmKeys(newShow);
                                  }} className="text-brand-subtext hover:text-white transition-colors">
                                    {showGlmKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                  <button onClick={() => {
                                    const newKeys = [...glmKeys];
                                    newKeys[i] = { key: '', addedAt: 0 };
                                    setGlmKeys(newKeys);
                                    setDeleteMessage({ provider: 'glm', index: i });
                                    setTimeout(() => setDeleteMessage(null), 3000);
                                  }} className="text-rose-500 hover:text-rose-400 transition-colors">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {deleteMessage?.provider === 'glm' && deleteMessage?.index === i && (
                              <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>'''

# I will find the end of deepseek accordion
# Let's search for "DeepSeek Keys" and append below it
content = re.sub(r'(<h4 className="text-sm font-bold text-white flex items-center gap-2">DeepSeek Keys.*?</div>\s*)}\s*</div>)', r'\1\n' + glm_accordion, content, flags=re.DOTALL)


# 7. Info section
info_deepseek = '''                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting DeepSeek Keys (Lightning Fast Code)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://platform.deepseek.com/api_keys'); }} className="text-blue-400 hover:underline">platform.deepseek.com/api_keys</a> and log in.</li>
                        <li>Click <strong>Create new API key</strong> and copy it.</li>
                        <li>DeepSeek is extremely cheap but requires adding a small balance (Top-up).</li>
                        <li>Paste it into the DeepSeek API Key fields (up to 3 for rotation).</li>
                      </ol>
                    </div>'''

info_glm = '''                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting GLM / NVIDIA Keys (Free Advanced)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li><strong>NVIDIA NIM:</strong> Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://build.nvidia.com'); }} className="text-blue-400 hover:underline">build.nvidia.com</a>, log in, and click any Llama 3 70B/405B model to get an API key (nvapi-...). You get 1000 free credits!</li>
                        <li><strong>Zhipu AI:</strong> Go to <a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://bigmodel.cn'); }} className="text-blue-400 hover:underline">bigmodel.cn</a> for native GLM-4. New users get 25M free tokens!</li>
                        <li>Paste either key into the GLM / NVIDIA API Key fields (up to 3 for rotation). The system automatically detects and uses the correct model.</li>
                      </ol>
                    </div>'''

content = content.replace(info_deepseek, info_deepseek + '\n' + info_glm)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated App.tsx")
