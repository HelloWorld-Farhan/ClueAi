import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add ClipboardPaste to lucide-react imports if not there
if 'ClipboardPaste' not in content:
    content = re.sub(
        r"(import \{[^}]+)( \} from 'lucide-react';)",
        r"\1, ClipboardPaste\2",
        content,
        count=1
    )

providers = [
    ('Groq', 'groqKeys', 'string'),
    ('Gemini', 'geminiKeys', 'string'),
    ('Claude', 'claudeKeys', 'object'),
    ('Chatgpt', 'chatgptKeys', 'object'),
    ('Deepseek', 'deepseekKeys', 'object'),
    ('Glm', 'glmKeys', 'object')
]

for Name, state_name, t in providers:
    # Build paste button
    if t == 'string':
        setter = f"newKeys[i] = text.trim();"
    else:
        setter = f"newKeys[i] = {{ key: text.trim(), addedAt: Date.now() }};"
        
    paste_button = f"""<button onClick={{async () => {{
                                      try {{
                                        const text = await navigator.clipboard.readText();
                                        if (text && text.trim()) {{
                                          const newKeys = [...{state_name}];
                                          {setter}
                                          set{Name}Keys(newKeys);
                                        }}
                                      }} catch(e) {{}}
                                    }}}} className="text-brand-subtext hover:text-blue-400 transition-colors" title="Paste API Key">
                                      <ClipboardPaste size={{14}} />
                                    </button>"""
                                    
    # Find the Show/Hide Eye button and append paste button
    pattern = r'(<button onClick=\{\(\) => \{\s*const newShow = \[\.\.\.show' + Name + r'Keys\];\s*newShow\[i\] = !newShow\[i\];\s*setShow' + Name + r'Keys\(newShow\);\s*\}\} className="text-brand-subtext hover:text-white transition-colors">\s*\{show' + Name + r'Keys\[i\] \? <Eye size=\{14\} /> : <EyeOff size=\{14\} />\}\s*</button>)'
    
    if re.search(pattern, content):
        content = re.sub(pattern, r'\1\n                                    ' + paste_button, content)

# Remove the onClick from Glm input
glm_input_pattern = r'onClick=\{async \(\) => \{\s*if \(!glmKeys\[i\]\.key\) \{\s*try \{\s*const text = await navigator\.clipboard\.readText\(\);\s*if \(text && text\.trim\(\)\) \{\s*const newKeys = \[\.\.\.glmKeys\];\s*newKeys\[i\] = \{ key: text\.trim\(\), addedAt: Date\.now\(\) \};\s*setGlmKeys\(newKeys\);\s*\}\s*\} catch\(e\) \{\}\s*\}\s*\}\}'
content = re.sub(glm_input_pattern, '', content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
