import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

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
                </div>
              </section>
"""

# Find `</section>` that comes right before `{/* Interview Context */}`
match = re.search(r'(\s*</div>\s*</div>\s*</section>\s*)\{\/\* Interview Context \*\/\}', code)
if match:
    # Replace the matching string with accordions + Interview Context
    code = code[:match.start()] + accordions + "\n\n              {/* Interview Context */}" + code[match.end():]
else:
    print("Could not find insertion point!")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
