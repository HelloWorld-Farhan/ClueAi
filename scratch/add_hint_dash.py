import os

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = '''                  {username && (
                    <span className="text-white text-lg font-bold ml-1 tracking-tight flex items-center gap-2 opacity-90 transition-opacity">
                      <span className="mx-2 text-white/30">|</span> {username}
                      <button 
                        onClick={() => { setTempUsername(username); setShowUsernamePrompt(true); }}
                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors shadow-sm ml-1"
                        title="Rename"
                      >
                        <Edit2 size={13} />
                      </button>
                    </span>
                  )}
              </h1>'''

new_block = '''                  {username && (
                    <span className="text-white text-lg font-bold ml-1 tracking-tight flex items-center gap-2 opacity-90 transition-opacity">
                      <span className="mx-2 text-white/30">|</span> {username}
                      <button 
                        onClick={() => { setTempUsername(username); setShowUsernamePrompt(true); }}
                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors shadow-sm ml-1"
                        title="Rename"
                      >
                        <Edit2 size={13} />
                      </button>
                    </span>
                  )}
                  <span className="ml-3 px-2 py-0.5 rounded border border-white/10 bg-black/20 text-[9px] font-bold text-white/40 tracking-wider uppercase hidden md:flex items-center gap-1 pointer-events-none select-none">
                    <Keyboard size={10} /> Ctrl+Shift+K to minimize/restore
                  </span>
              </h1>'''

content = content.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added hint to dashboard logo!")
