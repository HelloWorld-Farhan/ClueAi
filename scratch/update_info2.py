import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

replacement = """                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                    <div className="space-y-2">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Groq Keys (For Audio & Fast Text)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li>Go to <a href="https://console.groq.com/keys" target="_blank" className="text-blue-400 hover:underline">console.groq.com/keys</a> and log in.</li>
                        <li>Click on <strong>Create API Key</strong> in the top right.</li>
                        <li>Copy the key (it starts with `gsk_`).</li>
                        <li>Paste it into the Groq API Key field in ClueAI Settings.</li>
                        <li><em>Note: Groq is free but rate-limited. Add multiple keys to avoid interruptions!</em></li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Gemini Keys (For Snapshots)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">aistudio.google.com/app/apikey</a> and log in.</li>
                        <li>Click <strong>Create API Key</strong> and select an existing project or create a new one.</li>
                        <li>Copy the generated key (it starts with `AIzaSy` or `AQ.`).</li>
                        <li>Paste it into the Gemini API Key field in ClueAI Settings.</li>
                        <li><em>Note: Gemini is extremely powerful for visual coding questions!</em></li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting Claude Keys (Best for Coding)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li>Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" className="text-blue-400 hover:underline">console.anthropic.com/settings/keys</a> and log in.</li>
                        <li><strong>Important:</strong> Use a new phone number to get $5 in free credits!</li>
                        <li>Click <strong>Create Key</strong> and copy it (starts with `sk-ant-`).</li>
                        <li>Paste it into the Claude API Key field in ClueAI Settings.</li>
                        <li><em>Note: Free credits expire in 14 days, so add your keys one-by-one!</em></li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting ChatGPT Keys (Smart All-Rounder)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-400 hover:underline">platform.openai.com/api-keys</a> and log in.</li>
                        <li>Create a new account with a unique phone number for free credits.</li>
                        <li>Click <strong>Create new secret key</strong> and copy it (starts with `sk-`).</li>
                        <li>Paste it into the ChatGPT API Key fields (up to 3 for rotation).</li>
                        <li><em>Note: ChatGPT keys automatically rotate during use to bypass limits.</em></li>
                      </ol>
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Getting DeepSeek Keys (Lightning Fast Code)</h4>
                      <ol className="text-brand-subtext text-xs leading-relaxed space-y-2 list-decimal pl-4">
                        <li>Go to <a href="https://platform.deepseek.com/api_keys" target="_blank" className="text-blue-400 hover:underline">platform.deepseek.com/api_keys</a> and log in.</li>
                        <li>Click <strong>Create new API key</strong> and copy it.</li>
                        <li>DeepSeek is extremely cheap but requires adding a small balance (Top-up).</li>
                        <li>Paste it into the DeepSeek API Key fields (up to 3 for rotation).</li>
                        <li><em>Note: Your DeepSeek account balance is automatically checked and shown!</em></li>
                      </ol>
                    </div>
                  </div>"""

# Match the div grid using regex
pattern = r'(<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">[\s\S]*?</div>\s*</div>\s*</div>)'

# Wait, the structure is:
# <h3 className="text-lg font-bold text-white">How to get API Keys (Free)</h3>
# <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
#   <div className="space-y-2">...</div>
#   <div className="space-y-2">...</div>
# </div>
# So the end of the match is the </div> that closes the grid!
# Let's match starting from `<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">`
# to `<li><em>Note: Gemini is extremely powerful for visual coding questions!</em></li>\n                      </ol>\n                    </div>\n                  </div>`
pattern = r'<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">[\s\S]*?<li><em>Note: Gemini is extremely powerful for visual coding questions!</em></li>\s*</ol>\s*</div>\s*</div>'

if re.search(pattern, code):
    code = re.sub(pattern, replacement, code)
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Success")
else:
    print("Pattern not found")
