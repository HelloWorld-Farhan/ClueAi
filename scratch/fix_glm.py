import re
filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('key={glm-}', 'key={glm-}')
content = content.replace('placeholder={\\nvapi- or Zhipu key}', 'placeholder={
vapi- or Zhipu key}')
content = content.replace('placeholder={\napi- or Zhipu key}', 'placeholder={
vapi- or Zhipu key}')
content = content.replace('placeholder={\n  api- or Zhipu key}', 'placeholder={
vapi- or Zhipu key}')
content = content.replace('placeholder={\nvapi- or Zhipu key}', 'placeholder={
vapi- or Zhipu key}')


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
