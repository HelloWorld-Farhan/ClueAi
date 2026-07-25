import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Insert UseEffects
if 'validateClaudeKey(key);' not in code:
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
  }, [deepseekKeys]);\n"""

    # find geminiKeys hook end
    idx = code.find("  }, [geminiKeys]);")
    if idx != -1:
        end_idx = idx + len("  }, [geminiKeys]);")
        code = code[:end_idx] + "\n" + useEffects + code[end_idx:]

# 2. Insert Accordions
if 'Claude Accordion' not in code:
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
                  </div>\n"""

    # find where to insert: above {/* Interview Context */}
    # Wait, earlier I found out that we can insert it after `</section>` of the api keys section. 
    # Or just replace `{/* Interview Context */}` with `accordions + "{/* Interview Context */}"`
    # Let's insert before {/* Interview Context */}
    idx = code.find("{/* Interview Context */}")
    if idx != -1:
        # Go back to the end of the previous section, but it's easier to just insert here.
        # Actually, the accordions belong inside the Settings modal.
        # Let's find: `{/* Gemini Accordion */}` and its closing div
        # I'll just use regex to insert it right before the closing `</div>\n                </div>\n              </section>\n  \n              {/* Interview Context */}`
        match_str = "                  </div>\n                </div>\n              </section>\n  \n              {/* Interview Context */}"
        code = code.replace(match_str, "                  </div>\n" + accordions + "                </div>\n              </section>\n  \n              {/* Interview Context */}")
        
with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
