import re
import os

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Groq
groq_replacement = '''                                onChange={e => {
                                  const newKeys = [...groqKeys];
                                  newKeys[i] = e.target.value;
                                  setGroqKeys(newKeys);
                                }}
                                onClick={async () => {
                                  if (!groqKeys[i]) {
                                    try {
                                      const text = await navigator.clipboard.readText();
                                      if (text && text.trim()) {
                                        const newKeys = [...groqKeys];
                                        newKeys[i] = text.trim();
                                        setGroqKeys(newKeys);
                                      }
                                    } catch(e) {}
                                  }
                                }}'''
content = content.replace('''                                onChange={e => {
                                  const newKeys = [...groqKeys];
                                  newKeys[i] = e.target.value;
                                  setGroqKeys(newKeys);
                                }}''', groq_replacement)


# 2. Gemini
gemini_replacement = '''                                onChange={e => {
                                  const newKeys = [...geminiKeys];
                                  newKeys[i] = e.target.value;
                                  setGeminiKeys(newKeys);
                                }}
                                onClick={async () => {
                                  if (!geminiKeys[i]) {
                                    try {
                                      const text = await navigator.clipboard.readText();
                                      if (text && text.trim()) {
                                        const newKeys = [...geminiKeys];
                                        newKeys[i] = text.trim();
                                        setGeminiKeys(newKeys);
                                      }
                                    } catch(e) {}
                                  }
                                }}'''
content = content.replace('''                                onChange={e => {
                                  const newKeys = [...geminiKeys];
                                  newKeys[i] = e.target.value;
                                  setGeminiKeys(newKeys);
                                }}''', gemini_replacement)


# 3. Claude
claude_replacement = '''                                  onChange={e => {
                                    const newKeys = [...claudeKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setClaudeKeys(newKeys);
                                  }}
                                  onClick={async () => {
                                    if (!claudeKeys[i].key) {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        if (text && text.trim()) {
                                          const newKeys = [...claudeKeys];
                                          newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                          setClaudeKeys(newKeys);
                                        }
                                      } catch(e) {}
                                    }
                                  }}'''
content = content.replace('''                                  onChange={e => {
                                    const newKeys = [...claudeKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setClaudeKeys(newKeys);
                                  }}''', claude_replacement)


# 4. ChatGPT
chatgpt_replacement = '''                                  onChange={e => {
                                    const newKeys = [...chatgptKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setChatgptKeys(newKeys);
                                  }}
                                  onClick={async () => {
                                    if (!chatgptKeys[i].key) {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        if (text && text.trim()) {
                                          const newKeys = [...chatgptKeys];
                                          newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                          setChatgptKeys(newKeys);
                                        }
                                      } catch(e) {}
                                    }
                                  }}'''
content = content.replace('''                                  onChange={e => {
                                    const newKeys = [...chatgptKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setChatgptKeys(newKeys);
                                  }}''', chatgpt_replacement)


# 5. DeepSeek
deepseek_replacement = '''                                  onChange={e => {
                                    const newKeys = [...deepseekKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setDeepseekKeys(newKeys);
                                  }}
                                  onClick={async () => {
                                    if (!deepseekKeys[i].key) {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        if (text && text.trim()) {
                                          const newKeys = [...deepseekKeys];
                                          newKeys[i] = { key: text.trim(), addedAt: Date.now() };
                                          setDeepseekKeys(newKeys);
                                        }
                                      } catch(e) {}
                                    }
                                  }}'''
content = content.replace('''                                  onChange={e => {
                                    const newKeys = [...deepseekKeys];
                                    newKeys[i] = { key: e.target.value, addedAt: e.target.value ? Date.now() : 0 };
                                    setDeepseekKeys(newKeys);
                                  }}''', deepseek_replacement)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected onClick handlers for paste!")
