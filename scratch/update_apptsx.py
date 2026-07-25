import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handleSnipClick
old_snip = """  const handleSnipClick = async () => {
    setIsPaused(true);
    isPausedRef.current = true;
    const base64Img = await ipcRenderer.invoke('start-snipping', selectedSource);
    if (!base64Img) {
      setIsPaused(false);
      isPausedRef.current = false;
      return; // User cancelled
    }
    
    if (currentSnapshots.length > 0) {
      
    }

    setTranscript('');
    finalizedTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setAiAnswer('');
    setCurrentSnapshots(prev => [...prev.slice(-2), base64Img]);
  };"""

new_snip = """  const handleSnipClick = async () => {
    setIsPaused(true);
    isPausedRef.current = true;
    const base64Img = await ipcRenderer.invoke('start-snipping', selectedSource);
    if (!base64Img) {
      setIsPaused(false);
      isPausedRef.current = false;
      return; // User cancelled
    }
    
    const screenshotMarker = `\\n[Screenshot ${currentSnapshots.length + 1} Captured]\\n`;
    setTranscript(prev => prev + screenshotMarker);
    finalizedTranscriptRef.current += screenshotMarker;
    
    setCurrentSnapshots(prev => [...prev, base64Img]);
    setIsPaused(false);
    isPausedRef.current = false;
  };"""

content = content.replace(old_snip, new_snip)

# 2. Update Claude Keys state to 2
old_claude_state1 = """  const [claudeKeys, setClaudeKeys] = useState<TimedApiKey[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('claude_api_keys') || '[]'); 
      return keys.length === 1 ? keys : [{key: '', addedAt: 0}];
    } catch { return [{key: '', addedAt: 0}]; }
  });"""

new_claude_state1 = """  const [claudeKeys, setClaudeKeys] = useState<TimedApiKey[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('claude_api_keys') || '[]'); 
      return keys.length === 2 ? keys : [...keys, ...Array(2).fill({key: '', addedAt: 0})].slice(0, 2);
    } catch { return Array(2).fill({key: '', addedAt: 0}); }
  });"""

content = content.replace(old_claude_state1, new_claude_state1)

old_claude_state2 = "const [claudeKeyStatus, setClaudeKeyStatus] = useState<KeyValidationState[]>(Array(1).fill('idle'));"
new_claude_state2 = "const [claudeKeyStatus, setClaudeKeyStatus] = useState<KeyValidationState[]>(Array(2).fill('idle'));"
content = content.replace(old_claude_state2, new_claude_state2)

old_claude_state3 = "const [showClaudeKeys, setShowClaudeKeys] = useState<boolean[]>(Array(1).fill(false));"
new_claude_state3 = "const [showClaudeKeys, setShowClaudeKeys] = useState<boolean[]>(Array(2).fill(false));"
content = content.replace(old_claude_state3, new_claude_state3)

old_claude_loop1 = "for (let i = 0; i < 1; i++) {"
new_claude_loop1 = "for (let i = 0; i < 2; i++) {"
# We have a few `for (let i = 0; i < 1; i++) {` blocks inside `useEffect` for claudeKeys.
content = content.replace(old_claude_loop1, new_claude_loop1)

# Update UI accordion for Claude
old_claude_ui = """                                {Array(1).fill(0).map((_, i) => (
                                  <div key={i} className="flex gap-2">
                                    <div className="relative flex-1">
                                      <input 
                                        type={showClaudeKeys[i] ? "text" : "password"} 
                                        value={claudeKeys[i].key}
                                        onChange={(e) => {
                                          const newKeys = [...claudeKeys];
                                          newKeys[i] = { key: e.target.value, addedAt: Date.now() };
                                          setClaudeKeys(newKeys);
                                          
                                          const newStatus = [...claudeKeyStatus];
                                          newStatus[i] = 'idle';
                                          setClaudeKeyStatus(newStatus);
                                        }}
                                        placeholder="sk-ant-..." 
                                        className="w-full bg-black/50 border border-brand-border rounded-lg pl-4 pr-24 py-2.5 text-sm font-medium text-white outline-none focus:border-brand-accent transition-colors"
                                      />
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-black/40 p-1 rounded-md">
                                        <button onClick={() => {
                                          const next = [...showClaudeKeys];
                                          next[i] = !next[i];
                                          setShowClaudeKeys(next);
                                        }} className="p-1 hover:bg-white/10 rounded text-brand-subtext hover:text-white transition-colors" title={showClaudeKeys[i] ? "Hide Key" : "Show Key"}>
                                          {showClaudeKeys[i] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <button onClick={() => {
                                          const newKeys = [...claudeKeys];
                                          newKeys[i] = { key: '', addedAt: 0 };
                                          setClaudeKeys(newKeys);
                                        }} className="p-1 hover:bg-rose-500/20 hover:text-rose-400 rounded text-brand-subtext transition-colors" title="Clear Key">
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex flex-col justify-center items-center w-10 shrink-0 bg-black/30 rounded-lg border border-white/5">
                                      {claudeKeyStatus[i] === 'validating' ? (
                                        <Loader2 size={16} className="text-cyan-400 animate-spin" />
                                      ) : claudeKeyStatus[i] === 'valid' ? (
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                      ) : claudeKeyStatus[i] === 'invalid' ? (
                                        <XCircle size={16} className="text-rose-400" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full border-2 border-white/10" />
                                      )}
                                    </div>
                                    {getDaysLeft(claudeKeys[i].addedAt, 14) !== null && claudeKeyStatus[i] === 'valid' && (
                                      <div className="flex flex-col justify-center items-center w-20 shrink-0 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400 text-[10px] font-bold">
                                        {getDaysLeft(claudeKeys[i].addedAt, 14)} Days Left
                                      </div>
                                    )}
                                  </div>
                                ))}"""

new_claude_ui = """                                {Array(2).fill(0).map((_, i) => (
                                  <div key={i} className="flex gap-2">
                                    <div className="relative flex-1">
                                      <input 
                                        type={showClaudeKeys[i] ? "text" : "password"} 
                                        value={claudeKeys[i].key}
                                        onChange={(e) => {
                                          const newKeys = [...claudeKeys];
                                          newKeys[i] = { key: e.target.value, addedAt: Date.now() };
                                          setClaudeKeys(newKeys);
                                          
                                          const newStatus = [...claudeKeyStatus];
                                          newStatus[i] = 'idle';
                                          setClaudeKeyStatus(newStatus);
                                        }}
                                        placeholder={`sk-ant-... (Key ${i + 1})`} 
                                        className="w-full bg-black/50 border border-brand-border rounded-lg pl-4 pr-24 py-2.5 text-sm font-medium text-white outline-none focus:border-brand-accent transition-colors"
                                      />
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-black/40 p-1 rounded-md">
                                        <button onClick={() => {
                                          const next = [...showClaudeKeys];
                                          next[i] = !next[i];
                                          setShowClaudeKeys(next);
                                        }} className="p-1 hover:bg-white/10 rounded text-brand-subtext hover:text-white transition-colors" title={showClaudeKeys[i] ? "Hide Key" : "Show Key"}>
                                          {showClaudeKeys[i] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <button onClick={() => {
                                          const newKeys = [...claudeKeys];
                                          newKeys[i] = { key: '', addedAt: 0 };
                                          setClaudeKeys(newKeys);
                                        }} className="p-1 hover:bg-rose-500/20 hover:text-rose-400 rounded text-brand-subtext transition-colors" title="Clear Key">
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex flex-col justify-center items-center w-10 shrink-0 bg-black/30 rounded-lg border border-white/5">
                                      {claudeKeyStatus[i] === 'validating' ? (
                                        <Loader2 size={16} className="text-cyan-400 animate-spin" />
                                      ) : claudeKeyStatus[i] === 'valid' ? (
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                      ) : claudeKeyStatus[i] === 'invalid' ? (
                                        <XCircle size={16} className="text-rose-400" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full border-2 border-white/10" />
                                      )}
                                    </div>
                                    {getDaysLeft(claudeKeys[i].addedAt, 14) !== null && claudeKeyStatus[i] === 'valid' && (
                                      <div className="flex flex-col justify-center items-center w-20 shrink-0 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400 text-[10px] font-bold">
                                        {getDaysLeft(claudeKeys[i].addedAt, 14)} Days Left
                                      </div>
                                    )}
                                  </div>
                                ))}"""

content = content.replace(old_claude_ui, new_claude_ui)

# 3. Remove showSplash and the splash screen div
# Replace `const [showSplash, setShowSplash] = useState(true);` with `const showSplash = false;`
# Remove the `useEffect` that calls `setShowSplash(false)`
old_splash_state = """  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);"""

new_splash_state = """  const showSplash = false;"""

content = content.replace(old_splash_state, new_splash_state)


# Also remove the whole `{!showSplash && showUsernamePrompt && (` to just `{showUsernamePrompt && (`
old_username_prompt = """      {!showSplash && showUsernamePrompt && ("""
new_username_prompt = """      {showUsernamePrompt && ("""
content = content.replace(old_username_prompt, new_username_prompt)


with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("App.tsx updated successfully")
