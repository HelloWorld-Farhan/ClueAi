import os

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Portfolio Link to also minimize (I actually missed doing this earlier or rather the user requested it now for ALL links)
# Search for Portfolio Website
old_portfolio = '''<a href="https://farhan-khalid-portfolio.vercel.app/" target="_blank" style={{ color: '#22d3ee', textDecoration: 'none' }}>Portfolio Website</a>'''
# Actually wait, let's see how it's formatted. It might be standard quotes. Let me just replace shell.openExternal( with ipcRenderer.invoke('minimize-window'); shell.openExternal( where it's not already done.
# Ah, I replaced the 5 API links in a previous step! Let's check them.
# I used: onClick={(e) => { e.preventDefault(); shell.openExternal('URL'); }}
# I'll replace shell.openExternal( with ipcRenderer.invoke('minimize-window'); shell.openExternal(
content = content.replace(
    "shell.openExternal('https://console.groq.com/keys');",
    "ipcRenderer.invoke('minimize-window'); shell.openExternal('https://console.groq.com/keys');"
)
content = content.replace(
    "shell.openExternal('https://aistudio.google.com/app/apikey');",
    "ipcRenderer.invoke('minimize-window'); shell.openExternal('https://aistudio.google.com/app/apikey');"
)
content = content.replace(
    "shell.openExternal('https://console.anthropic.com/settings/keys');",
    "ipcRenderer.invoke('minimize-window'); shell.openExternal('https://console.anthropic.com/settings/keys');"
)
content = content.replace(
    "shell.openExternal('https://platform.openai.com/api-keys');",
    "ipcRenderer.invoke('minimize-window'); shell.openExternal('https://platform.openai.com/api-keys');"
)
content = content.replace(
    "shell.openExternal('https://platform.deepseek.com/api_keys');",
    "ipcRenderer.invoke('minimize-window'); shell.openExternal('https://platform.deepseek.com/api_keys');"
)

# And for the contact link/portfolio link near the top
content = content.replace(
    '''<a href="https://farhan-khalid-portfolio.vercel.app/" target="_blank" style={{color: '#22d3ee', textDecoration: 'none'}}>Portfolio Website</a>''',
    '''<a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} style={{color: '#22d3ee', textDecoration: 'none'}}>Portfolio Website</a>'''
)
content = content.replace(
    '''<a href="https://farhan-khalid-portfolio.vercel.app/" target="_blank" style="color: #22d3ee; text-decoration: none;">Portfolio Website</a>''',
    '''<a href="#" onClick={(e) => { e.preventDefault(); ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} style={{color: '#22d3ee', textDecoration: 'none'}}>Portfolio Website</a>'''
)


# 2. Add hotkey hint near Logo
old_logo_block = '''                  {username && (
                    <span className="hidden md:flex ml-1 items-center gap-1.5 px-2 py-0.5 bg-brand-secondary/80 border border-brand-border rounded-md shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold text-brand-subtext tracking-wide truncate max-w-[120px]">{username}</span>
                      <button onClick={logout} className="ml-1 text-brand-subtext hover:text-rose-400 transition-colors" title="Logout">
                        <LogOut size={10} />
                      </button>
                    </span>
                  )}
              </h1>'''
new_logo_block = '''                  {username && (
                    <span className="hidden md:flex ml-1 items-center gap-1.5 px-2 py-0.5 bg-brand-secondary/80 border border-brand-border rounded-md shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold text-brand-subtext tracking-wide truncate max-w-[120px]">{username}</span>
                      <button onClick={logout} className="ml-1 text-brand-subtext hover:text-rose-400 transition-colors" title="Logout">
                        <LogOut size={10} />
                      </button>
                    </span>
                  )}
                  <span className="ml-3 px-2 py-0.5 rounded border border-white/10 bg-black/20 text-[9px] font-bold text-white/40 tracking-wider uppercase flex items-center gap-1 pointer-events-none select-none">
                    <Keyboard size={10} /> Ctrl+Shift+K to minimize/restore
                  </span>
              </h1>'''
content = content.replace(old_logo_block, new_logo_block)


# 3. Add hotkey hint near Info header
old_info_header = '''                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2"><Info size={24} className="text-cyan-400" /> Info & Settings</h2>
                  <p className="text-white/50 text-xs mt-1">Configure your shortcuts, AI models, and stealth mode.</p>
                </div>'''
new_info_header = '''                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2"><Info size={24} className="text-cyan-400" /> Info & Settings</h2>
                    <p className="text-white/50 text-xs mt-1">Configure your shortcuts, AI models, and stealth mode.</p>
                  </div>
                  <span className="hidden md:flex px-2.5 py-1 rounded-md border border-white/10 bg-black/30 text-[10px] font-bold text-white/50 tracking-wider uppercase items-center gap-1.5 pointer-events-none select-none">
                    <Keyboard size={12} /> Ctrl+Shift+K to minimize/restore
                  </span>
                </div>'''
content = content.replace(old_info_header, new_info_header)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated links and hotkeys!")
